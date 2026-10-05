import { useCallback, useState } from 'react'
import type { HistoryRecord, NormalizedIPResult } from '@shared/types'
import {
  aggregateField,
  exitGroups,
  levelOf,
  median,
  sourceRisks
} from '../utils/aggregate'

// 多源编排：顺序运行 4 个数据源，单源失败不影响后续；真实数据，不伪造。
// 检测完成后按设置（privacy.historyEnabled）自动写入本地历史记录，
// 并记住 lastRecordId 供 AI 报告回写与报告导出使用。

export type StepStatus = 'waiting' | 'running' | 'ok' | 'fail'

export interface SourceStep {
  key: string
  name: string
  status: StepStatus
  durationMs?: number
  result?: NormalizedIPResult
}

export type RunPhase = 'idle' | 'running' | 'done'

const INITIAL: SourceStep[] = [
  { key: 'ping0', name: 'Ping0', status: 'waiting' },
  { key: 'netcoffee', name: 'Net.Coffee', status: 'waiting' },
  { key: 'netcoffee_gpt', name: 'Net.Coffee GPT', status: 'waiting' },
  { key: 'ippure', name: 'IPPure', status: 'waiting' }
]

export function useDetection() {
  const [phase, setPhase] = useState<RunPhase>('idle')
  const [steps, setSteps] = useState<SourceStep[]>(INITIAL)
  const [currentIp, setCurrentIp] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [finishedAt, setFinishedAt] = useState<string | null>(null)
  const [lastRecordId, setLastRecordId] = useState<string | null>(null)
  const [aiReport, setAiReport] = useState<string | null>(null)

  const patch = useCallback(
    (key: string, p: Partial<SourceStep>) =>
      setSteps((prev) =>
        prev.map((s) => (s.key === key ? { ...s, ...p } : s))
      ),
    []
  )

  const run = useCallback(async () => {
    setSteps(INITIAL.map((s) => ({ ...s })))
    setPhase('running')
    setCurrentIp(null)
    setAiReport(null)
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

    const done: SourceStep[] = []
    let firstIp: string | null = null

    const runOne = async (key: string, fn: () => Promise<NormalizedIPResult>): Promise<void> => {
      patch(key, { status: 'running' })
      const t0 = performance.now()
      const name = INITIAL.find((s) => s.key === key)?.name ?? key
      try {
        const r = await fn()
        const durationMs = Math.round(performance.now() - t0)
        patch(key, {
          status: r.ok ? 'ok' : 'fail',
          durationMs,
          result: r
        })
        done.push({ key, name, status: r.ok ? 'ok' : 'fail', durationMs, result: r })
        if (r.ok && r.ip && !firstIp) {
          firstIp = r.ip
          setCurrentIp(r.ip)
        }
      } catch (e) {
        const durationMs = Math.round(performance.now() - t0)
        patch(key, { status: 'fail', durationMs })
        done.push({ key, name, status: 'fail', durationMs })
        void e
      }
    }

    // 设置联动：并行 / 顺序检测
    let parallel = false
    try {
      const st = await window.ipInsight.getSettings()
      parallel = !!st.settings?.detection?.parallel
    } catch {
      parallel = false
    }
    if (parallel) {
      await Promise.all(runners.map(([key, fn]) => runOne(key, fn)))
      if (!firstIp) {
        const first = runners
          .map(([key]) => done.find((d) => d.key === key))
          .find((d) => d?.result?.ok && !!d?.result?.ip)
        if (first?.result?.ip) {
          firstIp = first.result.ip
          setCurrentIp(firstIp)
        }
      }
    } else {
      for (const [key, fn] of runners) {
        await runOne(key, fn)
      }
    }
    const finishIso = new Date().toISOString()
    setFinishedAt(finishIso)
    setPhase('done')

    // 历史记录：受设置开关控制；失败不影响本次检测结果展示
    void (async () => {
      try {
        const okResults = done
          .filter((s) => s.status === 'ok' && s.result)
          .map((s) => s.result as NormalizedIPResult)
        const { main } = exitGroups(okResults)
        const mrs = main?.rs ?? okResults
        const risks = sourceRisks(mrs)
          .map((s) => s.risk)
          .filter((n): n is number => n != null)
        const ov = median(risks)
        const netAgg = aggregateField(mrs, (r) => {
          if (r.flags?.residential) return '住宅'
          if (r.flags?.datacenter) return '数据中心'
          if (r.flags?.hosting) return '托管'
          return null
        })
        const record: HistoryRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          startedAt: startIso,
          finishedAt: finishIso,
          currentIp: firstIp ?? undefined,
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
          results: okResults
        }
        const saved = await window.ipInsight.saveHistory(record)
        if (saved.ok && saved.id) setLastRecordId(saved.id)
      } catch {
        /* 历史写入失败不影响主流程 */
      }
    })()
  }, [patch])

  // 载入历史记录到当前视图：各分析页（IP 信息 / 风险 / 指纹…）随即展示该次数据
  const loadRecord = useCallback((rec: HistoryRecord) => {
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
    setSteps(loaded)
    setCurrentIp(rec.currentIp ?? null)
    setStartedAt(rec.startedAt)
    setFinishedAt(rec.finishedAt)
    setAiReport(rec.aiReport ?? null)
    setLastRecordId(rec.id)
    setPhase('done')
  }, [])

  const successCount = steps.filter((s) => s.status === 'ok').length
  const reset = useCallback(() => {
    setPhase('idle')
    setSteps(INITIAL.map((s) => ({ ...s })))
    setCurrentIp(null)
    setStartedAt(null)
    setFinishedAt(null)
    setAiReport(null)
  }, [])

  return {
    phase,
    steps,
    currentIp,
    successCount,
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
