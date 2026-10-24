import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  RotateCcw,
  XCircle
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { NormalizedIPResult } from '@shared/types'
import { type SourceStep, type StepStatus } from '../hooks/useDetection'
import { useDetectionContext } from '../state/DetectionContext'
import { requestNav } from '../state/navStore'
import { MultiSource } from '../components/MultiSource'
import { ExportDialog } from '../components/ExportDialog'
import { buildReportModel } from '../utils/report'
import { flagConsensus, leakBadgeCls, leakBadgeState, successfulResults, TRI_VIEW } from '../utils/aggregate'
import { useLang } from '../i18n'
import type { TKey } from '../i18n'

function byKey(steps: SourceStep[], key: string): NormalizedIPResult | undefined {
  return steps.find((s) => s.key === key)?.result
}

/* ---------- 检测步骤行 ---------- */
function Mark({ status }: { status: StepStatus }): JSX.Element {
  if (status === 'running')
    return (
      <Loader2 size={18} className="spin" style={{ color: 'var(--primary)' }} />
    )
  if (status === 'ok')
    return <CheckCircle2 size={18} style={{ color: 'var(--good)' }} />
  if (status === 'fail')
    return <XCircle size={18} style={{ color: 'var(--bad)' }} />
  return <Circle size={18} style={{ color: 'var(--text-disabled)' }} />
}

function StepRow({ s }: { s: SourceStep }): JSX.Element {
  const { t } = useLang()
  const stateText =
    s.status === 'waiting'
      ? t('dashboard.step.waiting')
      : s.status === 'running'
        ? t('dashboard.step.running')
        : s.status === 'ok'
          ? t('dashboard.step.done', { sec: (s.durationMs! / 1000).toFixed(1) })
          : t('dashboard.step.failed')
  return (
    <div className={'source-step' + (s.status === 'running' ? ' running' : '')}>
      <span className="step-mark">
        <Mark status={s.status} />
      </span>
      <span className="step-name">{s.name}</span>
      <span
        className={
          'step-state ' +
          (s.status === 'ok' ? 'ok' : s.status === 'fail' ? 'fail' : '')
        }
      >
        {stateText}
      </span>
    </div>
  )
}

function KV({ k, v }: { k: string; v: ReactNode }): JSX.Element {
  return (
    <div className="kv-row">
      <div className="kv-key">{k}</div>
      <div className="kv-val">{v}</div>
    </div>
  )
}

