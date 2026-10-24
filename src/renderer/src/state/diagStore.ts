import { useSyncExternalStore } from 'react'
import type { DiagEvent, DiagModuleId, DiagProbe, DiagRun, DiagRunSummary, DiagStatus } from '@shared/diag'

// =============================================================
// 出口诊断状态（渲染层 v2）
// · 双模式：live（主进程实时轮次，事件 + 轮询校准）/ history（不可变历史快照，
//   后台实时结果不得覆盖历史视图）。
// · runId 隔离：停止/重跑/载入历史后，旧 runId 的迟到事件一律丢弃。
// · probe 事件携带完整探测项：直接写入对应行（骨架启动即有行）。
// · 主进程为唯一数据源；页面卸载再进入时恢复最近轮次的订阅与轮询。
// =============================================================

export type DiagViewMode = 'live' | 'history'

export interface HistoryDiagMeta {
  recordId: string
  startedAt: string
}

interface DiagState {
  mode: DiagViewMode
  /** live：主进程最近/当前轮（含逐项结果） */
  run: DiagRun | null
  summary: DiagRunSummary | null
  /** history：载入的历史快照（不可变） */
  historyDiag: DiagRunSummary | null
  historyMeta: HistoryDiagMeta | null
  /** 本地记录的「最新启动 runId」；早于它的事件全部忽略 */
  activeRunId: string | null
  starting: boolean
}

let state: DiagState = {
  mode: 'live',
  run: null,
  summary: null,
  historyDiag: null,
  historyMeta: null,
  activeRunId: null,
  starting: false
}
const subs = new Set<() => void>()

function emitChange(): void {
  state = { ...state }
  for (const s of subs) s()
}

/** 应用 probe 事件：定位行并整体替换（骨架行在启动时即创建） */
function applyProbe(run: DiagRun, moduleId: DiagModuleId, probe: DiagProbe): boolean {
  const m = run.modules.find((x) => x.id === moduleId)
  if (!m) return false
  const idx = m.probes.findIndex((p) => p.id === probe.id)
  if (idx >= 0) {
    const probes = m.probes.slice()
    probes[idx] = probe
    m.probes = probes
    return true
  }
  // 骨架未含该行（如 Sukka 页面为完整模式动态追加）：按顺序追加
  m.probes = [...m.probes, probe]
  return true
}

function recomputeModuleStatus(m: { probes: DiagProbe[] }): DiagStatus {
  const st = m.probes.map((p) => p.status)
  if (!st.length || st.every((s) => s === 'queued' || s === 'pending' || s === 'skipped')) return 'pending'
  if (st.includes('running')) return 'running'
  const ok = st.filter((s) => s === 'success').length
  const bad = st.filter((s) => s === 'failed' || s === 'timeout').length
  const canceled = st.filter((s) => s === 'canceled').length
  if (ok > 0) return bad + canceled > 0 ? 'partial' : 'success'
  if (canceled > 0 && bad === 0) return 'canceled'
  return 'failed'
}

let subscribed = false
function ensureSubscribed(): void {
  if (subscribed) return
  subscribed = true
  window.ipInsight.onDiagEvent((e: DiagEvent) => {
    if (state.mode !== 'live') return // 历史视图：实时事件不覆盖
    if (!state.activeRunId || e.runId !== state.activeRunId) return
    const run = state.run
    if (!run || run.runId !== e.runId) return
    if (e.kind === 'probe') {
      if (applyProbe(run, e.moduleId, e.probe)) {
        const m = run.modules.find((x) => x.id === e.moduleId)
        if (m) m.status = recomputeModuleStatus(m)
      }
    } else if (e.kind === 'module') {
      const m = run.modules.find((x) => x.id === e.moduleId)
      if (m) m.status = e.status
    } else if (e.kind === 'run') {
      run.status = e.status
      run.finishedReason = e.finishedReason
      if (e.status !== 'running' && !run.finishedAt) run.finishedAt = new Date().toISOString()
    }
    emitChange()
  })
}

/** 运行期间每 2.5s 全量校准（以主进程快照为准；事件只提供即时反馈） */
let pollTimer: ReturnType<typeof setInterval> | null = null
function ensurePolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (state.mode !== 'live') {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      return
    }
    const run = state.run
    if (!run || run.status !== 'running') {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      return
    }
    void refreshDiag()
  }, 2500)
}

