import { Check, FolderOpen, X } from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'
import type { ExportFormat, ReportModel } from '@shared/types'
import { useLang } from '../i18n'
import type { TKey } from '../i18n'

// =============================================================
// 导出报告对话框（文档 §17：HTML / PDF / JSON / TXT）
// 报告包含：检测时间、IP、四个数据源、原始结果、多源对比、AI 分析（如有）。
// 保存路径由系统保存对话框决定；导出完成可一键定位文件。
// =============================================================

const FORMATS: { id: ExportFormat; label: string; descKey: TKey }[] = [
  { id: 'html', label: 'HTML', descKey: 'components.exportDialog.formats.html' },
  { id: 'pdf', label: 'PDF', descKey: 'components.exportDialog.formats.pdf' },
  { id: 'json', label: 'JSON', descKey: 'components.exportDialog.formats.json' },
  { id: 'txt', label: 'TXT', descKey: 'components.exportDialog.formats.txt' }
]

export function ExportDialog({
  model,
  onClose
}: {
  model: ReportModel
  onClose: () => void
}): JSX.Element {
  const { t } = useLang()
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
    else if (!r.canceled) setError(r.error ?? t('components.exportDialog.exportFailed'))
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog card" onClick={(e) => e.stopPropagation()}>
        <div className="card-head" style={{ marginBottom: 8 }}>
          <div className="h2">{t('components.exportDialog.title')}</div>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.action.close')}>
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
                  {t(f.descKey)}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="card card-subtle card-pad-sm" style={{ marginTop: 14 }}>
          <p className="caption" style={{ lineHeight: 1.8 }}>
            {t('components.exportDialog.reportIncludes', {
              start: new Date(model.startedAt).toLocaleString(),
              end: new Date(model.finishedAt).toLocaleString(),
              ip: model.currentIp ?? '—',
              total: model.totalCount,
              aiPart: model.ai
                ? t('components.exportDialog.withAi')
                : t('components.exportDialog.withoutAi')
            })}
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
              <FolderOpen size={14} /> {t('components.exportDialog.locate')}
            </button>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            {t('common.action.close')}
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? t('components.exportDialog.exporting') : savedPath ? t('components.exportDialog.exportAgain') : t('components.exportDialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
