import { Check, FolderOpen, X } from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'
import type { ExportFormat, ReportModel } from '@shared/types'

// =============================================================
// 导出报告对话框（文档 §17：HTML / PDF / JSON / TXT）
// 报告包含：检测时间、IP、四个数据源、原始结果、多源对比、AI 分析（如有）。
// 保存路径由系统保存对话框决定；导出完成可一键定位文件。
// =============================================================

const FORMATS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: 'html', label: 'HTML', desc: '自包含网页，浏览器打开，含可折叠原始结果' },
  { id: 'pdf', label: 'PDF', desc: 'A4 排版文档，与 HTML 版式一致，适合存档分享' },
  { id: 'json', label: 'JSON', desc: '完整结构化数据，含各源原始结果，适合二次处理' },
  { id: 'txt', label: 'TXT', desc: '纯文本报告，适合快速阅读与粘贴' }
]

export function ExportDialog({
  model,
  onClose
}: {
  model: ReportModel
  onClose: () => void
}): JSX.Element {
  const [format, setFormat] = useState<ExportFormat>('html')
  const [busy, setBusy] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const r = await window.ipInsight.exportReport({ model, format })
    setBusy(false)
    if (r.ok && r.path) setSavedPath(r.path)
    else if (!r.canceled) setError(r.error ?? '导出失败')
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog card" onClick={(e) => e.stopPropagation()}>
        <div className="card-head" style={{ marginBottom: 8 }}>
          <div className="h2">导出检测报告</div>
          <button className="btn-icon" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              className={'fmt-row' + (format === f.id ? ' on' : '')}
              onClick={() => setFormat(f.id)}
            >
              <span className={'fmt-radio' + (format === f.id ? ' on' : '')} />
              <span style={{ minWidth: 0 }}>
                <span className="title" style={{ fontSize: 13.5 }}>{f.label}</span>
                <span className="caption" style={{ display: 'block', marginTop: 2 }}>
                  {f.desc}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="card card-subtle card-pad-sm" style={{ marginTop: 14 }}>
          <p className="caption" style={{ lineHeight: 1.8 }}>
            报告包含：检测时间（{new Date(model.startedAt).toLocaleString()} —{' '}
            {new Date(model.finishedAt).toLocaleString()}）、公网 IP（
            {model.currentIp ?? '—'}）、{model.totalCount} 个数据源状态、
            关键字段多源聚合、多源对比、各源原始结果
            {model.ai ? '、AI 综合分析' : '（本次未包含 AI 分析）'}。
          </p>
        </div>

        {error && (
          <p className="small" style={{ color: 'var(--bad)', marginTop: 10 }}>
            {error}
          </p>
        )}
        {savedPath && (
          <div
            className="card card-subtle card-pad-sm"
            style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <Check size={16} style={{ color: 'var(--good)', flex: '0 0 auto' }} />
            <span className="mono caption" style={{ flex: 1, wordBreak: 'break-all' }}>
              {savedPath}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void window.ipInsight.revealFile(savedPath)}
            >
              <FolderOpen size={14} /> 定位
            </button>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? '导出中……' : savedPath ? '再次导出' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
