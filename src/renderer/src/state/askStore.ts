import type { AiAnalyzeResponse } from '@shared/types'
import { tt } from '../i18n'

// =============================================================
// 场景咨询状态（模块级单例）
// 咨询耗时较长，用户可能中途切页：输入草稿、流式回答、错误都保存在模块层，
// 切换页面不丢失；流式监听注册在 store 的 ask 流程内，随 promise 生命周期，
// 组件卸载不会中断流式接收，切回页面可看到完整结果。
// =============================================================

export type AskPhase = 'idle' | 'asking' | 'done' | 'error'

export interface AskState {
  phase: AskPhase
  /** 输入框草稿：未发送也保留，切页不丢 */
  question: string
  /** 本次实际发出的问题 */
  askedQuestion: string
  answer: string
  error: string | null
  startedAt: number | null
}

let state: AskState = {
  phase: 'idle',
  question: '',
  askedQuestion: '',
  answer: '',
  error: null,
  startedAt: null
}
const listeners = new Set<() => void>()
let asking = false

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
  question: string
): Promise<AiAnalyzeResponse> {
  const q = question.trim()
  if (!q) return Promise.resolve({ ok: false, error: '' })
  if (asking) return Promise.resolve({ ok: false, error: tt('misc.ai.alreadyRunning') })
  asking = true
  set({
    phase: 'asking',
    askedQuestion: q,
    answer: '',
    error: null,
    startedAt: Date.now()
  })
  // 监听注册在 store 流程内：组件卸载不取消订阅，流式继续写入 store
  const off = window.ipInsight.onAskChunk((d) => {
    set({ answer: state.answer + d })
  })
  return window.ipInsight
    .askAi({ results, question: q, consistency })
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
  set({ phase: 'idle', askedQuestion: '', answer: '', error: null, startedAt: null })
}
