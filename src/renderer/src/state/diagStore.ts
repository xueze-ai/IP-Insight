import { useSyncExternalStore } from 'react'
import type { DiagEvent, DiagModuleId, DiagRun, DiagRunSummary, DiagStatus } from '@shared/diag'

// =============================================================
// 出口诊断状态（渲染层）
// · runId 隔离：停止/重跑/载入历史后，旧 runId 的迟到事件一律丢弃。
// · 主进程为唯一数据源（latestDiag 拉取 + diag:event 增量）。
// =============================================================

interface DiagState {
  run: DiagRun | null
  summary: DiagRunSummary | null
  /** 本地记录的“最新启动 runId”，早于它的事件全部忽略 */
  activeRunId: string | null
  starting: boolean
}

let state: DiagState = { run: null, summary: null, activeRunId: null, starting: false }
const subs = new Set<() => void>()

function emitChange(): void {
  state = { ...state }
  for (const s of subs) s()
}

let subscribed = false
let pollTimer: ReturnType<typeof setInterval> | null = null

/** 运行期间每 2s 全量校准一次（事件仅提供即时反馈；以主进程快照为准） */
function ensurePolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    const run = state.run
    if (!run || run.status !== 'running') {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      return
    }
    void refreshDiag()
  }, 2000)
}

function ensureSubscribed(): void {
  if (subscribed) return
  subscribed = true
  window.ipInsight.onDiagEvent((e: DiagEvent) => {
    // 迟到轮次隔离：只接受当前活动 runId 的事件
    if (!state.activeRunId || e.runId !== state.activeRunId) return
    if (!state.run || state.run.runId !== e.runId) return
    const run = state.run
    const mIdx = run.modules.findIndex((m) => m.id === e.moduleId)
    if (mIdx >= 0) {
      const m = run.modules[mIdx]
      if (e.probeId) {
        const pIdx = m.probes.findIndex((p) => p.id === e.probeId)
        if (pIdx >= 0 && m.probes[pIdx].status !== e.status) {
          const probes = m.probes.slice()
          probes[pIdx] = { ...probes[pIdx], status: e.status }
          run.modules[mIdx] = { ...m, probes }
        }
      } else if (m.status !== e.status) {
        run.modules[mIdx] = { ...m, status: e.status }
      }
    }
    if (e.status === 'canceled' || ['success', 'partial', 'failed', 'timeout', 'canceled'].includes(e.status)) {
      // 模块完成事件由 summary 拉取校准；此处只更新运行态 UI
    }
    emitChange()
  })
}

export function subscribeDiag(cb: () => void): () => void {
  ensureSubscribed()
  subs.add(cb)
  return () => subs.delete(cb)
}

export function getDiag(): DiagState {
  return state
}

/** 启动后按需刷新一次（初始挂载时拉取主进程已有轮次） */
export async function refreshDiag(): Promise<void> {
  try {
    const r = await window.ipInsight.latestDiag()
    if (r.ok) {
      state = { ...state, run: r.run, summary: r.summary }
      emitChange()
    }
  } catch {
    /* 主进程不可达时保持现状 */
  }
}

export async function startDiag(modules: DiagModuleId[]): Promise<string | null> {
  state = { ...state, starting: true }
  emitChange()
  try {
    const r = await window.ipInsight.startDiag({ modules, origin: 'network' })
    if (r.ok && r.runId) {
      state = { ...state, activeRunId: r.runId, starting: false }
      emitChange()
      // 启动即拉取一次骨架，并开启轮询校准直至本轮结束
      setTimeout(() => {
        void refreshDiag()
        ensurePolling()
      }, 60)
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
  } catch {
    /* ignore */
  }
}

export function useDiag(): DiagState {
  return useSyncExternalStore(subscribeDiag, getDiag, getDiag)
}

/** 诊断状态 → 徽章语义类：中性(silver)/正常(绿)/注意(橙)/异常(红)/进行(蓝) */
export function diagBadgeCls(status: DiagStatus | undefined): string {
  switch (status) {
    case 'success':
      return 'badge-good'
    case 'partial':
      return 'badge-warn'
    case 'failed':
    case 'timeout':
      return 'badge-bad'
    case 'running':
      return 'badge-info'
    default:
      // pending / canceled / skipped / unsupported / undefined → 中性
      return 'badge-neutral'
  }
}

/** 模块完成状态集合（用于判断运行中） */
export const DIAG_RUNNING: DiagStatus[] = ['running', 'pending']

export function diagRunning(state: DiagState): boolean {
  if (state.starting) return true
  if (!state.run) return false
  if (state.run.status === 'running') return true
  return state.run.modules.some((m) => m.status === 'running')
}

/** 模块探测项计数（成功/总数） */
export function moduleProbeStats(run: DiagRun | null, id: DiagModuleId): { ok: number; total: number } {
  const m = run?.modules.find((x) => x.id === id)
  if (!m) return { ok: 0, total: 0 }
  return { ok: m.probes.filter((p) => p.status === 'success').length, total: m.probes.length }
}
