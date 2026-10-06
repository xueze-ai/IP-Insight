import { ChevronDown, ExternalLink, Fingerprint as FpIcon, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { Fingerprint, NormalizedIPResult } from '@shared/types'
import { useDetectionContext } from '../state/DetectionContext'
import { requestNav } from '../state/navStore'
import { useLang } from '../i18n'

// =============================================================
// 浏览器指纹页（文档 §16）
// 分组：Browser / Device / Graphics / Privacy / Fingerprint；
// 默认只给分组摘要，「查看详细指纹」点击后再展开 UA / 字体 / 语言 / 原始 JSON。
// 数据源：Net.Coffee GPT 源在隐藏浏览器内真实计算（固定绘制，稳定可复现）。
// 诚实标注：指纹反映的是本软件内置隐藏浏览器（Chromium）的真实环境，
//          与你日常使用的浏览器可能不同；用于评估检测出口的指纹暴露面。
// =============================================================

function Row({ k, v }: { k: string; v: ReactNode }): JSX.Element {
  return (
    <div className="kv-row">
      <div className="kv-key">{k}</div>
      <div className="kv-val">{v ?? <span className="muted">—</span>}</div>
    </div>
  )
}

function Group({
  title,
  children
}: {
  title: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="card">
      <div className="card-eyebrow" style={{ marginBottom: 10 }}>
        {title}
      </div>
      <div className="kv">{children}</div>
    </div>
  )
}

function LeakBadge({
  leak
}: {
  leak?: { status: string; exitIp?: string; country?: string }
}): JSX.Element {
  const { t } = useLang()
  if (!leak || !leak.status)
    return <span className="badge badge-neutral">{t('fingerprint.leakNotChecked')}</span>
  const bad = leak.status.includes('泄露')
  return (
    <span className={'badge ' + (bad ? 'badge-bad' : 'badge-good')} title={leak.exitIp}>
      {leak.status}
      {leak.exitIp ? ` · ${leak.exitIp}` : ''}
    </span>
  )
}

const D = <span className="muted">—</span>

export function FingerprintPage(): JSX.Element {
  const { steps, run } = useDetectionContext()
  const [open, setOpen] = useState(false)
  const { t } = useLang()

  const gpt = steps.find((s) => s.key === 'netcoffee_gpt')?.result
  const fp: Fingerprint | undefined = gpt?.fingerprint

  if (!gpt || !fp) {
    const reason = gpt?.error
    return (
      <div className="page" style={{ paddingTop: 120 }}>
        <h1 className="h1">{t('common.nav.fingerprint')}</h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: 560, lineHeight: 1.75 }}>
          {t('fingerprint.empty.intro')}
          {reason ? t('fingerprint.empty.failed', { reason }) : t('fingerprint.empty.hint')}
        </p>
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              requestNav('dashboard')
              run()
            }}
          >
            {t('fingerprint.startDetection')}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void window.ipInsight.openSource('https://ippure.com/fingerprint')}
          >
            <ExternalLink size={15} /> {t('fingerprint.openIppure')}
          </button>
        </div>
      </div>
    )
  }

  const tzBadge =
    fp.timezoneConsistent === true ? (
      <span className="badge badge-good">{t('fingerprint.tz.consistent')}</span>
    ) : fp.timezoneConsistent === false ? (
      <span className="badge badge-warn">{t('fingerprint.tz.inconsistent')}</span>
    ) : (
      <span className="badge badge-neutral">{t('fingerprint.tz.unknown')}</span>
    )

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">{t('fingerprint.kicker')}</span>
      <h1 className="h1" style={{ marginTop: 6 }}>{t('common.nav.fingerprint')}</h1>
      <p className="muted small" style={{ marginTop: 8, maxWidth: 640, lineHeight: 1.75 }}>
        {t('fingerprint.desc')}
      </p>

      <div className="ip-cols" style={{ marginTop: 26 }}>
        <Group title={t('fingerprint.group.browser')}>
          <Row
            k={t('fingerprint.row.browser')}
            v={fp.browser ? `${fp.browser}${fp.browserVersion ? ' ' + fp.browserVersion : ''}` : D}
          />
          <Row k={t('fingerprint.row.os')} v={fp.os || D} />
          <Row k="Platform" v={fp.platform ? <span className="mono">{fp.platform}</span> : D} />
          <Row k={t('fingerprint.row.language')} v={fp.language ? <span className="mono">{fp.language}</span> : D} />
          <Row
            k={t('fingerprint.row.cookie')}
            v={
              fp.cookiesEnabled == null ? (
                D
              ) : fp.cookiesEnabled ? (
                <span className="badge badge-good">{t('fingerprint.cookie.enabled')}</span>
              ) : (
                <span className="badge badge-warn">{t('fingerprint.cookie.disabled')}</span>
              )
            }
          />
        </Group>

        <Group title={t('fingerprint.group.device')}>
          <Row k={t('fingerprint.row.screen')} v={fp.screen ? <span className="mono">{fp.screen}</span> : D} />
          <Row k={t('fingerprint.row.colorDepth')} v={fp.colorDepth != null ? `${fp.colorDepth} bit` : D} />
          <Row k={t('fingerprint.row.cpuThreads')} v={fp.hardwareConcurrency != null ? `${fp.hardwareConcurrency}` : D} />
          <Row
            k={t('fingerprint.row.deviceMemory')}
            v={fp.deviceMemory != null ? t('fingerprint.row.deviceMemoryVal', { gb: fp.deviceMemory }) : D}
          />
        </Group>

        <Group title={t('fingerprint.group.graphics')}>
          <Row k={t('fingerprint.row.gpuRenderer')} v={fp.webglRenderer || D} />
          <Row k={t('fingerprint.row.webgl')} v={fp.webgl ? <span className="mono">{fp.webgl}</span> : D} />
          <Row k={t('fingerprint.row.canvas')} v={fp.canvas ? <span className="mono">{fp.canvas}</span> : D} />
          <Row k={t('fingerprint.row.audio')} v={fp.audio ? <span className="mono">{fp.audio}</span> : D} />
        </Group>

        <Group title={t('fingerprint.group.privacy')}>
          <Row k={t('fingerprint.row.timezone')} v={fp.timezone ? <span className="mono">{fp.timezone}</span> : D} />
          <Row k={t('fingerprint.row.tzConsistency')} v={tzBadge} />
          <Row k={t('fingerprint.row.dnsLeak')} v={<LeakBadge leak={gpt.dnsLeak} />} />
          <Row k={t('fingerprint.row.webrtcLeak')} v={<LeakBadge leak={gpt.webRTCLeak} />} />
        </Group>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-eyebrow" style={{ marginBottom: 10 }}>
          {t('fingerprint.full.title')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="fp-id">
            <FpIcon size={18} style={{ opacity: 0.7 }} />
            {fp.visitorId ?? '—'}
          </span>
          {fp.fonts?.length != null && (
            <span className="badge badge-neutral">{t('fingerprint.full.fontCount', { n: fp.fonts.length })}</span>
          )}
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="caption" style={{ flex: '0 0 auto' }}>{t('fingerprint.full.prefLanguage')}</span>
          {fp.languages?.length ? (
            fp.languages.map((l) => (
              <span className="chip mono" key={l} style={{ fontSize: 12 }}>
                {l}
              </span>
            ))
          ) : (
            <span className="caption">—</span>
          )}
        </div>
        {fp.visitorId == null && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={run}>
              <RefreshCw size={14} /> {t('fingerprint.full.rerun')}
            </button>
          </div>
        )}
        <p className="caption" style={{ marginTop: 10, lineHeight: 1.7 }}>
          {t('fingerprint.full.desc')}
          {fp.visitorId == null && t('fingerprint.full.legacyNote')}
        </p>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>
          <ChevronDown
            size={16}
            style={{
              transform: open ? 'rotate(180deg)' : undefined,
              transition: 'transform var(--dur-fast) var(--ease)'
            }}
          />
          {open ? t('fingerprint.detail.collapse') : t('fingerprint.detail.expand')}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => void window.ipInsight.openSource('https://ip.net.coffee/gpt/')}
        >
          <ExternalLink size={15} /> {t('fingerprint.viewGptSource')}
        </button>
      </div>

      {open && (
        <div className="card card-subtle card-pad-sm" style={{ marginTop: 12 }}>
          <div className="caption strong" style={{ marginBottom: 6 }}>User-Agent</div>
          <pre className="mono fp-pre">{fp.userAgent ?? '—'}</pre>

          <div className="caption strong" style={{ margin: '12px 0 6px' }}>
            {t('fingerprint.detail.prefLanguageList')}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {fp.languages?.length ? (
              fp.languages.map((l) => (
                <span className="chip mono" key={l} style={{ fontSize: 12 }}>
                  {l}
                </span>
              ))
            ) : (
              <span className="caption">—</span>
            )}
          </div>

          <div className="caption strong" style={{ margin: '12px 0 6px' }}>
            {t('fingerprint.detail.fontListTitle')}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {fp.fonts?.length ? (
              fp.fonts.map((f) => (
                <span className="chip" key={f} style={{ fontSize: 12 }}>
                  {f}
                </span>
              ))
            ) : fp.fonts ? (
              <span className="caption">{t('fingerprint.detail.noFonts')}</span>
            ) : (
              <span className="caption">{t('fingerprint.detail.fontsNotCollected')}</span>
            )}
          </div>

          <div className="caption strong" style={{ margin: '12px 0 6px' }}>
            {t('fingerprint.detail.rawJson')}
          </div>
          <pre className="mono fp-pre">{JSON.stringify(fp, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
