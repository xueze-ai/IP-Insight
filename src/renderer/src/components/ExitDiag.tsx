import { ChevronDown, ChevronUp, CircleStop, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { DiagModuleId, DiagProbe, DiagRun } from '@shared/diag'
import { diagBadgeCls, diagRunning, moduleProbeStats, refreshDiag, startDiag, stopDiag, useDiag } from '../state/diagStore'
import { useLang } from '../i18n'
import type { TKey } from '../i18n'

// =============================================================
// 网络出口诊断（Sukka 模块四项）：本机公网 IP / 网站分流 / CDN 节点 / DNS 出口
// 展示原则：默认四张紧凑摘要卡，点击展开明细；
//          关键结果 + 来源 + 时间先行，原始证据按需展开；
//          多出口 / 地址族差异不判为异常；无证据不显示 HIT/MISS / 城市。
// =============================================================

const MODULE_IDS: DiagModuleId[] = ['publicIp', 'splitTunnel', 'cdnNode', 'dnsExit']

/** 状态 → 字典键（白名单映射，保证 TKey 类型安全） */
const STATUS_KEY: Record<string, TKey> = {
  success: 'diag.status.success',
  partial: 'diag.status.partial',
  failed: 'diag.status.failed',
  timeout: 'diag.status.timeout',
  canceled: 'diag.status.canceled',
  skipped: 'diag.status.skipped',
  unsupported: 'diag.status.unsupported',
  running: 'diag.status.running',
  pending: 'diag.status.pending'
}


const VIA_KEY: Record<string, TKey> = {
  'main-http': 'diag.via.main-http',
  'browser-page': 'diag.via.browser-page',
  'dns-udp': 'diag.via.dns-udp'
}

const FAMILY_KEY: Record<string, TKey> = {
  ipv4: 'diag.family.ipv4',
  ipv6: 'diag.family.ipv6',
  unknown: 'diag.family.unknown'
}

const MODULE_TITLE: Record<DiagModuleId, TKey> = {
  publicIp: 'diag.module.publicIp',
  splitTunnel: 'diag.module.splitTunnel',
  cdnNode: 'diag.module.cdnNode',
  dnsExit: 'diag.module.dnsExit'
}

const MODULE_NOTE: Record<DiagModuleId, TKey> = {
  publicIp: 'diag.note.publicIp',
  splitTunnel: 'diag.note.splitTunnel',
  cdnNode: 'diag.note.cdnNode',
  dnsExit: 'diag.note.dnsExit'
}

function fmtMs(ms?: number): string {
  return ms != null ? `${ms} ms` : '—'
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString()
}

/** 探测项的一行结果（关键结果 + 来源 + 状态） */
function ProbeRow({ p, openId, onToggle }: { p: DiagProbe; openId: string | null; onToggle: (id: string) => void }): JSX.Element {
  const { t } = useLang()
  const open = openId === p.id
  const keyResult = p.ip
    ? <span className="mono">{p.ip}</span>
    : p.node
      ? <span className="mono">{p.node}</span>
      : p.status === 'success'
        ? t('diag.keyResult.reachableOnly')
        : '—'
  return (
    <div className="diag-probe">
      <button className="diag-probe-main" onClick={() => onToggle(p.id)} aria-expanded={open}>
        <span className="diag-probe-target">{p.target ?? p.targetHost ?? p.id}</span>
        <span className="diag-probe-key">{keyResult}</span>
        <span className={'badge ' + diagBadgeCls(p.status)}>{t(STATUS_KEY[p.status] ?? 'diag.status.pending')}</span>
        <span className="diag-probe-src muted">{p.source}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="diag-probe-detail">
          <div className="kv">
            <div className="kv-row"><div className="kv-key">{t('diag.field.method')}</div><div className="kv-val">{p.method} · {t(VIA_KEY[p.via] ?? 'diag.via.main-http')}</div></div>
            <div className="kv-row"><div className="kv-key">{t('diag.field.time')}</div><div className="kv-val">{fmtTime(p.startedAt)} — {fmtTime(p.finishedAt)} · {fmtMs(p.durationMs)}</div></div>
            {p.httpStatus != null && (
              <div className="kv-row"><div className="kv-key">{t('diag.field.httpStatus')}</div><div className="kv-val mono">{p.httpStatus}</div></div>
            )}
            {p.family && (
              <div className="kv-row"><div className="kv-key">{t('diag.field.family')}</div><div className="kv-val">{t(FAMILY_KEY[p.family] ?? 'diag.family.unknown')}</div></div>
            )}
            {p.node && (
              <div className="kv-row"><div className="kv-key">{t('diag.field.node')}</div><div className="kv-val mono">{p.node}</div></div>
            )}
            {p.cdn && (
              <div className="kv-row"><div className="kv-key">{t('diag.field.cdn')}</div><div className="kv-val">{p.cdn}</div></div>
            )}
            <div className="kv-row"><div className="kv-key">{t('diag.field.sourceUrl')}</div><div className="kv-val mono small">{p.sourceUrl ?? '—'}</div></div>
            {p.error && (
              <div className="kv-row"><div className="kv-key">{t('diag.field.error')}</div><div className="kv-val" style={{ color: 'var(--bad)' }}>{p.error}</div></div>
            )}
          </div>
          {p.evidence && p.evidence.length > 0 && (
            <details className="diag-evidence">
              <summary className="caption">{t('diag.evidence.toggle')}</summary>
              {p.evidence.map((e, i) => (
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
          )}
        </div>
      )}
    </div>
  )
}

/** 单模块摘要卡 + 展开明细 */
function ModuleCard({ run, id, open, onToggle }: { run: DiagRun | null; id: DiagModuleId; open: boolean; onToggle: () => void }): JSX.Element {
  const { t } = useLang()
  const [openProbe, setOpenProbe] = useState<string | null>(null)
  const m = run?.modules.find((x) => x.id === id)
  const stats = moduleProbeStats(run, id)
  const running = m?.status === 'running' || run?.status === 'running'
  // 摘要行：最多两条最有信息量的结果
  const summaryLines: string[] = []
  const okProbes = (m?.probes ?? []).filter((p) => p.status === 'success')
  const firstIp = okProbes.find((p) => p.ip)?.ip
  if (id === 'publicIp') {
    const ips = [...new Set(okProbes.filter((p) => p.ip).map((p) => p.ip as string))]
    if (ips.length > 0) summaryLines.push(t(`diag.summary.publicIp.${ips.length > 1 ? 'multi' : 'one'}`, { ips: ips.slice(0, 3).join(' / ') }))
    else if (m && m.status !== 'running') summaryLines.push(t('diag.summary.publicIp.none'))
  } else if (id === 'splitTunnel') {
    const ips = [...new Set(okProbes.filter((p) => p.ip).map((p) => p.ip as string))]
    if (ips.length > 0) summaryLines.push(t('diag.summary.splitTunnel.exits', { n: ips.length, ips: ips.slice(0, 2).join(' / ') }))
    else if (m && m.status !== 'running') summaryLines.push(t('diag.summary.splitTunnel.none'))
  } else if (id === 'cdnNode') {
    const nodes = okProbes.filter((p) => p.node)
    if (nodes.length > 0) summaryLines.push(t('diag.summary.cdnNode.hit', { n: nodes.length, first: `${(nodes[0].cdn ?? '')} ${nodes[0].node}` }))
    else if (m && m.status !== 'running') summaryLines.push(t('diag.summary.cdnNode.none'))
  } else if (id === 'dnsExit') {
    const exits = [...new Set(okProbes.filter((p) => p.ip).map((p) => p.ip as string))]
    if (exits.length > 0) summaryLines.push(t('diag.summary.dnsExit.exits', { n: exits.length, ips: exits.slice(0, 2).join(' / ') }))
    else if (m && m.status !== 'running') summaryLines.push(t('diag.summary.dnsExit.none'))
  }
  if (m && (m.status === 'partial' || m.status === 'failed')) {
    const bad = m.probes.filter((p) => p.status === 'failed' || p.status === 'timeout').length
    if (bad > 0) summaryLines.push(t('diag.summary.partial', { n: bad }))
  }
  return (
    <div className={'card diag-mod-card' + (open ? ' diag-mod-open' : '')}>
      <button className="diag-mod-head" onClick={onToggle} aria-expanded={open}>
        <span className="diag-mod-title">{t(MODULE_TITLE[id])}</span>
        <span className={'badge ' + (running ? 'badge-info' : diagBadgeCls(m?.status))}>
          {running ? t('diag.status.running') : t(STATUS_KEY[m?.status ?? 'pending'])}
        </span>
        {stats.total > 0 && (
          <span className="caption">{t('diag.moduleStats', { ok: stats.ok, total: stats.total })}</span>
        )}
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {!open && summaryLines.length > 0 && (
        <div className="diag-mod-summary caption">
          {summaryLines.slice(0, 2).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
      {open && (
        <div className="diag-mod-body">
          <p className="caption" style={{ lineHeight: 1.7 }}>{t(MODULE_NOTE[id])}</p>
          {(m?.probes ?? []).length === 0 ? (
            <p className="muted small">{t('diag.empty')}</p>
          ) : (
            <div>
              {m!.probes.map((p) => (
                <ProbeRow key={p.id} p={p} openId={openProbe} onToggle={(pid) => setOpenProbe(openProbe === pid ? null : pid)} />
              ))}
            </div>
          )}
          {m?.error && <p className="small" style={{ color: 'var(--bad)' }}>{m.error}</p>}
        </div>
      )}
    </div>
  )
}

/** 出口诊断分组主体（网络质量页内嵌） */
export function ExitDiagPanel(): JSX.Element {
  const { t } = useLang()
  const diag = useDiag()
  const [openModule, setOpenModule] = useState<DiagModuleId | null>(null)
  const running = diagRunning(diag)
  const everRun = diag.run != null

  useEffect(() => {
    void refreshDiag()
  }, [])

  const toggle = (id: DiagModuleId): void => setOpenModule(openModule === id ? null : id)

  return (
    <div className="card" style={{ marginTop: 28 }} id="exit-diag">
      <div className="card-head" style={{ marginBottom: 12 }}>
        <div>
          <div className="card-eyebrow">{t('diag.title')}</div>
          <p className="caption" style={{ marginTop: 4, maxWidth: 640, lineHeight: 1.7 }}>
            {t('diag.intro')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {running ? (
            <button className="btn btn-ghost btn-sm" onClick={() => void stopDiag()}>
              <CircleStop size={14} /> {t('diag.stop')}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void startDiag(MODULE_IDS)}
            >
              <Play size={14} /> {everRun ? t('diag.rerunAll') : t('diag.runAll')}
            </button>
          )}
        </div>
      </div>

      {diag.run?.status === 'running' && (
        <p className="caption" style={{ marginBottom: 10 }}>
          {t('diag.runningHint', { id: diag.run.runId })}
        </p>
      )}
      {diag.run && ['canceled', 'timeout'].includes(diag.run.status) && (
        <p className="caption" style={{ marginBottom: 10, color: 'var(--warn)' }}>
           {t('diag.runEnd.canceled', { time: fmtTime(diag.run.finishedAt) })}
        </p>
      )}

      <div className="diag-grid">
        {MODULE_IDS.map((id) => (
          <ModuleCard key={id} run={diag.run} id={id} open={openModule === id} onToggle={() => toggle(id)} />
        ))}
      </div>

      {diag.run && (
        <p className="caption" style={{ marginTop: 10 }}>
          {t('diag.runMeta', {
            runId: diag.run.runId,
            start: new Date(diag.run.startedAt).toLocaleString(),
            stats: t('diag.moduleStats', {
              ok: diag.summary?.stats.ok ?? 0,
              total: diag.summary?.stats.probes ?? 0
            })
          })}
        </p>
      )}
      <p className="caption" style={{ marginTop: 4, lineHeight: 1.7 }}>
        {t('diag.privacyNote')}
      </p>
    </div>
  )
}
