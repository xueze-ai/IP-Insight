import { net } from 'electron'
import { chatCompletionsUrl } from '@shared/aiProviders'

// =============================================================
// AI 客户端：OpenAI 兼容 Chat Completions（SSE 流式）
// 主进程 net.fetch：遵循系统代理、不受渲染层 CORS 限制。
// 失败如实抛错（HTTP 状态 + 服务端报文摘要），不伪造回复。
// =============================================================

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export interface ChatResult {
  text: string
  finishReason: string | null // 'stop' | 'length' | …
}

export interface ChatStreamOptions {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  messages: ChatMessage[]
  // 空闲超时：连续这么久没收到任何数据才判定超时（收到数据即重置）。
  // 长报告生成期间只要模型持续输出就不会被中断。
  idleTimeoutMs?: number
  onChunk: (delta: string) => void
  onStage?: (stage: 'connected' | 'streaming') => void
}

export async function chatStream(opts: ChatStreamOptions): Promise<ChatResult> {
  const idleMs = opts.idleTimeoutMs ?? 90000
  const ctrl = new AbortController()
  let timer = setTimeout(() => ctrl.abort(), idleMs)
  const bump = (): void => {
    clearTimeout(timer)
    timer = setTimeout(() => ctrl.abort(), idleMs)
  }
  let res: Response
  try {
    res = await net.fetch(chatCompletionsUrl(opts.baseUrl), {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.apiKey}`
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: true
      })
    })
  } catch (e) {
    clearTimeout(timer)
    const err = e as Error
    const msg =
      err.name === 'AbortError' ? `请求超时（${idleMs / 1000}s 内无响应）` : err.message
    throw new Error(`网络请求失败：${msg}`)
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    clearTimeout(timer)
    throw new Error(`HTTP ${res.status}：${text.slice(0, 300)}`)
  }
  opts.onStage?.('connected')

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let full = ''
  let finishReason: string | null = null
  let streamed = false
  bump() // 连接建立后开始计空闲超时
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bump() // 每收到数据即重置空闲超时
      buf += dec.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') {
          clearTimeout(timer)
          return { text: full, finishReason }
        }
        try {
          const j = JSON.parse(payload) as {
            choices?: {
              delta?: { content?: string }
              message?: { content?: string }
              finish_reason?: string
            }[]
          }
          const delta =
            j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? ''
          if (delta) {
            if (!streamed) {
              streamed = true
              opts.onStage?.('streaming')
            }
            full += delta
            opts.onChunk(delta)
          }
          const fr = j.choices?.[0]?.finish_reason
          if (fr) finishReason = fr
        } catch {
          /* 忽略非 JSON 心跳行 */
        }
      }
    }
  } catch (e) {
    const err = e as Error
    throw new Error(
      err.name === 'AbortError'
        ? `流式中断：提供商已 ${idleMs / 1000}s 未返回任何新内容`
        : `流式中断：${err.message}`
    )
  } finally {
    clearTimeout(timer)
  }
  return { text: full, finishReason }
}
