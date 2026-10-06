import type { AiAnalyzeResponse } from '@shared/types'
import { tt } from '../i18n'

// =============================================================
// AI 分析状态（模块级单例）
// 与 DetectionContext / speedtestStore 同样的思路：分析耗时较长，
// 状态提升到模块层，切换页面不丢结果、不重复请求。
// =============================================================

export type AiPhase = 'idle' | 'running' | 'done' | 'error'
export type AiStage = 'connect' | 'connected' | 'streaming'

export interface AiState {
  phase: AiPhase
  stage: AiStage
  text: string
  error: string | null
  meta: { provider: string; model: string; ms: number } | null
  startedAt: number | null
}

let state: AiState = {
  phase: 'idle',
  stage: 'connect',
  text: '',
  error: null,
  meta: null,
  startedAt: null
}
const listeners = new Set<() => void>()
let running = false
let unsubChunk: (() => void) | null = null
let unsubStage: (() => void) | null = null

function set(patch: Partial<AiState>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function getAi(): AiState {
  return state
}

export function subscribeAi(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function startAnalysis(
  results: Parameters<typeof window.ipInsight.analyzeAi>[0]['results'],
  consistency: string
): Promise<AiAnalyzeResponse> {
  if (running) return Promise.resolve({ ok: false, error: tt('misc.ai.alreadyRunning') })
  running = true
  set({
    phase: 'running',
    stage: 'connect',
    text: '',
    error: null,
    meta: null,
    startedAt: Date.now()
  })
  if (!unsubChunk) {
    unsubChunk = window.ipInsight.onAiChunk((d) => {
      set({ text: state.text + d, stage: 'streaming' })
    })
  }
  if (!unsubStage) {
    unsubStage = window.ipInsight.onAiStage((s) => {
      if (s === 'connected') set({ stage: 'connected' })
      if (s === 'streaming') set({ stage: 'streaming' })
    })
  }
  const t0 = Date.now()
  return window.ipInsight
    .analyzeAi({ results, consistency })
    .then((res: AiAnalyzeResponse) => {
      running = false
      if (res.ok && res.text) {
        set({
          phase: 'done',
          text: res.text,
          meta: {
            provider: res.provider ?? '',
            model: res.model ?? '',
            ms: res.ms ?? Date.now() - t0
          }
        })
      } else {
        set({
          phase: 'error',
          text: res.partial ?? state.text,
          error: res.error ?? tt('misc.ai.failed'),
          meta: res.provider
            ? { provider: res.provider, model: res.model ?? '', ms: res.ms ?? Date.now() - t0 }
            : null
        })
      }
      return res
    })
    .catch((e: unknown) => {
      running = false
      const msg = e instanceof Error ? e.message : String(e)
      set({ phase: 'error', error: msg })
      return { ok: false, error: msg }
    })
}

export function resetAnalysis(): void {
  if (running) return
  set({ phase: 'idle', text: '', error: null, meta: null })
}
