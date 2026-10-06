import type { NormalizedIPResult } from '@shared/types'
import { tt } from '../i18n'

// =============================================================
// 本机测速状态（模块级单例）
// 与 DetectionContext 同样的思路：测速是独立动作、耗时 1-2 分钟，
// 状态提升到模块层，切换页面不丢数据、不重复发起。
// 只消费真实 IPC 结果；阶段来自隐藏页引擎的真实回传，不伪造进度。
// =============================================================

export type SpeedStatus = 'idle' | 'running' | 'done' | 'error'

export interface SpeedState {
  status: SpeedStatus
  // 隐藏页测速引擎当前阶段：'' | starting | running | latency | download | upload | finished | error
  phase: string
  startedAt: number | null
  finishedAt: number | null
  result: NormalizedIPResult | null
  error: string | null
}

let state: SpeedState = {
  status: 'idle',
  phase: '',
  startedAt: null,
  finishedAt: null,
  result: null,
  error: null
}

const listeners = new Set<() => void>()
let logUnsub: (() => void) | null = null
let running = false

function set(patch: Partial<SpeedState>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function ensureLogSubscription(): void {
  if (logUnsub) return
  // 只认测速独有的「阶段: 」前缀，避免与四源检测日志串味
  logUnsub = window.ipInsight.onDetectLog((m) => {
    if (m.startsWith('阶段: ')) set({ phase: m.slice('阶段: '.length) })
  })
}

export function startSpeedtest(): void {
  if (running) return
  running = true
  ensureLogSubscription()
  set({
    status: 'running',
    phase: '',
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null
  })
  window.ipInsight
    .detectSpeedtest()
    .then((r) => {
      running = false
      if (r.ok) {
        set({ status: 'done', phase: 'finished', finishedAt: Date.now(), result: r })
      } else {
        set({
          status: 'error',
          phase: 'error',
          finishedAt: Date.now(),
          result: r,
          error: r.error ?? tt('misc.speedtest.failed')
        })
      }
    })
    .catch((e: unknown) => {
      running = false
      set({
        status: 'error',
        phase: 'error',
        finishedAt: Date.now(),
        error: e instanceof Error ? e.message : String(e)
      })
    })
}

export function subscribeSpeedtest(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getSpeedtest(): SpeedState {
  return state
}
