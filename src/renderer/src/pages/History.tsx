import {
  ChevronDown,
  Download,
  History as HistoryIcon,
  LayoutDashboard,
  Settings2,
  Trash2
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { HistoryRecord } from '@shared/types'
import { ExportDialog } from '../components/ExportDialog'
import { useDetectionContext } from '../state/DetectionContext'
import { requestNav } from '../state/navStore'
import { buildReportModel, recordToInput } from '../utils/report'
import { tt, useLang } from '../i18n'

// =============================================================
// 历史记录页（文档 §16 / §17-UI）
// Google 搜索式简洁列表：按日分组（今天 / 昨天 / 日期），
// 行内显示 时间 / IP / 风险 / 网络类型 / 成功源数；点击展开详情；
// 详情可「载入分析页」（各分析页切换为该次数据）、「导出报告」、「删除」。
// 与设置联动：privacy.historyEnabled 关闭时提示并不再写入新记录；
// 保留天数由主进程在写入时清理。
// =============================================================

const RISK_CLS: Record<string, string> = {
  /* 中文模式存储值 */
  低风险: 'badge-good',
  中风险: 'badge-warn',
  高风险: 'badge-bad',
  严重: 'badge-bad',
  /* 英文模式存储值（历史记录按检测时语言存储） */
  'Low Risk': 'badge-good',
  'Medium Risk': 'badge-warn',
  'High Risk': 'badge-bad',
  Critical: 'badge-bad'
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString())
  const yest = dayKey(new Date(Date.now() - 86400000).toISOString())
  if (key === today) return tt('history.today')
  if (key === yest) return tt('history.yesterday')
  return key
}

function hm(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export function History(): JSX.Element {
  const { loadRecord } = useDetectionContext()
  const { t } = useLang()
  const [data, setData] = useState<{
    enabled: boolean
    records: HistoryRecord[]
  } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [exportRec, setExportRec] = useState<HistoryRecord | null>(null)

  const load = useCallback(async () => {
    const r = await window.ipInsight.listHistory()
    setData({ enabled: r.enabled, records: r.records })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const groups: { key: string; records: HistoryRecord[] }[] = []
  if (data) {
    const map = new Map<string, HistoryRecord[]>()
    for (const r of data.records) {
      const k = dayKey(r.startedAt)
      const arr = map.get(k) ?? []
      arr.push(r)
      map.set(k, arr)
    }
    for (const [key, records] of map.entries()) groups.push({ key, records })
    groups.sort((a, b) => (a.key < b.key ? 1 : -1))
  }

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">{t('history.kicker')}</span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}
      >
        <h1 className="h1" style={{ marginTop: 6 }}>{t('common.nav.history')}</h1>
        {data && data.records.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--bad)' }}
            onClick={() => {
              if (window.confirm(t('history.confirmClear'))) {
                void window.ipInsight.clearHistory().then(() => load())
              }
            }}
          >
            <Trash2 size={14} /> {t('history.clearAll')}
          </button>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 8, maxWidth: 620, lineHeight: 1.75 }}>
        {t('history.desc')}
      </p>

      {data && !data.enabled && (
        <div
          className="card card-subtle"
          style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <span className="badge badge-warn">{t('history.disabled')}</span>
          <span className="caption">{t('history.disabledDesc')}</span>
          <button
            className="btn btn-text"
            style={{ marginLeft: 'auto' }}
            onClick={() => requestNav('settings', 'privacy')}
          >
            <Settings2 size={14} /> {t('history.goEnable')}
          </button>
        </div>
      )}

      {!data && (
        <div className="skeleton" style={{ height: 160, marginTop: 24 }} />
      )}

      {data && data.records.length === 0 && (
        <div className="page" style={{ paddingTop: 60, textAlign: 'center' }}>
          <HistoryIcon size={30} style={{ color: 'var(--text-disabled)' }} />
          <p className="muted" style={{ marginTop: 12 }}>
            {t('history.empty')}
          </p>
          <div style={{ marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => requestNav('dashboard')}>
              {t('history.goDetect')}
            </button>
          </div>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.key} style={{ marginTop: 26 }}>
          <div className="caption strong" style={{ marginBottom: 6 }}>
            {dayLabel(g.key)}
          </div>
          <div className="card card-flush">
            {g.records.map((r, i) => {
              const open = openId === r.id
              return (
                <div
                  key={r.id}
                  className="hist-item"
                  style={{ borderBottom: i < g.records.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <button className="hist-main" onClick={() => setOpenId(open ? null : r.id)}>
                    <span className="mono hist-time">{hm(r.startedAt)}</span>
                    <span className="mono hist-ip">{r.currentIp ?? '—'}</span>
                    <span className={'badge ' + (RISK_CLS[r.riskLevel ?? ''] ?? 'badge-neutral')}>
                      {r.riskLevel ?? t('history.noRiskData')}
                    </span>
                    {r.netType && <span className="badge badge-neutral">{r.netType}</span>}
                    <span className="caption" style={{ marginLeft: 'auto' }}>
                      {t('history.sourceCount', { ok: r.successCount, total: r.totalCount })}
                      {r.aiReport ? t('history.withAi') : ''}
                    </span>
                    <ChevronDown
                      size={15}
                      style={{
                        color: 'var(--text-muted)',
                        transform: open ? 'rotate(180deg)' : undefined,
                        transition: 'transform var(--dur-fast) var(--ease)'
                      }}
                    />
                  </button>

                  {open && (
                    <div className="hist-detail">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {r.sources.map((s) => (
                          <div className="caption" key={s.key} style={{ display: 'flex', gap: 10 }}>
                            <span style={{ minWidth: 110, color: 'var(--text-2)' }}>{s.name}</span>
                            <span className={'badge ' + (s.ok ? 'badge-good' : 'badge-bad')}>
                              {s.ok ? t('history.ok') : t('history.fail')}
                            </span>
                            <span className="mono">
                              {s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)}s` : '—'}
                            </span>
                            {s.error && <span style={{ color: 'var(--bad)' }}>{s.error}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="caption" style={{ marginTop: 8 }}>
                        {t('history.detectTime')}{new Date(r.startedAt).toLocaleString()} —{' '}
                        {new Date(r.finishedAt).toLocaleString()}
                        {r.riskValue != null ? t('history.riskValue', { v: r.riskValue.toFixed(0) }) : ''}
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-tonal btn-sm"
                          onClick={() => {
                            loadRecord(r)
                            requestNav('dashboard')
                          }}
                        >
                          <LayoutDashboard size={14} /> {t('history.loadPage')}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setExportRec(r)}>
                          <Download size={14} /> {t('history.exportReport')}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--bad)' }}
                          onClick={() => {
                            if (window.confirm(t('history.confirmDelete'))) {
                              void window.ipInsight.deleteHistory(r.id).then(() => {
                                if (openId === r.id) setOpenId(null)
                                void load()
                              })
                            }
                          }}
                        >
                          <Trash2 size={14} /> {t('common.action.delete')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {exportRec && (
        <ExportDialog
          model={buildReportModel(recordToInput(exportRec))}
          onClose={() => setExportRec(null)}
        />
      )}
    </div>
  )
}