/* ---------- Dashboard ---------- */
export function Dashboard(): JSX.Element {
  const {
    phase,
    steps,
    currentIp,
    successCount,
    totalCount,
    diag,
    viewSource,
    startedAt,
    run,
    finishedAt,
    aiReport
  } = useDetectionContext()
  const [expanded, setExpanded] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [explain, setExplain] = useState(false)
  const { t } = useLang()

  // 设置联动：启动时自动综合检测（仅空闲态触发一次）
  useEffect(() => {
    if (phase !== 'idle') return
    let on = true
    window.ipInsight
      .getSettings()
      .then((r) => {
        if (on && r.settings?.detection?.autoRunOnStart) void run()
      })
      .catch(() => undefined)
    return () => {
      on = false
    }
  }, [phase, run])

  if (phase === 'idle') {
    return (
      <div className="page dash-hero">
        <div className="dash-kicker">
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              background: 'var(--primary)'
            }}
          />
          {t('dashboard.hero.kicker')}
        </div>
        <h1 className="display">{t('dashboard.hero.title')}</h1>
        <p className="two" style={{ marginTop: 18, maxWidth: 540, lineHeight: 1.75 }}>
          {t('dashboard.hero.desc')}
        </p>
        <div style={{ marginTop: 30 }}>
          <button className="btn btn-primary" onClick={run}>
            {t('dashboard.start')}
          </button>
        </div>
        <div className="dash-current">
          <span className="caption">{t('dashboard.hero.currentEnv')}</span>
          <span className="dash-current-meta">
            {t('dashboard.hero.currentEnvHint', { action: t('dashboard.start') })}
          </span>
        </div>
      </div>
    )
  }

  if (phase === 'running') {
    return (
      <div className="page" style={{ paddingTop: 40 }}>
        <h1 className="h1">{t('dashboard.running')}</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {t('dashboard.runningDesc')}
        </p>
        {currentIp && (
          <div className="dash-current">
            <span className="caption">{t('dashboard.currentIp')}</span>
            <span className="dash-current-ip">{currentIp}</span>
          </div>
        )}
        <div className="source-steps">
          {steps.map((s) => (
            <StepRow key={s.key} s={s} />
          ))}
        </div>
      </div>
    )
  }

  // done
  const okRs = successfulResults(steps)
  const p0 = byKey(steps, 'ping0')
  const gpt = byKey(steps, 'netcoffee_gpt')
  const vpn = flagConsensus(okRs, 'vpn').state
  const proxy = flagConsensus(okRs, 'proxy').state
  const tor = flagConsensus(okRs, 'tor').state
  const dnsStatus = gpt?.dnsLeak?.status
  const webrtcStatus = gpt?.webRTCLeak?.status
  const nativeLabels = Array.from(
    new Set(steps.map((s) => s.result?.nativeLabel).filter(Boolean))
  ) as string[]

  const hasConflict = [vpn, proxy, tor].includes('conflict')
  const dnsBadge = leakBadgeState(gpt?.dnsLeak)
  const webrtcBadge = leakBadgeState(gpt?.webRTCLeak)
  const hasLeak = dnsBadge === 'leak' || webrtcBadge === 'leak'

  const loc = [p0?.country, p0?.region, p0?.city].filter(Boolean).join(' · ')

  // 轻量出口诊断（Sukka 模块 publicIp）摘要
  const diagProbes = diag?.probes?.publicIp ?? []
  const diagIps = [...new Set(diagProbes.filter((p) => p.status === 'success' && p.ip).map((p) => p.ip as string))]
  const diagFailed = diagProbes.filter((p) => p.status === 'failed' || p.status === 'timeout').length

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">
        {t('dashboard.doneKicker', { ok: successCount, total: totalCount })}
      </span>
      {viewSource === 'history' && startedAt && (
        <div style={{ marginTop: 10 }}>
          <span className="badge badge-info">
            {t('history.viewSourceHistory', { time: new Date(startedAt).toLocaleString() })}
          </span>
        </div>
      )}
      {steps.length === 0 && diag ? (
        <div className="card card-subtle" style={{ marginTop: 14, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-info">{t('diag.save.kindBadge')}</span>
          <span className="small">{t('dashboard.diagOnlyHint')}</span>
          <button className="btn btn-tonal btn-sm" style={{ marginLeft: 'auto' }} onClick={() => requestNav('exitDiag')}>
            {t('dashboard.diagMore')}
          </button>
        </div>
      ) : (
        <div
          className="mono"
          style={{ marginTop: 10, fontSize: 28, fontWeight: 600, letterSpacing: '-0.3px' }}
        >
          {currentIp ?? '—'}
        </div>
      )}
      <div className="muted small" style={{ marginTop: 8 }}>
        {p0?.isp} · {p0?.asn}
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>
        {loc}
        {gpt?.ip ? t('dashboard.chatgptExit', { ip: gpt.ip, country: gpt.country ?? '' }) : ''}
      </div>

      {/* 轻量出口诊断摘要：来自多个观测点，多出口并排展示，不做风险推断 */}
      {diag && diagProbes.length > 0 && (
        <div
          className="card card-subtle"
          style={{ marginTop: 20, padding: '14px 18px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <span className="badge badge-info">{t('dashboard.diagBadge')}</span>
          {diagIps.length > 0 ? (
            <span className="small">
              {t('dashboard.diagExits', { ips: diagIps.slice(0, 3).join(' / ') })}
            </span>
          ) : (
            <span className="small">{t('dashboard.diagNone')}</span>
          )}
          {diagFailed > 0 && (
            <span className="caption">{t('dashboard.diagFailed', { n: diagFailed })}</span>
          )}
          <span className="caption" style={{ marginLeft: 'auto' }}>
            <a
              className="diag-anchor"
              href="#network"
              onClick={(e) => {
                e.preventDefault()
                requestNav('exitDiag')
              }}
            >
              {t('dashboard.diagMore')}
            </a>
          </span>
        </div>
      )}

      {(hasConflict || hasLeak) && (
        <div
          className="card card-subtle"
          style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--warn)', marginTop: 1 }} />
          <div className="small" style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
            {hasConflict && t('dashboard.alert.conflict')}
            {hasLeak && t('dashboard.alert.leak')}
            {t('dashboard.alert.tail')}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="kv">
          <KV k={t('dashboard.row.vpn')} v={<span className={'badge ' + TRI_VIEW[vpn].cls}>{TRI_VIEW[vpn].text}</span>} />
          <KV k={t('dashboard.row.proxy')} v={<span className={'badge ' + TRI_VIEW[proxy].cls}>{TRI_VIEW[proxy].text}</span>} />
          <KV k={t('dashboard.row.tor')} v={<span className={'badge ' + TRI_VIEW[tor].cls}>{TRI_VIEW[tor].text}</span>} />
          <KV
            k={t('dashboard.row.native')}
            v={nativeLabels.length ? <span className="badge badge-warn">{nativeLabels.join('，')}</span> : '—'}
          />
          <KV
            k={t('dashboard.row.dnsLeak')}
            v={dnsStatus ? <span className={'badge ' + leakBadgeCls(dnsBadge)}>{dnsStatus}</span> : '—'}
          />
          <KV
            k={t('dashboard.row.webrtcLeak')}
            v={webrtcStatus ? <span className={'badge ' + leakBadgeCls(webrtcBadge)}>{webrtcStatus}</span> : '—'}
          />
        </div>
      </div>

      {/* 「这是什么意思」：简明解释（可点击/键盘访问），不影响布局 */}
      <div style={{ marginTop: 10 }}>
        <button className="btn btn-text btn-sm" onClick={() => setExplain((v) => !v)} aria-expanded={explain}>
          {explain ? t('dashboard.explain.hide') : t('dashboard.explain.show')}
        </button>
        {explain && (
          <div className="card card-subtle card-pad-sm" style={{ marginTop: 8 }}>
            {(
              [
                'dashboard.explain.isp',
                'dashboard.explain.asn',
                'dashboard.explain.vpnProxy',
                'dashboard.explain.native',
                'dashboard.explain.leak',
                'dashboard.explain.diag'
              ] as TKey[]
            ).map((k) => (
              <p key={k} className="caption" style={{ lineHeight: 1.8 }}>
                {t(k)}
              </p>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setExpanded(true)}>
          {t('dashboard.viewFull')} <ArrowRight size={17} />
        </button>
        <button className="btn btn-ghost" onClick={run}>
          <RotateCcw size={16} /> {t('dashboard.rerun')}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => setExportOpen(true)}
          disabled={!startedAt || !finishedAt}
        >
          <Download size={16} /> {t('dashboard.exportReport')}
        </button>
      </div>

      {exportOpen && startedAt && finishedAt && (
        <ExportDialog
          model={buildReportModel({
            startedAt,
            finishedAt,
            currentIp,
            results: steps
              .map((s) => s.result)
              .filter((r): r is NormalizedIPResult => !!r),
            sources: steps.map((s) => ({
              name: s.name,
              ok: s.status === 'ok',
              error: s.result?.error,
              durationMs: s.durationMs
            })),
            aiReport,
            diag
          })}
          onClose={() => setExportOpen(false)}
        />
      )}

      {expanded && (
        <div style={{ marginTop: 36 }}>
          <MultiSource />
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-text" onClick={() => setExpanded(false)}>
              {t('dashboard.collapseFull')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
