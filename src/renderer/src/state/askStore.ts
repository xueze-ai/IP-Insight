import type { AiAnalyzeResponse } from '@shared/types'
import { tt } from '../i18n'

// =============================================================
// 场景咨询状态（模块级单例）
// 请求 ID 绑定同 aiStore：切换检测 / 载入历史后，
// 旧请求的迟到流式片段不污染新视图。
// =============================================================

export type AskPhase = 'idle' | 'asking' | 'done' | 'error'

export interface AskState {
  phase: AskPhase
  question: string
  askedQuestion: string
  answer: string
  error: string | null
  startedAt: number | null
  reqId: string | null
}

let state: AskState = {
  phase: 'idle',
  question: '',
  askedQuestion: '',
  answer: '',
  error: null,
  startedAt: null,
  reqId: null
}
const listeners = new Set<() => void>()
let asking = false
let reqSeq = 0

function set(patch: Partial<AskState>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function getAsk(): AskState {
  return state
}

export function subscribeAsk(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** 输入草稿（未发送）：切页保留 */
export function setAskQuestion(q: string): void {
  set({ question: q })
}

export function askQuestion(
  results: Parameters<typeof window.ipInsight.askAi>[0]['results'],
  consistency: string,
  question: string,
  diagLines?: string[]
): Promise<AiAnalyzeResponse> {
  const q = question.trim()
  if (!q) return Promise.resolve({ ok: false, error: '' })
  if (asking) return Promise.resolve({ ok: false, error: tt('misc.ai.alreadyRunning') })
  asking = true
  reqSeq += 1
  const reqId = `ask-${Date.now().toString(36)}-${reqSeq}`
  set({
    phase: 'asking',
    askedQuestion: q,
    answer: '',
    error: null,
    startedAt: Date.now(),
    reqId
  })
  // 监听注册在 store 流程内：组件卸载不取消订阅，流式继续写入 store
  const off = window.ipInsight.onAskChunk((e) => {
    if (e.reqId && state.reqId && e.reqId !== reqId) return
    set({ answer: state.answer + e.delta })
  })
  return window.ipInsight
    .askAi({ reqId, results, question: q, consistency, diagLines })
    .then((res: AiAnalyzeResponse) => {
      asking = false
      off()
      if (res.ok) {
        set({ phase: 'done', answer: res.text ?? state.answer })
      } else {
        set({ phase: 'error', error: res.error ?? tt('misc.ai.failed') })
      }
      return res
    })
    .catch((e: unknown) => {
      asking = false
      off()
      const msg = e instanceof Error ? e.message : String(e)
      set({ phase: 'error', error: msg })
      return { ok: false, error: msg }
    })
}

export function resetAsk(): void {
  if (asking) return
  set({ phase: 'idle', askedQuestion: '', answer: '', error: null, startedAt: null, reqId: null })
}
