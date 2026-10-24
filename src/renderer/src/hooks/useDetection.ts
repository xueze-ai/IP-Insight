import { useCallback, useRef, useState } from 'react'
import type { HistoryRecord, NormalizedIPResult } from '@shared/types'
import type { DiagRunSummary } from '@shared/diag'
import {
  aggregateField,
  exitGroups,
  levelOf,
  median,
  sourceRisks
} from '../utils/aggregate'
import { tt } from '../i18n'

// =============================================================
// 多源编排：运行 4 个数据源 + 可选轻量出口诊断（Sukka 模块），
// 单源失败不影响其他源；失败/部分成功结果同样保留。
// 检测完成后按设置（privacy.historyEnabled）自动写入本地历史。
// 主出口规则（稳定，不随并行请求返回顺序变化）：
//   取「覆盖源数最多」的 IP；并列时按源声明顺序（ping0 → netcoffee → gpt → ippure）
//   取最早出现者；ChatGPT 分流出口天然单源，不会抢占主出口。
// 轮次隔离：epoch 自增；重跑 / 载入历史后，旧轮次的迟到结果全部丢弃。
// =============================================================

export type StepStatus = 'waiting' | 'running' | 'ok' | 'fail'

export interface SourceStep {
  key: string
  name: string
  status: StepStatus
  durationMs?: number
  result?: NormalizedIPResult
}

export type RunPhase = 'idle' | 'running' | 'done'
/** 当前视图数据来源：live=本次实时检测 history=载入的历史记录 */
export type ViewSource = 'live' | 'history'

const INITIAL: SourceStep[] = [
  { key: 'ping0', name: 'Ping0', status: 'waiting' },
  { key: 'netcoffee', name: 'Net.Coffee', status: 'waiting' },
  { key: 'netcoffee_gpt', name: 'Net.Coffee GPT', status: 'waiting' },
  { key: 'ippure', name: 'IPPure', status: 'waiting' }
]

/** 主出口稳定选择：覆盖源最多 → 源顺序最早 */
function pickMainIp(results: NormalizedIPResult[], runnerOrder: string[]): string | null {
  const byIp = new Map<string, number>()
  const firstSeen = new Map<string, number>()
  for (const r of results) {
    if (!r.ok || !r.ip) continue
    byIp.set(r.ip, (byIp.get(r.ip) ?? 0) + 1)
    if (!firstSeen.has(r.ip)) {
      const oi = runnerOrder.indexOf(r.provider.id)
      firstSeen.set(r.ip, oi < 0 ? 99 : oi)
    }
  }
  if (!byIp.size) return null
  let best: string | null = null
  let bestCount = 0
  let bestOrder = 99
  for (const [ip, count] of byIp) {
    const order = firstSeen.get(ip) ?? 99
    if (count > bestCount || (count === bestCount && order < bestOrder)) {
      best = ip
      bestCount = count
      bestOrder = order
    }
  }
  return best
}

