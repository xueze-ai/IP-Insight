import {
  CircleStop,
  Copy as CopyIcon,
  Download,
  Globe,
  Play,
  RefreshCw,
  Search as SearchIcon
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { JSX, ReactNode } from 'react'
import type {
  DiagEvidence,
  DiagModuleId,
  DiagProbe,
  DiagProbeSummary,
  DiagRunSummary,
  DiagStatus,
  SplitCategory
} from '@shared/diag'
import type { HistoryRecord } from '@shared/types'
import {
  activeSummary,
  diagRunning,
  enterLive,
  loadHistoryDiag,
  refreshDiag,
  retryDiagProbes,
  startDiag,
  stopDiag,
  subscribeDiag,
  getDiag
} from '../state/diagStore'
import { tt, useLang } from '../i18n'
import type { TKey } from '../i18n'

// =============================================================
// 网络出口诊断（独立页面）
// 顶部：标题 / 用途 / 开始全部检测 / 停止 / 进度 / 本轮时间。
// 概览：易懂统计（HTTP 出口数 / 取得出口 IP 的网站 / 仅可达 / 失败 / DNS 递归出口单独统计）。
// 四个标签：本机公网 IP / 网站分流（默认）/ CDN 命中节点 / DNS 出口查询；
// 关键结果直接显示，证据与机制说明展开查看；支持搜索 / 筛选 / 分组 / 复制 / 重试。
// 历史模式显示不可变快照（后台实时结果不覆盖）。
// =============================================================

const MODULES: DiagModuleId[] = ['publicIp', 'splitTunnel', 'cdnNode', 'dnsExit']
const ALL_MODULES: DiagModuleId[] = MODULES

/** 默认标签：网站分流测试 */
let lastTab: DiagModuleId = 'splitTunnel'

type Row = DiagProbeSummary & Partial<Pick<DiagProbe, 'evidence' | 'url'>>

const STATUS_KEY: Record<string, TKey> = {
  queued: 'diag.status.queued',
  running: 'diag.status.running',
  success: 'diag.status.success',
  partial: 'diag.status.partial',
  failed: 'diag.status.failed',
  timeout: 'diag.status.timeout',
  canceled: 'diag.status.canceled',
  skipped: 'diag.status.skipped',
  unsupported: 'diag.status.unsupported',
  pending: 'diag.status.pending'
}

function badgeCls(status: string | undefined): string {
  switch (status) {
    case 'success':
      return 'badge-good'
    case 'partial':
      return 'badge-warn'
    case 'failed':
    case 'timeout':
      return 'badge-bad'
    case 'running':
      return 'badge-info'
    default:
      return 'badge-neutral'
  }
}

function fmtMs(ms?: number): string {
  return ms != null ? `${ms} ms` : '—'
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString()
}

function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase()
}

/* ---------- 状态徽章（按模块语境选择文案） ---------- */
function StatusBadge({ status, kind }: { status: DiagStatus; kind: string }): JSX.Element {
  const { t } = useLang()
  let key: TKey = STATUS_KEY[status] ?? 'diag.status.pending'
  if (status === 'success') {
    if (kind === 'splitTunnel') key = 'diag.statusLong.gotExit'
    if (kind === 'cdnNode') key = 'diag.statusLong.gotNode'
    if (kind === 'dnsRow') key = 'diag.statusLong.dnsAnswered'
  }
  return (
    <span className={'badge ' + (status === 'running' ? 'badge-info' : badgeCls(status))}>
      {t(key)}
    </span>
  )
}

/* ---------- 归属单元格 ---------- */
function GeoCell({ row }: { row: Row }): JSX.Element {
  const { t } = useLang()
  if (row.geo) {
    const parts = [row.geo.country, row.geo.city, row.geo.isp].filter(Boolean)
    return <span title={t('diag.geo.source', { source: row.geo.source, time: fmtTime(row.geo.fetchedAt) })}>{parts.join(' · ') || '—'}</span>
  }
  if (row.ip) return <span className="muted">{t('diag.geo.notFetched')}</span>
  return <span className="muted">—</span>
}

