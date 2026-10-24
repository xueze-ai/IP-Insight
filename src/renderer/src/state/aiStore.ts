import type { AiAnalyzeResponse } from '@shared/types'
import { tt } from '../i18n'

// =============================================================
// AI 分析状态（模块级单例）
// · 请求 ID 绑定：流式片段携带 reqId，只有「当前视图的请求」才写入展示文本；
//   切换检测 / 载入历史后，旧请求的迟到片段不再污染新视图。
// · 历史回写由页面在完成时按「发起时捕获的 recordId」执行（见 AiAnalysis）。
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
  /** 当前视图绑定的请求 ID */
  reqId: string | null
}

let state: AiState = {
  phase: 'idle',
  stage: 'connect',
  text: '',
  error: null,
  meta: null,
  startedAt: null,
  reqId: null
}
const listeners = new Set<() => void>()
let running = false
let unsubChunk: (() => void) | null = null
let unsubStage: (() => void) | null = null
let reqSeq = 0

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

function newReqId(): string {
  reqSeq += 1
  return `ai-${Date.now().toString(36)}-${reqSeq}`
}

export function startAnalysis(
  results: Parameters<typeof window.ipInsight.analyzeAi>[0]['results'],
  consistency: string,
  diagLines?: string[]
): Promise<AiAnalyzeResponse> {
  if (running) return Promise.resolve({ ok: false, error: tt('misc.ai.alreadyRunning') })
  const reqId = newReqId()
  running = true
  set({
    phase: 'running',
    stage: 'connect',
    text: '',
    error: null,
    meta: null,
    startedAt: Date.now(),
    reqId
  })
  if (!unsubChunk) {
    unsubChunk = window.ipInsight.onAiChunk((e) => {
      if (e.reqId && state.reqId && e.reqId !== state.reqId) return // 旧请求的迟到片段
      set({ text: state.text + e.delta, stage: 'streaming' })
    })
  }
  if (!unsubStage) {
    unsubStage = window.ipInsight.onAiStage((e) => {
      if (e.reqId && state.reqId && e.reqId !== state.reqId) return
      if (e.stage === 'connected') set({ stage: 'connected' })
      if (e.stage === 'streaming') set({ stage: 'streaming' })
    })
  }
  const t0 = Date.now()
  return window.ipInsight
    .analyzeAi({ reqId, results, consistency, diagLines })
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
  set({ phase: 'idle', text: '', error: null, meta: null, reqId: null })
}