export function useDetection() {
  const [phase, setPhase] = useState<RunPhase>('idle')
  const [steps, setSteps] = useState<SourceStep[]>(INITIAL)
  const [currentIp, setCurrentIp] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [finishedAt, setFinishedAt] = useState<string | null>(null)
  const [lastRecordId, setLastRecordId] = useState<string | null>(null)
  const [aiReport, setAiReport] = useState<string | null>(null)
  const [diag, setDiag] = useState<DiagRunSummary | null>(null)
  const [viewSource, setViewSource] = useState<ViewSource>('live')
  const epochRef = useRef(0)

  const patch = useCallback(
    (key: string, p: Partial<SourceStep>) =>
      setSteps((prev) =>
        prev.map((s) => (s.key === key ? { ...s, ...p } : s))
      ),
    []
  )

  const run = useCallback(async () => {
    const epoch = ++epochRef.current
    setViewSource('live')
    setSteps(INITIAL.map((s) => ({ ...s })))
    setPhase('running')
    setCurrentIp(null)
    setAiReport(null)
    setDiag(null)
    const startIso = new Date().toISOString()
    setStartedAt(startIso)
    setFinishedAt(null)

    const api = window.ipInsight
    const runners: [string, () => Promise<NormalizedIPResult>][] = [
      ['ping0', () => api.detectPing0()],
      ['netcoffee', () => api.detectNetcoffee()],
      ['netcoffee_gpt', () => api.detectNetcoffeeGpt()],
      ['ippure', () => api.detectIppure()]
    ]
    const runnerOrder = runners.map(([k]) => k)

    const done: SourceStep[] = []
    // 设置：并行 / 顺序检测 + 轻量出口诊断开关
    let parallel = false
    let lightProbe = true
    try {
      const st = await api.getSettings()
      parallel = !!st.settings?.detection?.parallel
      lightProbe = st.settings?.detection?.lightExitProbe !== false
    } catch {
      parallel = false
    }

    // 轻量出口诊断：与多源检测并行启动（失败/取消均不影响主流程）
    if (lightProbe) {
      void api
        .startDiag({ modules: ['publicIp'], origin: 'dashboard' })
        .catch(() => null)
    }

    const runOne = async (key: string, fn: () => Promise<NormalizedIPResult>): Promise<void> => {
      if (epochRef.current !== epoch) return // 已被新一轮/历史载入取代
      patch(key, { status: 'running' })
      const t0 = performance.now()
      const name = INITIAL.find((s) => s.key === key)?.name ?? key
      try {
        const r = await fn()
        const durationMs = Math.round(performance.now() - t0)
        if (epochRef.current !== epoch) return
        patch(key, { status: r.ok ? 'ok' : 'fail', durationMs, result: r })
        // 全部结果保留（含失败），历史与报告需要完整证据
        done.push({ key, name, status: r.ok ? 'ok' : 'fail', durationMs, result: r })
      } catch (e) {
        const durationMs = Math.round(performance.now() - t0)
        if (epochRef.current !== epoch) return
        patch(key, { status: 'fail', durationMs })
        done.push({ key, name, status: 'fail', durationMs, result: undefined })
        void e
      }
    }

    if (parallel) {
      await Promise.all(runners.map(([key, fn]) => runOne(key, fn)))
    } else {
      for (const [key, fn] of runners) {
        await runOne(key, fn)
      }
    }
    if (epochRef.current !== epoch) return
    const finishIso = new Date().toISOString()
    setFinishedAt(finishIso)
    setPhase('done')

    // 主出口：稳定规则（覆盖源最多 → 源顺序），不随返回顺序变化
    const okResults = done
      .map((s) => s.result)
      .filter((r): r is NormalizedIPResult => !!r && r.ok)
    const mainIp = pickMainIp(okResults, runnerOrder)
    if (mainIp) setCurrentIp(mainIp)

    // 等待轻量诊断收尾（最多 12s），随后取摘要并入历史
    let diagSummary: DiagRunSummary | null = null
    if (lightProbe) {
      for (let i = 0; i < 12; i++) {
        if (epochRef.current !== epoch) return
        await new Promise((r) => setTimeout(r, 1000))
        try {
          const lr = await api.latestDiag()
          const run = lr.run
          if (run && ['success', 'partial', 'failed', 'timeout', 'canceled'].includes(run.status)) {
            diagSummary = lr.summary
            break
          }
        } catch {
          break
        }
      }
      if (epochRef.current !== epoch) return
      setDiag(diagSummary)
    }

    // 历史记录：受设置开关控制；失败/部分成功来源同样保留
    void (async () => {
      try {
        const { main } = exitGroups(okResults)
        const mrs = main?.rs ?? okResults
        const risks = sourceRisks(mrs)
          .map((s) => s.risk)
          .filter((n): n is number => n != null)
        const ov = median(risks)
        const netAgg = aggregateField(mrs, (r) => {
          if (r.flags?.residential) return tt('misc.netType.residential')
          if (r.flags?.datacenter) return tt('misc.netType.datacenter')
          if (r.flags?.hosting) return tt('misc.netType.hosting')
          return null
        })
        const record: HistoryRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          startedAt: startIso,
          finishedAt: finishIso,
          currentIp: mainIp ?? undefined,
          successCount: okResults.length,
          totalCount: done.length,
          riskLevel: ov != null ? levelOf(ov).cn : null,
          riskValue: ov,
          netType: netAgg.state === 'agree' ? String(netAgg.value) : null,
          sources: done.map((s) => ({
            key: s.key,
            name: s.name,
            ok: s.status === 'ok',
            durationMs: s.durationMs,
            error: s.result?.error
          })),
          // 0.2.2：全部结果入库（含失败），不丢弃部分成功数据
          results: done
            .map((s) => s.result)
            .filter((r): r is NormalizedIPResult => !!r),
          diag: diagSummary ?? undefined
        }
        const saved = await api.saveHistory(record)
        if (saved.ok && saved.id) setLastRecordId(saved.id)
      } catch {
        /* 历史写入失败不影响主流程 */
      }
    })()
  }, [patch])

  // 载入历史记录到当前视图：各分析页（IP 信息 / 风险 / 指纹…）随即展示该次数据
  const loadRecord = useCallback((rec: HistoryRecord) => {
    ++epochRef.current // 旧轮次迟到结果作废
    setViewSource('history')
    const loaded: SourceStep[] = rec.sources.map((s) => {
      const result = rec.results.find((r) => r.provider.id === s.key)
      return {
        key: s.key,
        name: s.name,
        status: s.ok && result ? 'ok' : 'fail',
        durationMs: s.durationMs,
        result
      }
    })
    setSteps(loaded.length ? loaded : INITIAL)
    setCurrentIp(rec.currentIp ?? null)
    setStartedAt(rec.startedAt)
    setFinishedAt(rec.finishedAt)
    setAiReport(rec.aiReport ?? null)
    setDiag(rec.diag ?? null)
    setLastRecordId(rec.id)
    setPhase('done')
  }, [])

  const successCount = steps.filter((s) => s.status === 'ok').length
  const totalCount = steps.length
  const reset = useCallback(() => {
    ++epochRef.current
    setViewSource('live')
    setPhase('idle')
    setSteps(INITIAL.map((s) => ({ ...s })))
    setCurrentIp(null)
    setStartedAt(null)
    setFinishedAt(null)
    setAiReport(null)
    setDiag(null)
  }, [])

  return {
    phase,
    steps,
    currentIp,
    successCount,
    totalCount,
    diag,
    setDiag,
    viewSource,
    run,
    reset,
    startedAt,
    finishedAt,
    lastRecordId,
    aiReport,
    setAiReport,
    loadRecord
  }
}
