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

const PHASE_LABEL: Record<string, string> = {
  '': '加载测速页 / 启动引擎',
  starting: '启动测量引擎',
  running: '启动测量引擎',
  latency: '延迟（Ping / Jitter）',
  download: '下载',
  upload: '上传',
  finished: '完成',
  error: '错误'
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
  if (!name) return <span className="chip">{label}：—</span>
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
      setFeedError(r.error ?? '服务状态获取失败')
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
      setReachError(r.error ?? '可达性探测失败')
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
  const continents = ['亚洲', '美洲', '欧洲']
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
      <span className="dash-kicker">Network Quality · 本机实测 + 全球节点</span>
      <h1 className="h1" style={{ marginTop: 6 }}>网络质量</h1>
      <p
        className="muted small"
        style={{ marginTop: 8, maxWidth: 620, lineHeight: 1.75 }}
      >
        Download / Upload / Ping / Jitter
        由内置 Cloudflare 官方测速引擎在隐藏窗口测量；全球节点延迟由
        Net.Coffee 提供；服务可用性聚合各服务官方状态页。
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
            测速将在后台隐藏窗口运行 Cloudflare
            官方测量引擎，全程约 1–2 分钟（带宽越好耗时越长）。 测速期间可继续使用其他页面，结果会保留在本页。
            丢包率依赖 WebRTC TURN 中继，若当前网络环境不可达将显示「未测得」。
          </div>
          <button className="btn btn-primary" onClick={startSpeedtest}>
            <Gauge size={16} /> 开始测速
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
              {PHASE_LABEL[speed.phase] ?? PHASE_LABEL['']}
            </span>
            <span className="step-state">已用时 {elapsed}s</span>
          </div>
          <p className="caption" style={{ marginTop: 10, lineHeight: 1.7 }}>
            测量引擎按阶段自动加压以逼近真实带宽，延迟在各轮负载间穿插采样。
            后台隐藏窗口运行，不弹窗、不阻塞当前页面。
          </p>
        </div>
      )}

      {speed.status === 'error' && (
        <div className="card" style={{ marginTop: 26 }}>
          <span className="badge badge-bad">测速失败</span>
          <p className="small two" style={{ marginTop: 10, lineHeight: 1.7 }}>
            {speed.error}
          </p>
          <p className="caption" style={{ marginTop: 6 }}>
            可在网络恢复后重试。
          </p>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={startSpeedtest}>
              <RotateCcw size={15} /> 重试
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
                Download 下载
              </div>
              <div className="speed-value">
                {fmtMbps(speed.result.downloadMbps)}
                <span className="speed-unit">Mbps</span>
              </div>
            </div>
            <div className="speed-cell">
              <div className="speed-label">
                <ArrowUp size={15} style={{ color: 'var(--primary)' }} />
                Upload 上传
              </div>
              <div className="speed-value">
                {fmtMbps(speed.result.uploadMbps)}
                <span className="speed-unit">Mbps</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="kv">
              <KV k="Ping 空载延迟" v={fmtMs(s?.latency)} />
              <KV k="Jitter 空载抖动" v={fmtMs(s?.jitter)} />
              <KV
                k="下载负载下 Ping / Jitter"
                v={`${fmtMs(s?.downLoadedLatency)} / ${fmtMs(s?.downLoadedJitter)}`}
              />
              <KV
                k="上传负载下 Ping / Jitter"
                v={`${fmtMs(s?.upLoadedLatency)} / ${fmtMs(s?.upLoadedJitter)}`}
              />
              <KV
                k="丢包率"
                v={
                  <span
                    className="badge badge-neutral"
                    title="依赖 WebRTC TURN 中继；当前网络环境不可达时不提供该项"
                  >
                    未测得
                  </span>
                }
              />
              <KV
                k="测速出口 IP"
                v={
                  trace?.ip ? (
                    <span className="mono">
                      {trace.ip}
                      {trace.colo
                        ? `（${trace.colo}${trace.loc ? ' · ' + trace.loc : ''}）`
                        : ''}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <KV
                k="总耗时"
                v={
                  s?.totalDurationMs != null
                    ? `${(s.totalDurationMs / 1000).toFixed(1)} s`
                    : elapsed
                      ? `${elapsed} s`
                      : '—'
                }
              />
              <KV
                k="测量时间"
                v={new Date(speed.result.fetchedAt).toLocaleString()}
              />
            </div>
          </div>
          <p className="caption" style={{ marginTop: 8, lineHeight: 1.7 }}>
            丢包率依赖 WebRTC TURN 中继；当前网络环境不可达，暂不提供该项。
          </p>

          {scores && Object.keys(scores).length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-eyebrow" style={{ marginBottom: 12 }}>
                体验评分 · Cloudflare AIM
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <AimChip label="流媒体" name={scores.streaming?.classificationName} />
                <AimChip label="游戏" name={scores.gaming?.classificationName} />
                <AimChip label="实时通话" name={scores.rtc?.classificationName} />
              </div>
              <p className="caption" style={{ marginTop: 10, lineHeight: 1.7 }}>
                分类由 Cloudflare 官方引擎按本次实测的延迟 / 抖动 / 带宽实时计算，非固定值。
              </p>
            </div>
          )}

          <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={startSpeedtest}>
              <RotateCcw size={16} /> 重新测速
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => void window.ipInsight.openSource('https://speed.cloudflare.com/')}
            >
              <ExternalLink size={15} /> 查看原网站
            </button>
            <button className="btn btn-text" onClick={() => setRawOpen((v) => !v)}>
              {rawOpen ? '收起原始测量数据' : '查看原始测量数据'}
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
          <div className="card-eyebrow">全球节点延迟 · Net.Coffee</div>
          {gp.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void window.ipInsight.openSource('https://ip.net.coffee/ping/')}
            >
              <ExternalLink size={14} /> 查看原网站
            </button>
          )}
        </div>
        {gp.length > 0 ? (
          <>
            <div className="gping-head">
              <span>节点</span>
              <span className="gping-val">最小</span>
              <span className="gping-val">平均</span>
              <span className="gping-val">最大</span>
            </div>
            {[...gpGroups, ...(gpOrphans.length ? [{ continent: '其他', rows: gpOrphans }] : [])].map(
              (g) => (
                <div key={g.continent}>
                  <div className="gping-cont">{g.continent}</div>
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
                          {r.minMs != null ? `${r.minMs} ms` : r.reachable === false ? '不可达' : '—'}
                        </span>
                        <span className="gping-val strong" style={{ color: avg != null ? tone : 'var(--text-muted)' }}>
                          {avg != null ? `${avg} ms` : r.reachable === false ? '不可达' : '—'}
                        </span>
                        <span className="gping-val" style={{ color: r.maxMs != null ? tone : 'var(--text-muted)' }}>
                          {r.maxMs != null ? `${r.maxMs} ms` : r.reachable === false ? '不可达' : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            )}
            <p className="caption" style={{ marginTop: 10, lineHeight: 1.7 }}>
              来源：本次综合检测中 Net.Coffee 全球测速节点的结果（服务端缓存或实时测量，min/avg/max
              与站点同口径）；「不可达」为该节点本次测量无响应。
            </p>
          </>
        ) : (
          <p className="muted small" style={{ marginTop: 10, lineHeight: 1.75 }}>
            全球节点延迟由 Net.Coffee 提供。请先在「综合检测」页完成一次检测，
            本页将按 亚洲 / 美洲 / 欧洲 分组显示 20 个节点的最小 / 平均 / 最大延迟。
          </p>
        )}
      </div>

      {/* ---------- 服务可用性 ---------- */}
      <div className="card" style={{ marginTop: 28 }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div className="card-eyebrow">服务可用性 · Net.Coffee 聚合</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void loadFeed(true)}
              disabled={feedLoading}
            >
              <RefreshCw size={14} className={feedLoading ? 'spin' : undefined} /> 刷新
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void window.ipInsight.openSource(SERVICE_STATUS_PAGE_URL)}
            >
              <ExternalLink size={14} /> 原网站
            </button>
          </div>
        </div>
        {feedLoading && !feed && <div className="skeleton" style={{ height: 120 }} />}
        {feedError && !feed && (
          <p className="small" style={{ color: 'var(--bad)' }}>
            {feedError}（该数据源暂时不可用）
          </p>
        )}
        {feed && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={'badge ' + (feed.failing > 0 ? 'badge-warn' : 'badge-good')}>
                {feed.failing > 0 ? `${feed.failing} 个服务异常` : '全部正常'}
              </span>
              <span className="caption">
                共 {feed.count} 个服务 · 站点聚合时间 {fmtTime(feed.fetchedAt)} · 本地获取{' '}
                {fmtTime(feed.fetchedLocalAt)}
              </span>
            </div>
            <div className="svc-grid">
              {orderedServices.map((sv) => (
                <div className="svc-item" key={sv.key}>
                  <span className={'svc-dot ' + dotClass(sv.indicator)} />
                  <span className="svc-name" title={sv.name}>{sv.name}</span>
                  <span className="svc-tag">{sv.group}</span>
                  <span className="svc-status">
                    {sv.indicator_cn || sv.description || (sv.indicator === 'unknown' ? '状态未知' : '—')}
                  </span>
                </div>
              ))}
            </div>
            {failingServices.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="caption strong">异常服务当前事件</div>
                {failingServices.map((sv) => (
                  <p key={sv.key} className="caption" style={{ lineHeight: 1.6 }}>
                    · {sv.name}：{sv.incidents[0]?.name || sv.description || '—'}
                    {sv.incidents[0]?.status ? `（${sv.incidents[0].status}）` : ''}
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
          <div className="card-eyebrow">本机可达性 · 真实 HTTP 探测</div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void loadReach()}
            disabled={reachLoading}
          >
            <RefreshCw size={14} className={reachLoading ? 'spin' : undefined} />
            {reach ? '重新探测' : '开始探测'}
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
                    <span className="badge badge-good">可达 · {r.ms} ms</span>
                  ) : (
                    <>
                      <span className="badge badge-bad">
                        不可达{r.ms != null ? ` · ${r.ms} ms` : ''}
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
            探测时间：{new Date(reachAt).toLocaleString()}
          </p>
        )}
        <p className="caption" style={{ marginTop: 6, lineHeight: 1.7 }}>
          探测在隐藏浏览器页内发起（与真实浏览器相同的网络栈与请求头，遵循系统代理）；
          收到任何响应记为可达，网络层失败（含重试 1 次后仍失败）或 8s 超时记为不可达并显示真实错误。
          若你的代理仅配置在浏览器插件内而非系统代理，本探测不经过该插件。结果只反映本次探测时刻。
        </p>
      </div>
    </div>
  )
}