/* ---------- 详情展开区 ---------- */
function DetailBox({ row, history }: { row: Row; history: boolean }): JSX.Element {
  const { t } = useLang()
  const mechKey = ('diag.mechNote.' + row.mechKey) as TKey
  const exitKey: TKey | null =
    row.exitSource === 'ns' ? 'diag.dns.exitSourceNs' : row.exitSource === 'txt' ? 'diag.dns.exitSourceTxt' : null
  return (
    <div className="diag-detail">
      <div className="kv">
        {row.url && <div className="kv-row"><div className="kv-key">{t('diag.detail.url')}</div><div className="kv-val mono small" style={{ wordBreak: 'break-all' }}>{row.url}</div></div>}
        <div className="kv-row"><div className="kv-key">{t('diag.detail.method')}</div><div className="kv-val">{row.method}</div></div>
        <div className="kv-row">
          <div className="kv-key">{t('diag.detail.mech')}</div>
          <div className="kv-val">{t(('diag.mech.' + row.mechKey) as TKey)}<span className="muted"> — {t(mechKey)}</span></div>
        </div>
        {row.family && <div className="kv-row"><div className="kv-key">{t('diag.detail.family')}</div><div className="kv-val">{t(('diag.family.' + row.family) as TKey)}</div></div>}
        {row.httpStatus != null && <div className="kv-row"><div className="kv-key">{t('diag.detail.http')}</div><div className="kv-val mono">{row.httpStatus}</div></div>}
        <div className="kv-row"><div className="kv-key">{t('diag.detail.ms')}</div><div className="kv-val">{fmtMs(row.durationMs)}</div></div>
        <div className="kv-row"><div className="kv-key">{t('diag.detail.time')}</div><div className="kv-val">{fmtTime(row.startedAt)} — {fmtTime(row.finishedAt)}</div></div>
        <div className="kv-row"><div className="kv-key">{t('diag.detail.source')}</div><div className="kv-val mono small">{row.source}{row.sourceUrl ? ` · ${row.sourceUrl}` : ''}</div></div>
        {row.geo && <div className="kv-row"><div className="kv-key">{t('diag.col.geoFull')}</div><div className="kv-val">{[row.geo.country, row.geo.region, row.geo.city, row.geo.isp, row.geo.asn].filter(Boolean).join(' · ')}（{t('diag.geo.source', { source: row.geo.source, time: fmtTime(row.geo.fetchedAt) })}）</div></div>}
        {exitKey && <div className="kv-row"><div className="kv-key">{t('diag.dns.exitSource', { v: '' }).replace('：', '')}</div><div className="kv-val">{t(exitKey)}</div></div>}
        {row.serverAddr && <div className="kv-row"><div className="kv-key">{t('diag.col.server')}</div><div className="kv-val mono">{row.serverAddr}</div></div>}
        {row.ecsRep && <div className="kv-row"><div className="kv-key">{t('diag.dns.ecsRepLabel')}</div><div className="kv-val mono">{row.ecsRep}</div></div>}
        {row.dnsRecords && row.dnsRecords.length > 0 && (
          <div className="kv-row">
            <div className="kv-key">{t('diag.dns.recordsLabel', { n: row.dnsRecords.length })}</div>
            <div className="kv-val mono small" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{row.dnsRecords.join('\n')}</div>
          </div>
        )}
        {row.attempts && row.attempts.length > 0 && (
          <div className="kv-row">
            <div className="kv-key">{t('diag.detail.attempts')}</div>
            <div className="kv-val small">
              {row.attempts.map((a, i) => (
                <div key={i}>
                  {i === 0
                    ? t('diag.detail.firstAt', { time: fmtTime(a.startedAt) })
                    : t('diag.detail.retriedAt', { n: i + 1, time: fmtTime(a.startedAt), status: t(STATUS_KEY[a.status] ?? 'diag.status.pending') })}
                  {' · '}{t(STATUS_KEY[a.status] ?? 'diag.status.pending')}{a.error ? ` · ${a.error}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
        {row.error && <div className="kv-row"><div className="kv-key"> </div><div className="kv-val" style={{ color: 'var(--bad)' }}>{row.error}</div></div>}
      </div>
      {row.evidence && row.evidence.length > 0 ? (
        <details className="diag-evidence">
          <summary className="caption">{t('diag.detail.evidence')}</summary>
          {row.evidence.map((e: DiagEvidence, i) => (
            <pre key={i} className="diag-evidence-pre mono">
              {[
                e.url ? `url: ${e.url}` : '',
                e.status != null ? `status: ${e.status}` : '',
                e.durationMs != null ? `time: ${e.durationMs}ms` : '',
                e.note ? `note: ${e.note}` : '',
                e.snippet ?? ''
              ].filter(Boolean).join('\n')}
            </pre>
          ))}
        </details>
      ) : (
        history ? <p className="caption">{t('diag.detail.historyNoEvidence')}</p> : null
      )}
    </div>
  )
}

/* ---------- 复制反馈按钮 ---------- */
function CopyBtn({ getText, label }: { getText: () => string; label: string }): JSX.Element {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="btn-icon"
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(getText()).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      {copied ? <span className="caption">{t('diag.action.copied')}</span> : <CopyIcon size={13} />}
    </button>
  )
}

function RetryBtn({ ids, disabled }: { ids: string[]; disabled?: boolean }): JSX.Element {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  return (
    <button
      className="btn-icon"
      title={t('diag.action.retryItem')}
      disabled={disabled || busy || !ids.length}
      onClick={(e) => {
        e.stopPropagation()
        setBusy(true)
        void retryDiagProbes(ids).finally(() => setBusy(false))
      }}
    >
      <RefreshCw size={13} className={busy ? 'spin' : undefined} />
    </button>
  )
}

/* ---------- 表格外壳 ---------- */
function TableShell({ children, cols }: { children: ReactNode; cols: string }): JSX.Element {
  return (
    <div className="diag-table-wrap card" style={{ padding: 0, overflowX: 'auto' }}>
      <div className="diag-table" style={{ gridTemplateColumns: cols }}>{children}</div>
    </div>
  )
}

function HeadCell({ children, right }: { children: ReactNode; right?: boolean }): JSX.Element {
  return <div className={'diag-th' + (right ? ' right' : '')}>{children}</div>
}

/* ============================================================
   网站分流测试标签
   ============================================================ */
function SplitTab({ rows, running, hasRun }: { rows: Row[]; running: boolean; hasRun: boolean }): JSX.Element {
  const { t } = useLang()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<'all' | SplitCategory>('all')
  const [failOnly, setFailOnly] = useState(false)
  const [groupByExit, setGroupByExit] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (cat !== 'all' && r.category !== cat) return false
      if (failOnly) {
        const bad = r.status === 'failed' || r.status === 'timeout' || r.status === 'canceled' || (r.status === 'success' && !r.ip)
        if (!bad) return false
      }
      if (kw) {
        const hay = `${r.target ?? ''} ${r.targetHost ?? ''}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [rows, q, cat, failOnly])

  /** 分组视图：按出口 IP 分组（保持配置顺序；未取得出口单独一组） */
  const groups = useMemo(() => {
    if (!groupByExit) return null
    const map = new Map<string, Row[]>()
    for (const r of filtered) {
      const key = r.ip ? normalizeIp(r.ip) : ''
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return [...map.entries()].map(([key, rs], i) => ({
      key,
      rows: rs,
      label: key
        ? t('diag.filter.exitGroup', {
            n: rs.length,
            label: String.fromCharCode(65 + Math.min(i, 4))
          })
        : t('diag.filter.reachOnlyGroup', { n: rs.length }),
      ip: rs[0]?.ip
    }))
  }, [filtered, groupByExit, t])

  const failedIds = rows
    .filter((r) => r.status === 'failed' || r.status === 'timeout' || r.status === 'canceled')
    .map((r) => r.id)

  const copyTable = (): string => {
    const head = [t('diag.col.site'), t('diag.col.category'), t('diag.col.exit'), t('diag.col.geo'), t('diag.col.status'), t('diag.detail.time')].join('\t')
    const body = filtered
      .map((r) =>
        [
          `${r.target ?? ''} (${r.targetHost ?? ''})`,
          t((`diag.category.${r.category ?? 'intl'}`) as TKey),
          r.ip ?? t('diag.reachOnlyText'),
          r.geo ? [r.geo.country, r.geo.city, r.geo.isp].filter(Boolean).join(' ') : (r.ip ? t('diag.geo.notFetched') : ''),
          r.status === 'success' && !r.ip ? t('diag.statusLong.reachOnly') : t(STATUS_KEY[r.status] ?? 'diag.status.pending'),
          r.finishedAt ?? ''
        ].join('\t')
      )
      .join('\n')
    return head + '\n' + body
  }

  const rowEl = (r: Row): JSX.Element => {
    const open = openId === r.id
    const canRetry = !running && r.status !== 'running' && r.status !== 'queued'
    return (
      <div key={r.id} className="diag-tr-group">
        <div
          className={'diag-tr' + (open ? ' open' : '')}
          onClick={() => setOpenId(open ? null : r.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpenId(open ? null : r.id)
            }
          }}
        >
          <div className="diag-td">
            <span className="diag-cat-dot" data-cat={r.category ?? 'intl'} />
            <span className="diag-site">
              <span className="diag-site-name">{r.target ?? r.id}</span>
              <span className="diag-site-host mono">{r.targetHost}</span>
            </span>
          </div>
          <div className="diag-td">{t((`diag.category.${r.category ?? 'intl'}`) as TKey)}</div>
          <div className="diag-td mono diag-ip-cell">
            {r.ip ? (
              <>
                <span className="diag-ip" title={r.ip}>{r.ip}</span>
                <span className="diag-family-tag">{t((`diag.family.${r.family ?? 'unknown'}`) as TKey)}</span>
              </>
            ) : r.status === 'success' ? (
              <span className="muted">{t('diag.reachOnlyText')}</span>
            ) : (
              <span className="muted">—</span>
            )}
          </div>
          <div className="diag-td"><GeoCell row={r} /></div>
          <div className="diag-td"><StatusBadge status={r.status} kind="splitTunnel" /></div>
          <div className="diag-td diag-actions" onClick={(e) => e.stopPropagation()}>
            {r.ip ? <CopyBtn getText={() => r.ip as string} label={t('diag.action.copyIp')} /> : null}
            {canRetry ? <RetryBtn ids={[r.id]} /> : null}
          </div>
        </div>
        {open && <div className="diag-tr-detail"><DetailBox row={r} history={false} /></div>}
      </div>
    )
  }

  return (
    <div>
      <div className="diag-toolbar">
        <div className="input-wrap">
          <SearchIcon size={14} className="muted" />
          <input className="input input-sm" value={q} placeholder={t('diag.search')} onChange={(e) => setQ(e.target.value)} />
        </div>
        {(['all', 'cn', 'intl', 'ai', 'dev'] as const).map((c) => (
          <button
            key={c}
            className={'btn btn-sm ' + (cat === c ? 'btn-tonal' : 'btn-ghost')}
            onClick={() => setCat(c)}
          >
            {t((`diag.category.${c}`) as TKey)}
          </button>
        ))}
        <label className="chk">
          <input type="checkbox" checked={failOnly} onChange={(e) => setFailOnly(e.target.checked)} />
          <span className="caption">{t('diag.filter.failOnly')}</span>
        </label>
        <label className="chk">
          <input type="checkbox" checked={groupByExit} onChange={(e) => setGroupByExit(e.target.checked)} />
          <span className="caption">{t('diag.filter.groupByExit')}</span>
        </label>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {hasRun && failedIds.length > 0 && (
            <button className="btn btn-ghost btn-sm" disabled={running} onClick={() => void retryDiagProbes(failedIds)}>
              <RefreshCw size={13} /> {t('diag.action.retryFailed')}（{failedIds.length}）
            </button>
          )}
          {rows.length > 0 && <CopyBtn getText={copyTable} label={t('diag.action.copyTable')} />}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="muted small" style={{ marginTop: 10 }}>{t('diag.empty')}</p>
      ) : (
        <TableShell cols="minmax(210px,1.5fr) 84px minmax(170px,1.2fr) minmax(160px,1fr) 130px 76px">
          <HeadCell>{t('diag.col.site')}</HeadCell>
          <HeadCell>{t('diag.col.category')}</HeadCell>
          <HeadCell>{t('diag.col.exit')}</HeadCell>
          <HeadCell>{t('diag.col.geo')}</HeadCell>
          <HeadCell>{t('diag.col.status')}</HeadCell>
          <HeadCell right>{t('diag.col.actions')}</HeadCell>
          {groupByExit && groups
            ? groups.map((g) => (
                <div className="diag-tgroup" key={g.key || 'none'} style={{ gridColumn: '1 / -1' }}>
                  <div className="diag-tgroup-head">
                    <span className="mono">{g.ip ?? ''}</span>
                    <span className="caption">{g.label}</span>
                  </div>
                  <div style={{ display: 'contents' }}>{g.rows.map(rowEl)}</div>
                </div>
              ))
            : filtered.map(rowEl)}
        </TableShell>
      )}
      <p className="caption" style={{ marginTop: 8, lineHeight: 1.7 }}>{t('diag.tabDesc.splitTunnel')}</p>
    </div>
  )
}

/* ============================================================
   本机公网 IP 标签
   ============================================================ */
function PublicIpTab({ rows }: { rows: Row[] }): JSX.Element {
  const { t } = useLang()
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div>
      {rows.length === 0 ? (
        <p className="muted small" style={{ marginTop: 10 }}>{t('diag.empty')}</p>
      ) : (
        <TableShell cols="minmax(150px,1fr) minmax(150px,1.1fr) 74px minmax(160px,1.2fr) minmax(150px,1.4fr) 110px 60px">
          <HeadCell>{t('diag.col.vantage')}</HeadCell>
          <HeadCell>{t('diag.col.exit')}</HeadCell>
          <HeadCell>{t('diag.col.family')}</HeadCell>
          <HeadCell>{t('diag.col.geoFull')}</HeadCell>
          <HeadCell>{t('diag.col.mech')}</HeadCell>
          <HeadCell>{t('diag.col.status')}</HeadCell>
          <HeadCell right>{t('diag.col.actions')}</HeadCell>
          {rows.map((r) => {
            const open = openId === r.id
            return (
              <div key={r.id} className="diag-tr-group">
                <div
                  className={'diag-tr' + (open ? ' open' : '')}
                  onClick={() => setOpenId(open ? null : r.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setOpenId(open ? null : r.id)
                  }}
                >
                  <div className="diag-td"><span className="mono small">{r.target ?? r.id}</span></div>
                  <div className="diag-td mono diag-ip-cell">{r.ip ? <span className="diag-ip" title={r.ip}>{r.ip}</span> : <span className="muted">{r.status === 'unsupported' ? t('diag.family.unknown') : '—'}</span>}</div>
                  <div className="diag-td">{r.family ? t((`diag.family.${r.family}`) as TKey) : '—'}</div>
                  <div className="diag-td"><GeoCell row={r} /></div>
                  <div className="diag-td small">{t(('diag.mech.' + r.mechKey) as TKey)}</div>
                  <div className="diag-td"><StatusBadge status={r.status} kind="publicIp" /></div>
                  <div className="diag-td diag-actions" onClick={(e) => e.stopPropagation()}>
                    {r.ip ? <CopyBtn getText={() => r.ip as string} label={t('diag.action.copyIp')} /> : null}
                    {r.status !== 'running' && r.status !== 'queued' ? <RetryBtn ids={[r.id]} /> : null}
                  </div>
                </div>
                {open && <div className="diag-tr-detail"><DetailBox row={r} history={false} /></div>}
              </div>
            )
          })}
        </TableShell>
      )}
      <p className="caption" style={{ marginTop: 8, lineHeight: 1.7 }}>
        {t('diag.tabDesc.publicIp')}<br />
        {t('diag.mechNote.http-proxy')} {t('diag.mechNote.node-direct')}
      </p>
    </div>
  )
}

/* ============================================================
   CDN 命中节点标签
   ============================================================ */
function CdnTab({ rows }: { rows: Row[] }): JSX.Element {
  const { t } = useLang()
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div>
      {rows.length === 0 ? (
        <p className="muted small" style={{ marginTop: 10 }}>{t('diag.empty')}</p>
      ) : (
        <TableShell cols="minmax(120px,1fr) minmax(170px,1.2fr) minmax(150px,1.2fr) minmax(150px,1.3fr) 90px 100px 60px">
          <HeadCell>{t('diag.col.cdn')}</HeadCell>
          <HeadCell>{t('diag.col.host')}</HeadCell>
          <HeadCell>{t('diag.col.node')}</HeadCell>
          <HeadCell>{t('diag.col.cache')}</HeadCell>
          <HeadCell right>{t('diag.col.ms')}</HeadCell>
          <HeadCell>{t('diag.col.status')}</HeadCell>
          <HeadCell right>{t('diag.col.actions')}</HeadCell>
          {rows.map((r) => {
            const open = openId === r.id
            return (
              <div key={r.id} className="diag-tr-group">
                <div
                  className={'diag-tr' + (open ? ' open' : '')}
                  onClick={() => setOpenId(open ? null : r.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setOpenId(open ? null : r.id)
                  }}
                >
                  <div className="diag-td strong small">{r.cdn ?? r.target ?? r.id}</div>
                  <div className="diag-td mono small">{r.targetHost}</div>
                  <div className="diag-td mono small">
                    {r.node ? <span title={r.node}>{r.node}</span> : <span className="muted">{t('diag.noNode')}</span>}
                  </div>
                  <div className="diag-td small">
                    {r.cacheSignals && r.cacheSignals.length ? (
                      <span className="mono" title={t('diag.cacheOrderNote')}>{r.cacheSignals.join(' → ')}</span>
                    ) : (
                      <span className="muted">{t('diag.noCache')}</span>
                    )}
                  </div>
                  <div className="diag-td right mono small">{fmtMs(r.durationMs)}</div>
                  <div className="diag-td">
                    <StatusBadge status={r.status} kind="cdnNode" />
                  </div>
                  <div className="diag-td diag-actions" onClick={(e) => e.stopPropagation()}>
                    {r.status !== 'running' && r.status !== 'queued' ? <RetryBtn ids={[r.id]} /> : null}
                  </div>
                </div>
                {open && <div className="diag-tr-detail"><DetailBox row={r} history={false} /></div>}
              </div>
            )
          })}
        </TableShell>
      )}
      <p className="caption" style={{ marginTop: 8, lineHeight: 1.7 }}>{t('diag.cdnNote')}</p>
    </div>
  )
}

/* ============================================================
   DNS 出口查询标签
   ============================================================ */
function DnsTab({ rows }: { rows: Row[] }): JSX.Element {
  const { t } = useLang()
  const [openId, setOpenId] = useState<string | null>(null)
  const system = rows.filter((r) => r.resolverKind === 'system')
  const pub = rows.filter((r) => r.resolverKind !== 'system')
  const rowEl = (r: Row): JSX.Element => {
    const open = openId === r.id
    return (
      <div key={r.id} className="diag-tr-group">
        <div
          className={'diag-tr' + (open ? ' open' : '')}
          onClick={() => setOpenId(open ? null : r.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setOpenId(open ? null : r.id)
          }}
        >
          <div className="diag-td small">{r.target ?? r.id}</div>
          <div className="diag-td mono small">{r.serverAddr ?? '—'}</div>
          <div className="diag-td mono diag-ip-cell">
            {r.ip ? (
              <>
                <span className="diag-ip" title={r.ip}>{r.ip}</span>
                <span className="diag-family-tag">{t((`diag.family.${r.family ?? 'unknown'}`) as TKey)}</span>
              </>
            ) : r.status === 'success' ? (
              <span className="muted">{t('diag.dns.noExit')}</span>
            ) : (
              <span className="muted">—</span>
            )}
          </div>
          <div className="diag-td mono small">{r.ecsSubnet ?? <span className="muted">—</span>}</div>
          <div className="diag-td">
            <StatusBadge status={r.status} kind="dnsRow" />
          </div>
          <div className="diag-td diag-actions" onClick={(e) => e.stopPropagation()}>
            {r.ip ? <CopyBtn getText={() => r.ip as string} label={t('diag.action.copyIp')} /> : null}
            {r.status !== 'running' && r.status !== 'queued' ? <RetryBtn ids={[r.id]} /> : null}
          </div>
        </div>
        {open && <div className="diag-tr-detail"><DetailBox row={r} history={false} /></div>}
      </div>
    )
  }
  const heads = (
    <>
      <HeadCell>{t('diag.col.resolver')}</HeadCell>
      <HeadCell>{t('diag.col.server')}</HeadCell>
      <HeadCell>{t('diag.col.recExit')}</HeadCell>
      <HeadCell>{t('diag.col.ecs')}</HeadCell>
      <HeadCell>{t('diag.col.status')}</HeadCell>
      <HeadCell right>{t('diag.col.actions')}</HeadCell>
    </>
  )
  return (
    <div>
      {rows.length === 0 ? (
        <p className="muted small" style={{ marginTop: 10 }}>{t('diag.empty')}</p>
      ) : (
        <>
          {system.length > 0 && (
            <>
              <div className="diag-subhead">{t('diag.dns.groupSystem')}</div>
              <TableShell cols="minmax(140px,1fr) minmax(120px,0.9fr) minmax(170px,1.2fr) minmax(130px,1fr) 110px 60px">
                {heads}
                {system.map(rowEl)}
              </TableShell>
            </>
          )}
          {pub.length > 0 && (
            <>
              <div className="diag-subhead">{t('diag.dns.groupPublic')}</div>
              <TableShell cols="minmax(140px,1fr) minmax(120px,0.9fr) minmax(170px,1.2fr) minmax(130px,1fr) 110px 60px">
                {heads}
                {pub.map(rowEl)}
              </TableShell>
            </>
          )}
        </>
      )}
      <p className="caption" style={{ marginTop: 8, lineHeight: 1.7 }}>
        {t('diag.tabDesc.dnsExit')}<br />
        {t('diag.dns.publicNote')} {t('diag.dns.dnsLeakNote')}
      </p>
    </div>
  )
}

/* ============================================================
   页面主体
   ============================================================ */
export function ExitDiagnostics(): JSX.Element {
  const { t } = useLang()
  const st = useSyncExternalStore(subscribeDiag, getDiag)
  const [tab, setTab] = useState<DiagModuleId>(lastTab)
  const [now, setNow] = useState(() => Date.now())
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void refreshDiag()
    return () => {
      lastTab = tab
    }
  }, [tab])

  const running = diagRunning(st)
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [running])

  const sum = activeSummary(st)
  const historyMode = st.mode === 'history'
  const run = st.run

  /** 当前标签行数据（保持配置顺序；历史模式来自不可变摘要） */
  const rowsOf = (id: DiagModuleId): Row[] => {
    if (historyMode) return (st.historyDiag?.probes[id] ?? []) as Row[]
    const m = run?.modules.find((x) => x.id === id)
    return (m?.probes ?? []) as Row[]
  }

  /** 概览统计（按唯一 IP 去重；DNS 单独统计） */
  const stats = useMemo(() => {
    const split = rowsOf('splitTunnel')
    const pub = rowsOf('publicIp')
    const dns = rowsOf('dnsExit')
    const httpIps = new Set<string>()
    for (const r of [...split, ...pub]) {
      if (r.ip && r.status === 'success') httpIps.add(normalizeIp(r.ip))
    }
    const dnsIps = new Set<string>()
    for (const r of dns) {
      if (r.ip && r.status === 'success') dnsIps.add(normalizeIp(r.ip))
    }
    const gotIp = split.filter((r) => r.status === 'success' && r.ip).length
    const reachOnly = split.filter((r) => r.status === 'success' && !r.ip).length
    const failed = split.filter((r) => r.status === 'failed' || r.status === 'timeout').length
    const done = (sum?.stats.probes ?? 0) - rowsOf('publicIp').filter((r) => r.status === 'queued' || r.status === 'pending').length
    const totalAll = MODULES.reduce((acc, id) => acc + rowsOf(id).length, 0)
    const doneAll = MODULES.reduce(
      (acc, id) => acc + rowsOf(id).filter((r) => r.status !== 'queued' && r.status !== 'pending' && r.status !== 'running').length,
      0
    )
    void done
    return { httpExits: httpIps.size, gotIp, reachOnly, failed, dnsExits: dnsIps.size, doneAll, totalAll }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, sum, historyMode, st.historyDiag])

  const elapsedSec = run?.startedAt
    ? Math.max(0, Math.round((((running ? now : Date.parse(run.finishedAt ?? '')) || now) - Date.parse(run.startedAt)) / 1000))
    : 0

  const runAll = (): void => {
    setSaved(false)
    void startDiag(ALL_MODULES, 'network')
  }

  const runModule = (id: DiagModuleId): void => {
    const existing = run?.modules.find((m) => m.id === id)
    if (existing && run && st.activeRunId) {
      // 已有本轮：重测本模块全部项（保留其他模块结果与各行尝试历史）
      void retryDiagProbes(existing.probes.map((p) => p.id))
    } else {
      void startDiag([id], 'network')
    }
  }

  const canSave =
    !historyMode &&
    !!sum &&
    sum.status !== 'running' &&
    !saved &&
    Object.values(sum.moduleStatus).some((s) => s && s !== 'pending')

  const saveToHistory = (): void => {
    if (!sum) return
    const httpIps = new Map<string, number>()
    for (const id of ['publicIp', 'splitTunnel'] as const) {
      for (const p of sum.probes[id]) {
        if (p.ip && p.status === 'success') httpIps.set(normalizeIp(p.ip), (httpIps.get(normalizeIp(p.ip)) ?? 0) + 1)
      }
    }
    const mainIp = [...httpIps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const record: HistoryRecord = {
      id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'exitDiag',
      startedAt: sum.startedAt,
      finishedAt: sum.finishedAt ?? sum.startedAt,
      currentIp: mainIp,
      successCount: sum.stats.ok,
      totalCount: sum.stats.probes,
      riskLevel: null,
      riskValue: null,
      netType: null,
      sources: MODULES.filter((id) => sum.moduleStatus[id] && sum.moduleStatus[id] !== 'pending').map((id) => ({
        key: id,
        name: t((`diag.module.${id}`) as TKey),
        ok: sum.moduleStatus[id] === 'success',
        durationMs: undefined,
        error: undefined
      })),
      results: [],
      diag: sum
    }
    void window.ipInsight
      .saveHistory(record)
      .then((r) => {
        if (r.ok) {
          setSaved(true)
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => setSaved(false), 2500)
        }
      })
      .catch(() => undefined)
  }

  const hasAnyRows = MODULES.some((id) => rowsOf(id).length > 0)

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">{t('diag.title')} · Exit Diagnostics</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
        <h1 className="h1" style={{ margin: 0 }}>{t('common.nav.exitDiag')}</h1>
        {historyMode ? null : running ? (
          <button className="btn btn-ghost btn-sm" onClick={() => void stopDiag()}>
            <CircleStop size={14} /> {t('diag.stop')}
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={runAll}>
            <Play size={14} /> {hasAnyRows ? t('diag.rerunAll') : t('diag.runAll')}
          </button>
        )}
        {canSave && (
          <button className="btn btn-ghost btn-sm" onClick={saveToHistory}>
            <Download size={14} /> {saved ? t('diag.save.saved') : t('diag.save.toHistory')}
          </button>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 8, maxWidth: 720, lineHeight: 1.75 }}>
        {t('diag.intro')}
      </p>

      {historyMode && st.historyMeta && st.historyDiag && (
        <div className="card card-subtle" style={{ marginTop: 14, padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-info">{t('diag.save.kindBadge')}</span>
          <span className="small">
            {t('diag.historyBanner', {
              time: new Date(st.historyMeta.startedAt).toLocaleString(),
              runId: st.historyDiag.runId
            })}
          </span>
          <button className="btn btn-text btn-sm" style={{ marginLeft: 'auto' }} onClick={() => enterLive()}>
            {t('diag.runAll')}
          </button>
        </div>
      )}

      {/* 进度与时间 */}
      {running && run && (
        <div style={{ marginTop: 12, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-info">{t('diag.progress', { done: stats.doneAll, total: stats.totalAll })}</span>
          <span className="caption">{t('diag.elapsed', { s: elapsedSec })}</span>
          <span className="caption mono">{run.runId}</span>
        </div>
      )}
      {!running && run?.finishedReason === 'canceled' && (
        <p className="caption" style={{ marginTop: 10, color: 'var(--warn)' }}>
          {t('diag.runEnd.canceled', { time: fmtTime(run.finishedAt) })}
        </p>
      )}
      {!running && run?.finishedReason === 'timeout' && (
        <p className="caption" style={{ marginTop: 10, color: 'var(--warn)' }}>
          {t('diag.runEnd.timeout', { time: fmtTime(run.finishedAt) })}
        </p>
      )}

      {/* 概览 */}
      <div className="diag-overview" style={{ marginTop: 16 }}>
        <div className="diag-ov-title">{t('diag.overview.title')}</div>
        <div className="diag-ov-item">
          <Globe size={14} className="muted" />
          {hasAnyRows ? (
            <span className="small">
              {t('diag.overview.httpExits', { n: stats.httpExits })}；{t('diag.overview.splitGotIp', { n: stats.gotIp })}；{t('diag.overview.splitReachOnly', { n: stats.reachOnly })}；{t('diag.overview.failed', { n: stats.failed })}；{t('diag.overview.dnsExits', { n: stats.dnsExits })}。
            </span>
          ) : (
            <span className="small muted">{t('diag.overview.nothingYet')}</span>
          )}
        </div>
        {stats.httpExits > 1 && (
          <p className="caption" style={{ marginTop: 4 }}>{t('diag.overview.multiExitNote')}</p>
        )}
      </div>

      {/* 标签栏 */}
      <div className="diag-tabs" style={{ marginTop: 18 }} role="tablist">
        {MODULES.map((id) => {
          const ms = historyMode ? st.historyDiag?.moduleStatus?.[id] : run?.modules.find((m) => m.id === id)?.status
          const cnt = rowsOf(id)
          const ok = cnt.filter((r) => r.status === 'success').length
          return (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={'diag-tab' + (tab === id ? ' active' : '')}
              onClick={() => setTab(id)}
            >
              <span>{t((`diag.module.${id}`) as TKey)}</span>
              {cnt.length > 0 && (
                <span className={'diag-tab-count ' + badgeCls(ms)}>{ok}/{cnt.length}</span>
              )}
              {!historyMode && !running ? (
                <span
                  className="diag-tab-run"
                  title={cnt.length ? t('diag.rerunModule') : t('diag.runModule')}
                  onClick={(e) => {
                    e.stopPropagation()
                    runModule(id)
                  }}
                >
                  <RefreshCw size={12} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <p className="caption" style={{ marginTop: 8 }}>{t((`diag.tabDesc.${tab}`) as TKey)}</p>

      {/* 标签内容 */}
      <div style={{ marginTop: 10 }}>
        {tab === 'splitTunnel' && <SplitTab rows={rowsOf('splitTunnel')} running={running} hasRun={rowsOf('splitTunnel').length > 0} />}
        {tab === 'publicIp' && <PublicIpTab rows={rowsOf('publicIp')} />}
        {tab === 'cdnNode' && <CdnTab rows={rowsOf('cdnNode')} />}
        {tab === 'dnsExit' && <DnsTab rows={rowsOf('dnsExit')} />}
      </div>

      {/* 页脚说明 */}
      <p className="caption" style={{ marginTop: 14 }}>
        {t('diag.runMeta', {
          runId: historyMode ? (st.historyDiag?.runId ?? '—') : (run?.runId ?? '—'),
          start: new Date(historyMode ? (st.historyDiag?.startedAt ?? 0) : (run?.startedAt ?? 0)).toLocaleString()
        })}
        {sum ? ` · ${t('diag.moduleStats', { ok: sum.stats.ok, total: sum.stats.probes })}` : ''}
      </p>
      <p className="caption" style={{ marginTop: 4, lineHeight: 1.7 }}>{t('diag.privacyNote')}</p>
    </div>
  )
}
