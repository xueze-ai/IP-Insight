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

// =============================================================
// 历史记录页（文档 §16 / §17-UI）
// Google 搜索式简洁列表：按日分组（今天 / 昨天 / 日期），
// 行内显示 时间 / IP / 风险 / 网络类型 / 成功源数；点击展开详情；
// 详情可「载入分析页」（各分析页切换为该次数据）、「导出报告」、「删除」。
// 与设置联动：privacy.historyEnabled 关闭时提示并不再写入新记录；
// 保留天数由主进程在写入时清理。
// =============================================================

const RISK_CLS: Record<string, string> = {
  低风险: 'badge-good',
  中风险: 'badge-warn',
  高风险: 'badge-bad',
  严重: 'badge-bad'
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString())
  const yest = dayKey(new Date(Date.now() - 86400000).toISOString())
  if (key === today) return '今天'
  if (key === yest) return '昨天'
  return key
}

function hm(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export function History(): JSX.Element {
  const { loadRecord } = useDetectionContext()
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
      <span className="dash-kicker">History · 本地保存</span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}
      >
        <h1 className="h1" style={{ marginTop: 6 }}>历史记录</h1>
        {data && data.records.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--bad)' }}
            onClick={() => {
              if (window.confirm('确定清空全部历史记录？该操作不可撤销。')) {
                void window.ipInsight.clearHistory().then(() => load())
              }
            }}
          >
            <Trash2 size={14} /> 清空全部
          </button>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 8, maxWidth: 620, lineHeight: 1.75 }}>
        每次综合检测完成后自动保存在本机（时间 / IP / 数据源 / 完整结果），
        保留天数与开关在「设置 → 数据与隐私」中配置。
      </p>

      {data && !data.enabled && (
        <div
          className="card card-subtle"
          style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <span className="badge badge-warn">历史记录已关闭</span>
          <span className="caption">新的检测将不再写入历史；以下为关闭前保存的记录。</span>
          <button
            className="btn btn-text"
            style={{ marginLeft: 'auto' }}
            onClick={() => requestNav('settings', 'privacy')}
          >
            <Settings2 size={14} /> 去设置开启
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
            暂无历史记录。完成一次综合检测后会自动保存在这里。
          </p>
          <div style={{ marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => requestNav('dashboard')}>
              去综合检测
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
                      {r.riskLevel ?? '无风险数据'}
                    </span>
                    {r.netType && <span className="badge badge-neutral">{r.netType}</span>}
                    <span className="caption" style={{ marginLeft: 'auto' }}>
                      {r.successCount}/{r.totalCount} 源
                      {r.aiReport ? ' · 含 AI 分析' : ''}
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
                              {s.ok ? '成功' : '失败'}
                            </span>
                            <span className="mono">
                              {s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)}s` : '—'}
                            </span>
                            {s.error && <span style={{ color: 'var(--bad)' }}>{s.error}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="caption" style={{ marginTop: 8 }}>
                        检测时间：{new Date(r.startedAt).toLocaleString()} —{' '}
                        {new Date(r.finishedAt).toLocaleString()}
                        {r.riskValue != null ? ` · 归一风险值 ${r.riskValue.toFixed(0)}/100` : ''}
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-tonal btn-sm"
                          onClick={() => {
                            loadRecord(r)
                            requestNav('dashboard')
                          }}
                        >
                          <LayoutDashboard size={14} /> 载入分析页
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setExportRec(r)}>
                          <Download size={14} /> 导出报告
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--bad)' }}
                          onClick={() => {
                            if (window.confirm('删除这条历史记录？')) {
                              void window.ipInsight.deleteHistory(r.id).then(() => {
                                if (openId === r.id) setOpenId(null)
                                void load()
                              })
                            }
                          }}
                        >
                          <Trash2 size={14} /> 删除
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
