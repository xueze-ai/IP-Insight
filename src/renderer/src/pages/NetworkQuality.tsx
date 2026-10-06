import { ArrowDown, ArrowUp, ExternalLink, Gauge, RefreshCw, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { JSX, ReactNode } from 'react'
import type {
  ReachProbeResult,
  ServiceStatusFeed,
  ServiceStatusItem
} from '@shared/types'
import { useDetectionContext } from '../state/DetectionContext'
import {
  getSpeedtest,
  startSpeedtest,
  subscribeSpeedtest
} from '../state/speedtestStore'
import { tt, useLang } from '../i18n'
import type { TKey } from '../i18n'

// =============================================================
// 网络质量页
// · Download / Upload / Ping / Jitter：内置 Cloudflare 官方引擎真实测量
// · 全球节点延迟：综合检测中 Net.Coffee /api/ping/start 的真实结果（20 节点，min/avg/max）
// · 服务可用性：Net.Coffee /status/ 公开聚合（各服务官方 statuspage 源）
// · 本机可达性：主进程真实 HTTP 探测（ChatGPT / 抖音 / 百度 等）
// 所有数值均为真实测量 / 真实聚合；拿不到就显示「— / 不可达 / 未测得」，不估算、不伪造。
// =============================================================

const SERVICE_STATUS_PAGE_URL = 'https://ip.net.coffee/status/'

interface SpeedRaw {
  phase?: string
  error?: string
  trace?: Record<string, string>
  summary?: Record<string, number>
  scores?: Record<string, { points?: number; classificationName?: string }>
  log?: string[]
  startedAt?: number
  finishedAt?: number
}

/* 测速阶段 → 字典 key（渲染时经 tt 解析，阶段文案随语言切换） */
const PHASE_LABEL_KEY: Record<string, TKey> = {
  '': 'network.phase.preparing',
  starting: 'network.phase.starting',
  running: 'network.phase.starting',
  latency: 'network.phase.latency',
  download: 'network.phase.download',
  upload: 'network.phase.upload',
  finished: 'network.phase.finished',
  error: 'network.phase.error'
}

function fmtMbps(n: number | null | undefined): string {
  if (n == null) return '—'
  return n >= 100 ? n.toFixed(0) : n.toFixed(1)
}

function fmtMs(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n.toFixed(1)} ms`
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/* 站点口径：<100ms 好 / <350ms 偏慢 / 其余 差 */
function pingTone(ms: number | null | undefined): string {
  if (ms == null) return 'var(--text-muted)'
  if (ms < 100) return 'var(--good)'
  if (ms < 350) return 'var(--warn)'
  return 'var(--bad)'
}

function KV({ k, v }: { k: string; v: ReactNode }): JSX.Element {
  return (
    <div className="kv-row">
      <div className="kv-key">{k}</div>
      <div className="kv-val">{v}</div>
    </div>
  )
}

/* Cloudflare AIM 体验评分：保留原始分类名，仅做色调映射 */
function AimChip({ label, name }: { label: string; name?: string }): JSX.Element {
  const { t } = useLang()
  if (!name) return <span className="chip">{t('network.aim.noScore', { label })}</span>
  const tone = /good|great|excellent/i.test(name)
    ? 'badge-good'
    : /bad|poor/i.test(name)
      ? 'badge-bad'
      : 'badge-warn'
  return (
    <span className="chip">
      {label} <span className={'badge ' + tone}>{name}</span>
    </span>
  )
}

/* 服务状态指示点：none→绿 minor→橙 major/critical→红 maintenance→蓝 其余→灰 */
function dotClass(indicator: string): string {
  if (indicator === 'none') return 'dot-good'
  if (indicator === 'minor') return 'dot-warn'
  if (indicator === 'major' || indicator === 'critical') return 'dot-bad'
  if (indicator === 'maintenance') return 'dot-info'
  return 'dot-neutral'
}

/* 模块级缓存：切页再回来不重复请求；刷新按钮可强制更新 */
let feedCache: { at: number; feed: ServiceStatusFeed } | null = null
let reachCache: ReachProbeResult[] | null = null
let reachCacheAt: number | null = null
let reachStarted = false

export function NetworkQuality(): JSX.Element {
  const { t } = useLang()
  const speed = useSyncExternalStore(subscribeSpeedtest, getSpeedtest)
  const { steps } = useDetectionContext()
  const [rawOpen, setRawOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const [feed, setFeed] = useState<ServiceStatusFeed | null>(feedCache?.feed ?? null)
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [reach, setReach] = useState<ReachProbeResult[] | null>(reachCache)
  const [reachAt, setReachAt] = useState<number | null>(reachCacheAt)
  const [reachLoading, setReachLoading] = useState(false)
  const [reachError, setReachError] = useState<string | null>(null)

  useEffect(() => {
    if (speed.status !== 'running') return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [speed.status])

  const loadFeed = useCallback(async (force = false) => {
    if (!force && feedCache && Date.now() - feedCache.at < 5 * 60_000) {
      setFeed(feedCache.feed)
      return
    }
    setFeedLoading(true)
    setFeedError(null)
    const r = await window.ipInsight.fetchServiceStatus()
    setFeedLoading(false)
    if (r.ok && r.feed) {
      feedCache = { at: Date.now(), feed: r.feed }
      setFeed(r.feed)
    } else {
      setFeedError(r.error ?? tt('network.svc.feedError'))
    }
  }, [])

  const loadReach = useCallback(async () => {
    setReachLoading(true)
    setReachError(null)
    const r = await window.ipInsight.probeReachability()
    setReachLoading(false)
    if (r.ok && r.results) {
      reachCache = r.results
      reachCacheAt = Date.now()
      setReach(r.results)
      setReachAt(reachCacheAt)
    } else {
      setReachError(r.error ?? tt('network.reach.probeError'))
    }
  }, [])

  useEffect(() => {
    void loadFeed()
    if (!reachStarted) {
      reachStarted = true
      void loadReach()
    }
  }, [loadFeed, loadReach])

  const elapsed = speed.startedAt
    ? Math.max(
        0,
        Math.round(
          ((speed.status === 'running' ? now : (speed.finishedAt ?? now)) -
            speed.startedAt) /
            1000
        )
      )
    : 0

  const raw = speed.result?.raw as SpeedRaw | undefined
  const s = raw?.summary
  const trace = raw?.trace
  const scores = raw?.scores

  const nc = steps.find((x) => x.key === 'netcoffee')?.result
  const gp = nc?.globalPing ?? []
  /* 数据口径的 continent 字段为中文原文，仅用于分组过滤；展示时映射为当前语言 */
  const continents = ['亚洲', '美洲', '欧洲']
  const continentName = (c: string): string => {
    if (c === '亚洲') return t('network.ping.asia')
    if (c === '美洲') return t('network.ping.america')
    if (c === '欧洲') return t('network.ping.europe')
    if (c === '其他') return t('network.ping.other')
    return c
  }
  const gpGroups = continents
    .map((c) => ({ continent: c, rows: gp.filter((g) => g.continent === c) }))
    .filter((g) => g.rows.length > 0)
  const gpOrphans = gp.filter((g) => !g.continent)

  const failingServices = feed
    ? feed.services.filter((x) => x.indicator !== 'none' && x.indicator !== '')
    : []
  const okServices = feed
    ? feed.services.filter((x) => x.indicator === 'none' || x.indicator === '')
    : []
  const orderedServices: ServiceStatusItem[] = [
    ...failingServices,
    ...okServices
  ]

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">{t('network.kicker')}</span>
      <h1 className="h1" style={{ marginTop: 6 }}>{t('common.nav.network')}</h1>
      <p
        className="muted small"
        style={{ marginTop: 8, maxWidth: 620, lineHeight: 1.75 }}
      >
        {t('network.intro')}
      </p>

      {speed.status === 'idle' && (
        <div
          className="card card-subtle"
          style={{
            marginTop: 26,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            alignItems: 'flex-start'
          }}
        >
          <div className="small two" style={{ lineHeight: 1.75, maxWidth: 560 }}>
            {t('network.idleDesc')}
          </div>
          <button className="btn btn-primary" onClick={startSpeedtest}>
            <Gauge size={16} /> {t('network.startSpeedtest')}
          </button>
        </div>
      )}

      {speed.status === 'running' && (
        <div style={{ marginTop: 26 }}>
          <div className="source-step running">
            <span className="step-mark">
              <span
                className="step-dot pulse"
                style={{ background: 'var(--primary)' }}
              />
            </span>
            <span className="step-name">
              {tt(PHASE_LABEL_KEY[speed.phase] ?? PHASE_LABEL_KEY[''])}
            </span>
            <span className="step-state">{t('network.running.elapsed', { s: elapsed })}</span>
          </div>
          <p className="caption" style={{ marginTop: 10, lineHeight: 1.7 }}>
            {t('network.running.desc')}
          </p>
        </div>
      )}

      {speed.status === 'error' && (
        <div className="card" style={{ marginTop: 26 }}>
          <span className="badge badge-bad">{t('network.error.badge')}</span>
          <p className="small two" style={{ marginTop: 10, lineHeight: 1.7 }}>
            {speed.error}
          </p>
          <p className="caption" style={{ marginTop: 6 }}>
            {t('network.error.hint')}
          </p>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={startSpeedtest}>
              <RotateCcw size={15} /> {t('common.action.retry')}
            </button>
          </div>
        </div>
      )}

      {speed.status === 'done' && speed.result && (
        <>
          <div className="speed-hero">
            <div className="speed-cell">
              <div className="speed-label">
                <ArrowDown size={15} style={{ color: 'var(--primary)' }} />
                {t('network.downloadLabel')}
              </div>
              <div className="speed-value">
                {fmtMbps(speed.result.downloadMbps)}
                <span className="speed-unit">Mbps</span>
              </div>
            </div>
            <div className="speed-cell">
              <div className="speed-label">
                <ArrowUp size={15} style={{ color: 'var(--primary)' }} />
                {t('network.uploadLabel')}
              </div>
              <div className="speed-value">
                {fmtMbps(speed.result.uploadMbps)}
                <span className="speed-unit">Mbps</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="kv">
              <KV k={t('network.kv.ping')} v={fmtMs(s?.latency)} />
              <KV k={t('network.kv.jitter')} v={fmtMs(s?.jitter)} />
              <KV
                k={t('network.kv.loadedPingDown')}
                v={`${fmtMs(s?.downLoadedLatency)} / ${fmtMs(s?.downLoadedJitter)}`}
              />
              <KV
                k={t('network.kv.loadedPingUp')}
                v={`${fmtMs(s?.upLoadedLatency)} / ${fmtMs(s?.upLoadedJitter)}`}
              />
              <KV
                k={t('network.kv.loss')}
                v={
                  <span
                    className="badge badge-neutral"
                    title={t('network.kv.lossTitle')}
                  >
                    {t('network.notMeasured')}
                  </span>
                }
              />
              <KV
                k={t('network.kv.exitIp')}
                v={
                  trace?.ip ? (
                    <span className="mono">
                      {trace.ip}
                      {trace.colo
                        ? t('network.kv.exitIpDetail', {
                            colo: trace.colo,
                            suffix: trace.loc
                              ? t('network.kv.exitIpSep', { loc: trace.loc })
                              : ''
                          })
                        : ''}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <KV
                k={t('network.kv.duration')}
                v={
                  s?.totalDurationMs != null
                    ? t('network.kv.durationSec', { n: (s.totalDurationMs / 1000).toFixed(1) })
                    : elapsed
                      ? t('network.kv.durationSec', { n: elapsed })
                      : '—'
                }
              />
              <KV
                k={t('network.kv.time')}
                v={new Date(speed.result.fetchedAt).toLocaleString()}
              />
            </div>
          </div>
          <p className="caption" style={{ marginTop: 8, lineHeight: 1.7 }}>
            {t('network.lossNote')}
          </p>

          {scores && Object.keys(scores).length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-eyebrow" style={{ marginBottom: 12 }}>
                {t('network.aim.title')}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <AimChip label={t('network.aim.streaming')} name={scores.streaming?.classificationName} />
                <AimChip label={t('network.aim.gaming')} name={scores.gaming?.classificationName} />
                <AimChip label={t('network.aim.rtc')} name={scores.rtc?.classificationName} />
              </div>
              <p className="caption" style={{ marginTop: 10, lineHeight: 1.7 }}>
                {t('network.aim.note')}
              </p>
            </div>
          )}

          <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={startSpeedtest}>
              <RotateCcw size={16} /> {t('network.retest')}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => void window.ipInsight.openSource('https://speed.cloudflare.com/')}
            >
              <ExternalLink size={15} /> {t('network.viewSource')}
            </button>
            <button className="btn btn-text" onClick={() => setRawOpen((v) => !v)}>
              {rawOpen ? t('network.rawHide') : t('network.rawShow')}
            </button>
          </div>

          {rawOpen && (
            <div className="card card-subtle card-pad-sm" style={{ marginTop: 12 }}>
              <pre
                className="mono"
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.6,
                  maxHeight: 320,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--text-2)'
                }}
              >
                {JSON.stringify(
                  { summary: s ?? null, scores: scores ?? null, trace: trace ?? null },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </>
      )}

      {/* ---------- 全球节点延迟 ---------- */}
      <div className="card" style={{ marginTop: 28 }}>
        <div className="card-head" style={{ marginBottom: 6 }}>
          <div className="card-eyebrow">{t('network.ping.title')}</div>
          {gp.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void window.ipInsight.openSource('https://ip.net.coffee/ping/')}
            >
              <ExternalLink size={14} /> {t('network.viewSource')}
            </button>
          )}
        </div>
        {gp.length > 0 ? (
          <>
            <div className="gping-head">
              <span>{t('network.ping.node')}</span>
              <span className="gping-val">{t('network.ping.min')}</span>
              <span className="gping-val">{t('network.ping.avg')}</span>
              <span className="gping-val">{t('network.ping.max')}</span>
            </div>
            {[...gpGroups, ...(gpOrphans.length ? [{ continent: '其他', rows: gpOrphans }] : [])].map(
              (g) => (
                <div key={g.continent}>
                  <div className="gping-cont">{continentName(g.continent)}</div>
                  {g.rows.map((r) => {
                    const avg = r.avgMs ?? r.latencyMs
                    const tone = pingTone(avg)
                    return (
                      <div className="gping-row" key={r.node}>
                        <span className="gping-node">
                          {r.name ?? r.node}
                          {r.city && (
                            <span className="muted" style={{ marginLeft: 6, fontSize: 11.5 }}>
                              {r.city}
                            </span>
                          )}
                        </span>
                        <span className="gping-val" style={{ color: r.minMs != null ? tone : 'var(--text-muted)' }}>
                          {r.minMs != null ? `${r.minMs} ms` : r.reachable === false ? t('network.ping.unreachable') : '—'}
                        </span>
                        <span className="gping-val strong" style={{ color: avg != null ? tone : 'var(--text-muted)' }}>
                          {avg != null ? `${avg} ms` : r.reachable === false ? t('network.ping.unreachable') : '—'}
                        </span>
                        <span className="gping-val" style={{ color: r.maxMs != null ? tone : 'var(--text-muted)' }}>
                          {r.maxMs != null ? `${r.maxMs} ms` : r.reachable === false ? t('network.ping.unreachable') : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            )}
            <p className="caption" style={{ marginTop: 10, lineHeight: 1.7 }}>
              {t('network.ping.note')}
            </p>
          </>
        ) : (
          <p className="muted small" style={{ marginTop: 10, lineHeight: 1.75 }}>
            {t('network.ping.empty')}
          </p>
        )}
      </div>

      {/* ---------- 服务可用性 ---------- */}
      <div className="card" style={{ marginTop: 28 }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div className="card-eyebrow">{t('network.svc.title')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void loadFeed(true)}
              disabled={feedLoading}
            >
              <RefreshCw size={14} className={feedLoading ? 'spin' : undefined} /> {t('common.action.refresh')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void window.ipInsight.openSource(SERVICE_STATUS_PAGE_URL)}
            >
              <ExternalLink size={14} /> {t('network.svc.sourceSite')}
            </button>
          </div>
        </div>
        {feedLoading && !feed && <div className="skeleton" style={{ height: 120 }} />}
        {feedError && !feed && (
          <p className="small" style={{ color: 'var(--bad)' }}>
            {feedError}{t('network.svc.sourceDown')}
          </p>
        )}
        {feed && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={'badge ' + (feed.failing > 0 ? 'badge-warn' : 'badge-good')}>
                {feed.failing > 0 ? t('network.svc.failing', { n: feed.failing }) : t('network.svc.allOk')}
              </span>
              <span className="caption">
                {t('network.svc.meta', {
                  count: feed.count,
                  fetchedAt: fmtTime(feed.fetchedAt),
                  fetchedLocalAt: fmtTime(feed.fetchedLocalAt)
                })}
              </span>
            </div>
            <div className="svc-grid">
              {orderedServices.map((sv) => (
                <div className="svc-item" key={sv.key}>
                  <span className={'svc-dot ' + dotClass(sv.indicator)} />
                  <span className="svc-name" title={sv.name}>{sv.name}</span>
                  <span className="svc-tag">{sv.group}</span>
                  <span className="svc-status">
                    {sv.indicator_cn || sv.description || (sv.indicator === 'unknown' ? t('network.svc.unknown') : '—')}
                  </span>
                </div>
              ))}
            </div>
            {failingServices.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="caption strong">{t('network.svc.incidentsTitle')}</div>
                {failingServices.map((sv) => (
                  <p key={sv.key} className="caption" style={{ lineHeight: 1.6 }}>
                    {t('network.svc.incidentLine', {
                      name: sv.name,
                      incident: sv.incidents[0]?.name || sv.description || '—'
                    })}
                    {sv.incidents[0]?.status ? t('network.svc.incidentStatus', { status: sv.incidents[0].status }) : ''}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------- 本机可达性 ---------- */}
      <div className="card" style={{ marginTop: 28 }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div className="card-eyebrow">{t('network.reach.title')}</div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void loadReach()}
            disabled={reachLoading}
          >
            <RefreshCw size={14} className={reachLoading ? 'spin' : undefined} />
            {reach ? t('network.reach.redetect') : t('network.reach.start')}
          </button>
        </div>
        {reachLoading && !reach && <div className="skeleton" style={{ height: 100 }} />}
        {reachError && (
          <p className="small" style={{ color: 'var(--bad)' }}>{reachError}</p>
        )}
        {reach && (
          <div className="kv">
            {reach.map((r) => (
              <div className="kv-row" key={r.name}>
                <div className="kv-key">
                  {r.name}{' '}
                  <span className="muted mono" style={{ fontSize: 11.5 }}>{r.host}</span>
                </div>
                <div className="kv-val" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {r.ok ? (
                    <span className="badge badge-good">{t('network.reach.ok', { ms: r.ms ?? '—' })}</span>
                  ) : (
                    <>
                      <span className="badge badge-bad">
                        {r.ms != null ? t('network.reach.failMs', { ms: r.ms }) : t('network.reach.fail')}
                      </span>
                      {r.error && (
                        <span className="caption mono">{r.error}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {reachAt && (
          <p className="caption" style={{ marginTop: 8 }}>
            {t('network.reach.probedAt', { time: new Date(reachAt).toLocaleString() })}
          </p>
        )}
        <p className="caption" style={{ marginTop: 6, lineHeight: 1.7 }}>
          {t('network.reach.note')}
        </p>
      </div>
    </div>
  )
}
