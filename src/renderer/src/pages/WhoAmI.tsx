import { ArrowRight, ChevronDown, Copy, Fingerprint, Gauge, Globe2, Loader2, Radar, RefreshCw, Route, ScanEye, Search, Stethoscope, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type {
  CdnRadarReport,
  DiagnosticReport,
  TracerouteResult,
  WhoRawItem,
  WhoServerReport
} from '@shared/whoami'
import { useLang } from '../i18n'
import type { Params, TKey } from '../i18n'
import { requestNav } from '../state/navStore'
import { startSpeedtest } from '../state/speedtestStore'
import { PROBE_GROUPS, WHO_PROBES } from '../whoami/catalog'
import type { ProbeDef, ProbeGroup } from '../whoami/catalog'
import { bindInteractionProbe, collectClient } from '../whoami/collect'
import { evaluateDisguise, exposureGrade, REGION_PRESETS, simulateRegion } from '../whoami/checks'
import type { DisguiseCheck } from '../whoami/checks'
import { FP_COMPONENTS, fingerprintStability, resetFingerprintBaseline } from '../whoami/fingerprint'
import type { FpStability } from '../whoami/fingerprint'
import { buildBidRequest } from '../whoami/rtb'

// =============================================================
// 「网站眼里的你」
//
// 一页四块：
//  1 概览：一句话结论 + 暴露等级 + 地址/环境要点 + 指纹稳定性 + OpenRTB 视图
//  2 全部探测项：目录 + 搜索 + 分组 + 每条说明（读不到就明说读不到）
//  3 伪装检测：自报 vs 实测的冲突逐条 + 改法
//  4 网络工具箱：路由追踪 / 网络诊断 / CDN 雷达 + 已有能力的快捷入口
//
// 数据来源：服务器侧由主进程真实请求得到，本机侧由浏览器标准 API 读取；
// 页码、分组、稀有度这类「样本库」结论无法在本机复现，页面不做伪造。
// =============================================================

type Tab = 'overview' | 'items' | 'disguise' | 'toolbox'

function useCopy(): (text: string) => void {
  return useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined)
  }, [])
}