function adoptRun(run: DiagRun | null, summary: DiagRunSummary | null): void {
  if (!run) {
    state = { ...state, run: null, summary: null }
    return
  }
  // 采纳新快照前保留本视图已知的行内状态，避免轮询回退（主进程快照为准，直接替换）
  state = { ...state, run, summary }
}

export function subscribeDiag(cb: () => void): () => void {
  ensureSubscribed()
  subs.add(cb)
  return () => subs.delete(cb)
}

export function getDiag(): DiagState {
  return state
}

/** 恢复最近一轮（页面挂载时；后台轻量诊断也能正确恢复订阅与轮询） */
export async function refreshDiag(): Promise<void> {
  try {
    if (state.activeRunId) {
      const r = await window.ipInsight.getDiag(state.activeRunId)
      if (r.ok) {
        adoptRun(r.run, r.summary)
        if (r.run?.status === 'running') ensurePolling()
        emitChange()
        return
      }
    }
    const r = await window.ipInsight.latestDiag()
    if (r.ok) {
      adoptRun(r.run, r.summary)
      // 无本地活动轮时采纳主进程最近轮（后台启动的轻量诊断）
      if (r.run && !state.activeRunId) state.activeRunId = r.run.runId
      if (r.run?.status === 'running') ensurePolling()
      emitChange()
    }
  } catch {
    /* 主进程不可达时保持现状 */
  }
}

/** 进入实时视图（新检测 / 重跑 / 从历史切回） */
export function enterLive(): void {
  state = { ...state, mode: 'live', historyDiag: null, historyMeta: null }
  emitChange()
}

/** 载入历史快照（不可变；实时事件与轮询全部让位） */
export function loadHistoryDiag(summary: DiagRunSummary, meta: HistoryDiagMeta): void {
  state = { ...state, mode: 'history', historyDiag: summary, historyMeta: meta }
  emitChange()
}

export async function startDiag(
  modules: DiagModuleId[],
  origin: 'dashboard' | 'network' = 'network',
  detectionId?: string
): Promise<string | null> {
  ensureSubscribed()
  state = { ...state, starting: true, mode: 'live', historyDiag: null, historyMeta: null }
  emitChange()
  try {
    const r = await window.ipInsight.startDiag({ modules, origin, detectionId })
    if (r.ok && r.runId) {
      state = { ...state, activeRunId: r.runId, starting: false }
      if (r.run) adoptRun(r.run, null)
      emitChange()
      ensurePolling()
      return r.runId
    }
    state = { ...state, starting: false }
    emitChange()
    return null
  } catch {
    state = { ...state, starting: false }
    emitChange()
    return null
  }
}

export async function stopDiag(): Promise<void> {
  try {
    await window.ipInsight.stopDiag(state.activeRunId ?? undefined)
    // 停止后立即拉一次最终状态（主进程已终结全部未完成项）
    setTimeout(() => void refreshDiag(), 120)
  } catch {
    /* ignore */
  }
}

/** 单项 / 多项重试（不清空其他结果） */
export async function retryDiagProbes(probeIds: string[]): Promise<void> {
  if (!state.activeRunId || !probeIds.length) return
  try {
    await window.ipInsight.retryDiag({ runId: state.activeRunId, probeIds })
    setTimeout(() => void refreshDiag(), 120)
  } catch {
    /* ignore */
  }
}

export function useDiag(): DiagState {
  return useSyncExternalStore(subscribeDiag, getDiag, getDiag)
}

/** 当前视图快照：history 模式用历史摘要，live 模式用实时摘要 */
export function activeSummary(st: DiagState): DiagRunSummary | null {
  return st.mode === 'history' ? st.historyDiag : st.summary
}

/** 运行中判定 */
export function diagRunning(st: DiagState): boolean {
  if (st.starting) return true
  if (st.mode !== 'live') return false
  if (!st.run) return false
  return st.run.status === 'running'
}

/** 模块探测项计数（成功/总数） */
export function moduleProbeStats(run: DiagRun | null, id: DiagModuleId): { ok: number; total: number } {
  const m = run?.modules.find((x) => x.id === id)
  if (!m) return { ok: 0, total: 0 }
  return { ok: m.probes.filter((p) => p.status === 'success').length, total: m.probes.length }
}
