import type { JSX, ReactNode } from 'react'

// =============================================================
// 轻量 Markdown 渲染（AI 输出用）
// 支持：# / ## / ### 标题、【小节】、- / * 列表、1. 有序列表、
//      > 引用、``` 代码块、**加粗**、`行内代码`。
// 纯 React 节点输出，不注入 HTML，避免任何 XSS 面。
// =============================================================

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{tok.slice(2, -2)}</strong>)
    } else {
      nodes.push(
        <code key={`${keyBase}-c${i}`} className="md-code">
          {tok.slice(1, -1)}
        </code>
      )
    }
    last = m.index + tok.length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ text }: { text: string }): JSX.Element {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let code: string[] | null = null
  let key = 0

  const flushList = (): void => {
    if (!list) return
    const L = list
    list = null
    out.push(
      L.ordered ? (
        <ol className="md-ol" key={`l${key++}`}>
          {L.items.map((it, idx) => (
            <li key={idx}>{inline(it, `li${key}-${idx}`)}</li>
          ))}
        </ol>
      ) : (
        <ul className="md-ul" key={`l${key++}`}>
          {L.items.map((it, idx) => (
            <li key={idx}>{inline(it, `li${key}-${idx}`)}</li>
          ))}
        </ul>
      )
    )
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (code) {
      if (line.startsWith('```')) {
        out.push(
          <pre className="md-pre" key={`p${key++}`}>
            {code.join('\n')}
          </pre>
        )
        code = null
      } else {
        code.push(raw)
      }
      continue
    }
    if (line.startsWith('```')) {
      flushList()
      code = []
      continue
    }
    const ulM = line.match(/^\s*[-*]\s+(.*)$/)
    const olM = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ulM || olM) {
      const ordered = !!olM
      const item = (ulM ?? olM)![1]
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push(item)
      continue
    }
    flushList()
    if (!line.trim()) {
      continue
    }
    if (line.startsWith('### ')) {
      out.push(
        <h4 className="md-h3" key={`h${key++}`}>
          {inline(line.slice(4), `h${key}`)}
        </h4>
      )
    } else if (line.startsWith('## ')) {
      out.push(
        <h3 className="md-h2" key={`h${key++}`}>
          {inline(line.slice(3), `h${key}`)}
        </h3>
      )
    } else if (line.startsWith('# ')) {
      out.push(
        <h2 className="md-h1" key={`h${key++}`}>
          {inline(line.slice(2), `h${key}`)}
        </h2>
      )
    } else if (/^【.+】$/.test(line.trim())) {
      out.push(
        <h3 className="md-h2" key={`h${key++}`}>
          {inline(line.trim(), `h${key}`)}
        </h3>
      )
    } else if (line.startsWith('> ')) {
      out.push(
        <blockquote className="md-quote" key={`q${key++}`}>
          {inline(line.slice(2), `q${key}`)}
        </blockquote>
      )
    } else {
      out.push(
        <p className="md-p" key={`p${key++}`}>
          {inline(line, `p${key}`)}
        </p>
      )
    }
  }
  flushList()
  if (code) {
    out.push(
      <pre className="md-pre" key={`p${key++}`}>
        {code.join('\n')}
      </pre>
    )
  }
  return <div className="md">{out}</div>
}