export function WhoAmIPage(): JSX.Element {
  const { t, lang } = useLang()
  const copy = useCopy()

  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState('')
  const [server, setServer] = useState<WhoServerReport | null>(null)
  const [client, setClient] = useState<WhoRawItem[]>([])
  const [stability, setStability] = useState<FpStability | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState('')

  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<ProbeGroup | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [regionCode, setRegionCode] = useState('HK')

  // 工具箱状态
  const [traceTarget, setTraceTarget] = useState('1.1.1.1')
  const [traceRunning, setTraceRunning] = useState(false)
  const [trace, setTrace] = useState<TracerouteResult | null>(null)
  const [diagRunning, setDiagRunning] = useState(false)
  const [diag, setDiag] = useState<DiagnosticReport | null>(null)
  const [radarRunning, setRadarRunning] = useState(false)
  const [radar, setRadar] = useState<CdnRadarReport | null>(null)

  const scan = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setPhase(lang === 'zh' ? '正在读取…' : 'Reading…')
    try {
      bindInteractionProbe()
      const s = await window.ipInsight.whoamiServer({
        lang,
        userAgent: navigator.userAgent,
        acceptLanguage: navigator.languages?.join(',') ?? navigator.language
      })
      setServer(s)
      if (s.error) setError(s.error)
      const c = await collectClient()
      setClient(c)
      setStability(fingerprintStability([...s.items, ...c], true))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setPhase('')
    }
  }, [lang])

  useEffect(() => {
    void scan()
  }, [scan])

  const readings = useMemo(() => {
    const all = [...(server?.items ?? []), ...client]
    const m = new Map<string, WhoRawItem>()
    for (const r of all) m.set(r.id, r)
    return m
  }, [server, client])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return WHO_PROBES.filter((p) => group === 'all' || p.group === group).filter((p) => {
      if (!q) return true
      const r = readings.get(p.id)
      const label = `${p.zh} ${p.en}`.toLowerCase()
      return label.includes(q) || (r?.value ?? '').toLowerCase().includes(q)
    })
  }, [query, group, readings])

  const checks = useMemo(
    () => evaluateDisguise({ readings: [...readings.values()], facts: server?.facts, stability: stability ?? emptyStability() }),
    [readings, server, stability]
  )
  const grade = exposureGrade(checks)
  const badChecks = checks.filter((c) => c.level === 'bad' || c.level === 'warn')

  const summary = useMemo(() => buildSummary({ lang, readings, checks, stability }), [lang, readings, checks, stability])

  const rtb = useMemo(
    () => buildBidRequest([...readings.values()], server?.facts.geo ?? null),
    [readings, server]
  )

  const count = WHO_PROBES.length
  const ready = !loading && (client.length > 0 || (server?.items.length ?? 0) > 0)
  const region = simulateRegion(regionCode, [...readings.values()], server?.facts)
  const regionLabel = (code: string): string => {
    try {
      return new Intl.DisplayNames([lang === 'zh' ? 'zh-CN' : 'en'], { type: 'region' }).of(code) ?? code
    } catch {
      return code
    }
  }

  const doCopy = (label: string, text: string): void => {
    copy(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 1600)
  }

  const plainText = (): string => {
    const lines = rows.map((p) => `${lang === 'zh' ? p.zh : p.en}: ${readings.get(p.id)?.value ?? '—'}`)
    return [`IP Insight ${t('whoami.title')} · ${count}`, ...lines].join('\n')
  }

  const runTrace = async (): Promise<void> => {
    setTraceRunning(true)
    try {
      setTrace(await window.ipInsight.traceroute(traceTarget))
    } catch (e) {
      setTrace({
        ok: false, target: traceTarget, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
        durationMs: 0, hops: [], error: e instanceof Error ? e.message : String(e)
      })
    } finally {
      setTraceRunning(false)
    }
  }

  const runDiag = async (): Promise<void> => {
    setDiagRunning(true)
    try {
      setDiag(await window.ipInsight.diagnose())
    } finally {
      setDiagRunning(false)
    }
  }

  const runRadar = async (): Promise<void> => {
    setRadarRunning(true)
    try {
      setRadar(await window.ipInsight.cdnRadar())
    } finally {
      setRadarRunning(false)
    }
  }

  return (
    <div className="whoami">
      <div className="whoami-head">
        <div>
          <div className="dash-kicker">
            <ScanEye size={14} /> {t('whoami.kicker')}
          </div>
          <h1 className="h1" style={{ margin: '6px 0 6px' }}>
            {t('whoami.title')}
          </h1>
          <div className="small muted" style={{ maxWidth: 780, lineHeight: 1.6 }}>
            {t('whoami.desc')}
          </div>
          <div className="whoami-meta">
            <span className="chip">{t('whoami.count', { n: count })}</span>
            {server?.collectedAt && (
              <span className="caption muted">
                {new Date(server.collectedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="whoami-head-actions">
          <button className="btn btn-primary" onClick={() => void scan()} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            {loading ? t('whoami.scanning') : t('whoami.rescan')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => doCopy('text', plainText())}>
            <Copy size={14} /> {copied === 'text' ? t('whoami.copied') : t('whoami.copyText')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => doCopy('json', rtb.json)}>
            <Copy size={14} /> {copied === 'json' ? t('whoami.copied') : t('whoami.copyJson')}
          </button>
        </div>
      </div>

      <div className="whoami-tabs">
        {(['overview', 'items', 'disguise', 'toolbox'] as Tab[]).map((x) => (
          <button key={x} className={`tab${tab === x ? ' active' : ''}`} onClick={() => setTab(x)}>
            {t(`whoami.tabs.${x}`)}
          </button>
        ))}
      </div>

      {error && <div className="card card-subtle small" style={{ color: 'var(--warn, #b45309)' }}>{error}</div>}
      {loading && <div className="whoami-loading small muted"><Loader2 size={14} className="spin" /> {phase}</div>}

      {tab === 'overview' && (ready ? (
        <Overview
          t={t}
          lang={lang}
          grade={grade}
          summary={summary}
          readings={readings}
          stability={stability}
          rtbJson={rtb.json}
          onReset={() => {
            resetFingerprintBaseline()
            setStability({ ...(stability ?? emptyStability()), firstVisit: true, unchanged: 0, changed: [] })
          }}
        />
      ) : (
        <div className="card small muted">{t('whoami.scanning')}</div>
      ))}

      {tab === 'items' && (
        <div className="whoami-items">
          <div className="whoami-toolbar">
            <div className="whoami-search">
              <Search size={14} />
              <input
                className="input"
                placeholder={t('whoami.items.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="whoami-chips">
              <button className={`chip-btn${group === 'all' ? ' active' : ''}`} onClick={() => setGroup('all')}>
                {t('whoami.items.all')} · {count}
              </button>
              {PROBE_GROUPS.map((g) => {
                const n = WHO_PROBES.filter((p) => p.group === g.id).length
                return (
                  <button
                    key={g.id}
                    className={`chip-btn${group === g.id ? ' active' : ''}`}
                    onClick={() => setGroup(g.id)}
                  >
                    {lang === 'zh' ? g.zh : g.en} · {n}
                  </button>
                )
              })}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="card small muted">{t('whoami.items.noResult')}</div>
          ) : (
            <div className="whoami-table">
              {(['server', 'headers', 'locale', 'fingerprint', 'device', 'browser', 'network'] as ProbeGroup[])
                .filter((g) => group === 'all' || g === group)
                .map((g) => {
                  const list = rows.filter((p) => p.group === g)
                  if (!list.length) return null
                  return (
                    <div key={g} className="whoami-group">
                      <div className="whoami-group-head">
                        {lang === 'zh' ? PROBE_GROUPS.find((x) => x.id === g)?.zh : PROBE_GROUPS.find((x) => x.id === g)?.en}
                        <span className="caption muted"> · {list.length}</span>
                      </div>
                      {list.map((p) => (
                        <Row
                          key={p.id}
                          def={p}
                          lang={lang}
                          reading={readings.get(p.id)}
                          t={t}
                          open={openId === p.id}
                          onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                        />
                      ))}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {tab === 'disguise' && (
        <div className="whoami-disguise">
          <div className="whoami-bar">
            <div>
              <div className="title">{t('whoami.disguise.title')}</div>
              <div className="small muted" style={{ maxWidth: 760, lineHeight: 1.6 }}>{t('whoami.disguise.desc')}</div>
            </div>
            <div className="whoami-grade">
              <span className={`whoami-grade-letter g-${grade.grade}`}>{grade.grade}</span>
              <span className="caption muted">{t(`whoami.overview.grade.${grade.grade}`)}</span>
            </div>
          </div>
          <div className="card whoami-region">
            <div className="whoami-bar">
              <div>
                <div className="title">{t('whoami.region.title')}</div>
                <div className="small muted" style={{ maxWidth: 620 }}>{t('whoami.region.desc')}</div>
              </div>
              <select className="select" value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
                {REGION_PRESETS.map((r) => (
                  <option key={r.code} value={r.code}>{regionLabel(r.code)}</option>
                ))}
              </select>
            </div>
            {region && (
              <>
                <div className="small" style={{ margin: '8px 0 6px' }}>
                  {region.ok === region.total
                    ? t('whoami.region.allOk', { n: region.total })
                    : t('whoami.region.summary', { n: region.ok, total: region.total, missing: region.total - region.ok })}
                </div>
                <div className="whoami-region-list">
                  {region.items.map((it) => {
                    const body = lang === 'zh' ? it.zh : it.en
                    const advice = lang === 'zh' ? it.adviceZh : it.adviceEn
                    return (
                      <div key={it.id} className={`whoami-region-item${it.ok ? ' ok' : ''}`}>
                        <span className={`dot-${it.ok ? 'good' : 'bad'}`} />
                        <span className="whoami-region-label">{body.label}</span>
                        <span className="small whoami-region-detail">{body.detail}</span>
                        {advice && <span className="caption muted whoami-region-advice">{advice}</span>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <div className="small muted" style={{ margin: '4px 0 12px' }}>
            {t('whoami.disguise.count', { n: badChecks.length })}
            {badChecks.length === 0 ? ` · ${t('whoami.disguise.clean')}` : ''}
          </div>
          <div className="whoami-check-list">
            {checks.map((c) => (
              <CheckRow key={c.id} c={c} lang={lang} t={t} />
            ))}
          </div>
        </div>
      )}

      {tab === 'toolbox' && (
        <div className="whoami-tools">
          <div className="small muted" style={{ maxWidth: 820, lineHeight: 1.6 }}>{t('whoami.tools.note')}</div>

          <div className="whoami-tool-grid">
            <div className="card whoami-tool">
              <div className="whoami-tool-head">
                <Route size={16} />
                <div className="title">{t('whoami.tools.traceroute.title')}</div>
              </div>
              <div className="small muted">{t('whoami.tools.traceroute.desc')}</div>
              <div className="whoami-inline">
                <span className="caption muted">{t('whoami.tools.traceroute.target')}</span>
                <input
                  className="input"
                  value={traceTarget}
                  placeholder={t('whoami.tools.traceroute.placeholder')}
                  onChange={(e) => setTraceTarget(e.target.value)}
                  style={{ flex: 1, minWidth: 120 }}
                />
                <button className="btn btn-tonal btn-sm" onClick={() => void runTrace()} disabled={traceRunning}>
                  {traceRunning ? <Loader2 size={14} className="spin" /> : <ArrowRight size={14} />}
                  {traceRunning ? t('whoami.tools.traceroute.running') : t('whoami.tools.traceroute.run')}
                </button>
              </div>
              {!trace ? (
                <div className="small muted">{t('whoami.tools.traceroute.noData')}</div>
              ) : !trace.ok ? (
                <div className="small" style={{ color: 'var(--warn, #b45309)' }}>{trace.error}</div>
              ) : (
                <div className="whoami-hop-list">
                  <div className="whoami-hop-head caption muted">
                    <span>{t('whoami.tools.traceroute.colHop')}</span>
                    <span>{t('whoami.tools.traceroute.colAddr')}</span>
                    <span>{t('whoami.tools.traceroute.colRtt')}</span>
                  </div>
                  {trace.hops.map((h) => (
                    <div key={h.hop} className="whoami-hop">
                      <span className="mono">{h.hop}</span>
                      <span className="mono">{h.timeout ? <span className="muted">{t('whoami.tools.traceroute.timeout')}</span> : h.ip ?? <span className="muted">—</span>}</span>
                      <span className="mono small">{h.rtt.length ? `${h.rtt.join(' / ')} ms` : '—'}</span>
                    </div>
                  ))}
                  {trace.hops.length === 0 && <div className="small muted">{t('whoami.tools.traceroute.empty')}</div>}
                </div>
              )}
            </div>

            <div className="card whoami-tool">
              <div className="whoami-tool-head">
                <Stethoscope size={16} />
                <div className="title">{t('whoami.tools.diagnose.title')}</div>
              </div>
              <div className="small muted">{t('whoami.tools.diagnose.desc')}</div>
              <button className="btn btn-tonal btn-sm" onClick={() => void runDiag()} disabled={diagRunning} style={{ alignSelf: 'flex-start' }}>
                {diagRunning ? <Loader2 size={14} className="spin" /> : <Gauge size={14} />}
                {diagRunning ? t('whoami.tools.diagnose.running') : t('whoami.tools.diagnose.run')}
              </button>
              {!diag ? (
                <div className="small muted">{t('whoami.tools.diagnose.noData')}</div>
              ) : (
                <div className="whoami-diag-list">
                  {diag.checks.map((c) => (
                    <div key={c.id} className="whoami-diag-row">
                      <span className={`dot-${c.status === 'ok' ? 'good' : c.status === 'warn' ? 'warn' : 'bad'}`} />
                      <span className="whoami-diag-name">{t(`whoami.tools.diagnose.check.${c.id}` as never)}</span>
                      <span className="mono small whoami-ellipsis" title={c.value}>{c.value}</span>
                    </div>
                  ))}
                  {diag.error && <div className="small" style={{ color: 'var(--warn, #b45309)' }}>{diag.error}</div>}
                </div>
              )}
            </div>

            <div className="card whoami-tool">
              <div className="whoami-tool-head">
                <Radar size={16} />
                <div className="title">{t('whoami.tools.radar.title')}</div>
              </div>
              <div className="small muted">{t('whoami.tools.radar.desc')}</div>
              <button className="btn btn-tonal btn-sm" onClick={() => void runRadar()} disabled={radarRunning} style={{ alignSelf: 'flex-start' }}>
                {radarRunning ? <Loader2 size={14} className="spin" /> : <Radar size={14} />}
                {radarRunning ? t('whoami.tools.radar.running') : t('whoami.tools.radar.run')}
              </button>
              {!radar ? (
                <div className="small muted">{t('whoami.tools.radar.noData')}</div>
              ) : (
                <div className="whoami-radar">
                  <div className="whoami-radar-head caption muted">
                    <span>{t('whoami.tools.radar.colCdn')}</span>
                    <span>{t('whoami.tools.radar.colNode')}</span>
                    <span>{t('whoami.tools.radar.colMs')}</span>
                  </div>
                  {radar.entries.map((e) => (
                    <div key={e.host + e.cdn} className="whoami-radar-row" title={e.error ?? e.cache ?? ''}>
                      <span className="whoami-ellipsis">
                        <span className={`dot-${e.status === 'ok' ? 'good' : 'bad'}`} /> {e.cdn}
                      </span>
                      <span
                        className="mono small whoami-ellipsis"
                        title={[e.node, e.cache].filter(Boolean).join(' · ')}
                      >
                        {e.status === 'ok' ? [e.node, e.cache].filter(Boolean).join(' · ') || '—' : lang === 'zh' ? '失败' : 'Failed'}
                      </span>
                      <span className="mono small">{e.ms != null ? `${e.ms} ms` : '—'}</span>
                    </div>
                  ))}
                  {radar.error && <div className="small" style={{ color: 'var(--warn, #b45309)' }}>{radar.error}</div>}
                </div>
              )}
            </div>

            <div className="card whoami-tool whoami-shortcuts">
              <div className="whoami-tool-head">
                <Globe2 size={16} />
                <div className="title">{t('whoami.tools.shortcuts.title')}</div>
              </div>
              <div className="small muted">{t('whoami.tools.shortcuts.desc')}</div>
              <div className="whoami-shortcut-list">
                <button className="whoami-shortcut" onClick={() => startSpeedtest()}>
                  <Gauge size={15} />
                  <div>
                    <div className="strong">{t('whoami.tools.shortcuts.speedtest')}</div>
                    <div className="caption muted">{t('whoami.tools.shortcuts.speedtestDesc')}</div>
                  </div>
                  <ArrowRight size={14} />
                </button>
                <button className="whoami-shortcut" onClick={() => requestNav('risk')}>
                  <WifiOff size={15} />
                  <div>
                    <div className="strong">{t('whoami.tools.shortcuts.ipQuality')}</div>
                    <div className="caption muted">{t('whoami.tools.shortcuts.ipQualityDesc')}</div>
                  </div>
                  <ArrowRight size={14} />
                </button>
                <button className="whoami-shortcut" onClick={() => requestNav('exitDiag')}>
                  <Route size={15} />
                  <div>
                    <div className="strong">{t('whoami.tools.shortcuts.exitDiag')}</div>
                    <div className="caption muted">{t('whoami.tools.shortcuts.exitDiagDesc')}</div>
                  </div>
                  <ArrowRight size={14} />
                </button>
                <button className="whoami-shortcut" onClick={() => requestNav('fingerprint')}>
                  <Fingerprint size={15} />
                  <div>
                    <div className="strong">{t('whoami.tools.shortcuts.fingerprint')}</div>
                    <div className="caption muted">{t('whoami.tools.shortcuts.fingerprintDesc')}</div>
                  </div>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="whoami-foot caption muted">{t('whoami.privacy')}</div>
    </div>
  )
}

// ---------------- 概览 ----------------

function Overview(props: {
  t: (k: TKey, p?: Params) => string
  lang: 'zh' | 'en'
  grade: { grade: 'A' | 'B' | 'C' | 'D'; bad: number; warn: number }
  summary: string[]
  readings: Map<string, WhoRawItem>
  stability: FpStability | null
  rtbJson: string
  onReset: () => void
}): JSX.Element {
  const { t, lang, grade, summary, readings, stability, rtbJson, onReset } = props
  const v = (id: string): string => readings.get(id)?.value ?? '—'

  const kv: Array<[string, string]> = [
    [lang === 'zh' ? '出口 IP' : 'Egress IP', v('server.ip')],
    [lang === 'zh' ? '位置（按 IP 估）' : 'Location (by IP)', v('server.geo')],
    [lang === 'zh' ? '网络（ASN）' : 'Network (ASN)', v('server.asn')],
    [lang === 'zh' ? '多出口' : 'Egress seen by sites', v('server.egress')],
    [lang === 'zh' ? 'DNS 递归出口' : 'DNS resolver egress', v('server.dnsResolver')],
    [lang === 'zh' ? 'DNS 出口归属' : 'DNS egress geo', v('server.dnsResolverGeo')],
    [lang === 'zh' ? '最近节点 / 延迟' : 'Nearest edge / RTT', `${v('server.colo')} · ${v('server.rtt')}`],
    ['HTTP / TLS', `${v('server.http')} · ${v('server.tls')}`],
    [lang === 'zh' ? '时钟偏差' : 'Clock skew', v('server.clockSkew')],
    ['Tor', v('server.tor')]
  ]

  const env: Array<[string, string]> = [
    [lang === 'zh' ? '系统 / 浏览器' : 'OS / browser', `${v('device.os')} · ${v('device.browser')}`],
    [lang === 'zh' ? '屏幕' : 'Screen', v('device.screen')],
    [lang === 'zh' ? '显卡' : 'GPU', v('device.gpuRenderer')],
    [lang === 'zh' ? 'CPU / 内存' : 'CPU / memory', `${v('device.cpuThreads')} · ${v('device.memory')}`],
    [lang === 'zh' ? '已装字体' : 'Fonts', v('fp.fontList')],
    [lang === 'zh' ? '系统时区' : 'Timezone', v('locale.timezone')],
    [lang === 'zh' ? '浏览器语言' : 'Language', v('locale.browserLanguage')],
    [lang === 'zh' ? '深浅色' : 'Theme', v('browser.colorScheme')],
    [lang === 'zh' ? '广告拦截' : 'Ad blocking', v('browser.adblock')],
    [lang === 'zh' ? '自动化痕迹' : 'Automation', v('browser.automationTraces')]
  ]

  return (
    <div className="whoami-overview">
      <div className="card whoami-verdict">
        <div className="whoami-verdict-left">
          <div className="card-eyebrow">{t('whoami.overview.summaryTitle' as never)}</div>
          <div className="whoami-verdict-list">
            {summary.map((s, i) => (
              <div key={i} className="whoami-verdict-line">{s}</div>
            ))}
          </div>
        </div>
        <div className="whoami-verdict-right">
          <div className="caption muted">{t('whoami.overview.gradeLabel' as never)}</div>
          <div className={`whoami-grade-letter g-${grade.grade}`}>{grade.grade}</div>
          <div className="caption muted" style={{ textAlign: 'center' }}>{t(`whoami.overview.grade.${grade.grade}` as never)}</div>
        </div>
      </div>

      <div className="whoami-two">
        <div className="card">
          <div className="card-eyebrow" style={{ marginBottom: 10 }}>{t('whoami.overview.addrTitle' as never)}</div>
          <div className="kv">
            {kv.map(([k, val]) => (
              <div className="kv-row" key={k}>
                <div className="kv-key">{k}</div>
                <div className="kv-val mono small" style={{ wordBreak: 'break-all' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-eyebrow" style={{ marginBottom: 10 }}>{t('whoami.overview.envTitle' as never)}</div>
          <div className="kv">
            {env.map(([k, val]) => (
              <div className="kv-row" key={k}>
                <div className="kv-key">{k}</div>
                <div className="kv-val mono small" style={{ wordBreak: 'break-all' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="whoami-bar">
          <div className="card-eyebrow">{t('whoami.overview.stabilityTitle' as never)}</div>
          {stability && (
            <button className="btn btn-ghost btn-sm" onClick={onReset}>
              {t('whoami.overview.baselineReset' as never)}
            </button>
          )}
        </div>
        {!stability ? (
          <div className="small muted">{t('whoami.empty' as never)}</div>
        ) : (
          <>
            <div className="whoami-stability-id">
              <span className="caption muted">{t('whoami.overview.idLabel' as never)}</span>
              <span className="mono">{stability.id.slice(0, 4)} · {stability.id.slice(4, 8)}</span>
            </div>
            <div className="small" style={{ marginBottom: 10 }}>
              {stability.firstVisit
                ? t('whoami.overview.stabilityFirst' as never)
                : stability.unchanged === stability.total
                  ? t('whoami.overview.stabilityStable' as never)
                  : t('whoami.overview.stabilityLine' as never, { total: stability.total, unchanged: stability.unchanged })}
              {!stability.firstVisit && stability.changed.length > 0 && (
                <span className="muted">
                  {' '}
                  {t('whoami.overview.stabilityChanged' as never, {
                    list: stability.changed.map((c) => (lang === 'zh' ? c.zh : c.en)).join(', ')
                  })}
                </span>
              )}
            </div>
            <div className="whoami-components">
              {FP_COMPONENTS.map((c) => {
                const changed = stability.changed.some((x) => x.probeId === c.probeId)
                return (
                  <div key={c.probeId} className={`whoami-component${changed && !stability.firstVisit ? ' changed' : ''}`}>
                    <span className={`dot-${stability.firstVisit ? 'neutral' : changed ? 'bad' : 'good'}`} />
                    <span>{lang === 'zh' ? c.zh : c.en}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-eyebrow">{t('whoami.overview.rtbTitle' as never)}</div>
        <div className="small muted" style={{ margin: '6px 0 10px', lineHeight: 1.6 }}>
          {t('whoami.overview.rtbDesc' as never)}
        </div>
        <pre className="whoami-json mono small">{rtbJson}</pre>
        <div className="caption muted" style={{ marginTop: 8 }}>{t('whoami.overview.rtbNote' as never)}</div>
      </div>
    </div>
  )
}

// ---------------- 探测项一行 ----------------

function Row(props: {
  def: ProbeDef
  lang: 'zh' | 'en'
  reading?: WhoRawItem
  t: (k: TKey, p?: Params) => string
  open: boolean
  onToggle: () => void
}): JSX.Element {
  const { def, lang, reading, t, open, onToggle } = props
  const label = lang === 'zh' ? def.zh : def.en
  const why = lang === 'zh' ? def.whyZh : def.whyEn
  const missing = !reading?.value
  const serverOnly = /仅服务端|服务端可观测/.test(def.source)

  return (
    <div className={`whoami-row${open ? ' open' : ''}`}>
      <button className="whoami-row-main" onClick={onToggle}>
        <div className="whoami-row-name">
          <ChevronDown size={13} className="whoami-chev" />
          <span>{label}</span>
          <span className={`whoami-level lv-${def.level}`}>
            {t(`whoami.items.level${def.level === 'high' ? 'High' : def.level === 'mid' ? 'Mid' : 'Low'}` as never)}
          </span>
        </div>
        <div className={`whoami-row-val mono small${missing ? ' muted' : ''}`}>
          {missing
            ? serverOnly
              ? t('whoami.items.serverOnly' as never)
              : reading?.status === 'error'
                ? t('whoami.items.error' as never)
                : t('whoami.items.unavailable' as never)
            : reading!.value}
        </div>
        <div className="whoami-row-src caption muted whoami-ellipsis">{reading?.detail || def.source}</div>
      </button>
      {open && (
        <div className="whoami-row-why">
          <div className="small">
            <span className="caption muted">{t('whoami.items.why' as never)} · </span>
            {why}
          </div>
          <div className="caption muted" style={{ marginTop: 4 }}>
            {def.source}
            {reading?.detail ? ` · ${reading.detail}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- 伪装检测一行 ----------------

function CheckRow(props: {
  c: DisguiseCheck
  lang: 'zh' | 'en'
  t: (k: TKey, p?: Params) => string
}): JSX.Element {
  const { c, lang, t } = props
  const body = lang === 'zh' ? c.zh : c.en
  const cls = c.level === 'bad' ? 'badge-bad' : c.level === 'warn' ? 'badge-warn' : c.level === 'ok' ? 'badge-good' : 'badge-info'
  return (
    <div className={`whoami-check lv-${c.level}`}>
      <div className="whoami-check-head">
        <span className={`badge ${cls}`}>{t(`whoami.disguise.${c.level}` as never)}</span>
        <span className="strong">{body.title}</span>
      </div>
      <div className="small" style={{ lineHeight: 1.6 }}>{body.finding}</div>
      {body.advice && (
        <div className="small whoami-advice">
          <span className="caption muted">{t('whoami.disguise.advice' as never)} · </span>
          {body.advice}
        </div>
      )}
    </div>
  )
}

// ---------------- 一句话结论 ----------------

function buildSummary(a: {
  lang: 'zh' | 'en'
  readings: Map<string, WhoRawItem>
  checks: DisguiseCheck[]
  stability: FpStability | null
}): string[] {
  const { lang, readings, checks, stability } = a
  const v = (id: string): string => readings.get(id)?.value ?? ''
  const out: string[] = []
  const ip = v('server.ip')
  const geo = v('server.geo')
  const tz = v('locale.timezone').split(' · ')[0]
  const langTag = v('locale.browserLanguage')
  const dnsGeo = v('server.dnsResolverGeo')
  const conflicts = checks.filter((c) => c.level === 'bad')
  const warns = checks.filter((c) => c.level === 'warn')

  if (lang === 'zh') {
    out.push(
      geo
        ? `你的浏览器语言是 ${langTag || '—'}，系统时区 ${tz || '—'}；IP 落在 ${geo}${ip ? `（${ip}）` : ''}。`
        : `你的浏览器语言是 ${langTag || '—'}，系统时区 ${tz || '—'}；本次没有取到出口 IP 归属，只能读到本机这一侧。`
    )
    const inconsistent = tz && v('server.ipTimezone') && tz !== v('server.ipTimezone')
    if (inconsistent) out.push(`时区（${tz}）和 IP 所在时区（${v('server.ipTimezone')}）不是同一个：这一点网站一看就知道。`)
    if (dnsGeo) out.push(`DNS 解析器出口在 ${dnsGeo}${conflicts.some((c) => c.id === 'dns-ip') ? '，和 IP 国家不一致：这是代理环境最典型的痕迹。' : '。'}`)
    const gpu = v('device.gpuRenderer')
    if (gpu) out.push(`设备：${v('device.os')} · ${v('device.screen')} · 显卡 ${gpu}${/Basic Render|llvmpipe|SwiftShader|VMware|VirtualBox/i.test(gpu) ? '（软件渲染，像远程桌面或虚拟机）' : ''}。`)
    const fonts = v('fp.fontList')
    const canvas = v('fp.canvas')
    if (fonts && canvas) out.push(`字体列表读到 ${fonts}，Canvas 指纹 ${canvas}。`)
    else if (fonts) out.push(`字体列表读到 ${fonts}。`)
    if (stability) {
      out.push(
        stability.firstVisit
          ? '这是本机第一次记录指纹，下次打开可以对比。'
          : `同一套读数里 ${stability.total} 项有 ${stability.unchanged} 项和上次完全一样：换 Cookie、开无痕，网站照样认得出你。`
      )
    }
    if (conflicts.length) out.push(`明确冲突 ${conflicts.length} 处：${conflicts.map((c) => c.zh.title).join('、')}。`)
    else if (warns.length) out.push(`没有硬冲突，但有 ${warns.length} 处值得注意：${warns.map((c) => c.zh.title).join('、')}。`)
    else out.push('没有发现硬冲突：剩下的都是「本来就会被看到」的公开信息。')
  } else {
    out.push(
      geo
        ? `Preferred language ${langTag || '—'}, system timezone ${tz || '—'}; the IP resolves to ${geo}${ip ? ` (${ip})` : ''}.`
        : `Preferred language ${langTag || '—'}, system timezone ${tz || '—'}; no egress geo this run, so only the local side is readable.`
    )
    if (tz && v('server.ipTimezone') && tz !== v('server.ipTimezone')) out.push(`Timezone (${tz}) differs from the IP timezone (${v('server.ipTimezone')}): visible at a glance.`)
    if (dnsGeo) out.push(`The DNS resolver exits in ${dnsGeo}${conflicts.some((c) => c.id === 'dns-ip') ? ', contradicting the IP country — the classic proxy tell.' : '.'}`)
    const gpu = v('device.gpuRenderer')
    if (gpu) out.push(`Device: ${v('device.os')} · ${v('device.screen')} · GPU ${gpu}${/Basic Render|llvmpipe|SwiftShader|VMware|VirtualBox/i.test(gpu) ? ' (software rendering, like a VM or remote desktop)' : ''}.`)
    const fonts = v('fp.fontList')
    const canvas = v('fp.canvas')
    if (fonts && canvas) out.push(`Font list reports ${fonts}; Canvas ${canvas}.`)
    else if (fonts) out.push(`Font list reports ${fonts}.`)
    if (stability) {
      out.push(
        stability.firstVisit
          ? 'First fingerprint record on this machine; reopen to compare.'
          : `${stability.unchanged} of ${stability.total} components are identical to last time — clearing cookies or using incognito will not help.`
      )
    }
    if (conflicts.length) out.push(`${conflicts.length} hard conflict(s): ${conflicts.map((c) => c.en.title).join(', ')}.`)
    else if (warns.length) out.push(`No hard conflicts, ${warns.length} worth noting: ${warns.map((c) => c.en.title).join(', ')}.`)
    else out.push('No hard conflicts: what is left is public information that always leaks.')
  }
  return out
}

function emptyStability(): FpStability {
  return { total: 0, unchanged: 0, changed: [], firstVisit: true, id: '' }
}
