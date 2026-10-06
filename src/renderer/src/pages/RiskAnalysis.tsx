import { ChevronDown, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { BlacklistEntry, NormalizedIPResult } from '@shared/types'
import { useDetectionContext } from '../state/DetectionContext'
import { requestNav } from '../state/navStore'
import { tt, useLang } from '../i18n'
import {
  aggregateField,
  exitGroups,
  flagConsensus,
  levelOf,
  median,
  sourceRisks,
  successfulResults,
  TRI_VIEW,
  type SrcRisk,
  type TriConsensus
} from '../utils/aggregate'

// =============================================================
// 风险分析页
// 顶部：主出口综合风险等级（Low / Medium / High / Critical，克制呈现，不用巨大警告）
// 下面：Threat Intelligence / Blacklist / Abuse / Spam / Fraud /
//      VPN / Proxy / Tor / Crawler 等逐项「状态 + 简短说明」。
// 诚实口径：
//  - 各源风险分口径不同（风控值/系数越高越危险 vs 信任分越高越安全），统一归一为
//    0-100 风险值后再比较，并始终标注原始口径；
//  - 综合等级取各源归一风险的中位数；源间等级不一致时明确标注「存在分歧」；
//  - ChatGPT 分流出口 IP 与主出口不同，单独成卡，不参与主出口风险计算；
//  - 无数据项如实显示「无数据」，不伪造。
// =============================================================

/* 布尔共识 → 简短说明（不替用户拍板）；文案走字典，经 tt 解析随语言切换 */
function triDesc(c: TriConsensus, label: string): string {
  const sep = tt('risk.tri.sep')
  const hit = c.perSource.filter((p) => p.value === true).map((p) => p.source)
  const clear = c.perSource.filter((p) => p.value === false).map((p) => p.source)
  const unknown = c.perSource.filter((p) => p.value === null).map((p) => p.source)
  switch (c.state) {
    case 'found':
      return c.mixed
        ? tt('risk.tri.foundMixed', { hit: hit.join(sep), label, unknown: unknown.join(sep) })
        : tt('risk.tri.found', { hit: hit.join(sep), label })
    case 'clear':
      return c.mixed
        ? tt('risk.tri.clearMixed', { clear: clear.join(sep), label, unknown: unknown.join(sep) })
        : tt('risk.tri.clear', { n: c.perSource.length, label })
    case 'conflict':
      return tt('risk.tri.conflict', {
        detail: c.perSource
          .map((p) =>
            tt('risk.tri.conflictItem', {
              source: p.source,
              result:
                p.value === true
                  ? tt('risk.tri.hit')
                  : p.value === false
                    ? tt('risk.tri.miss')
                    : tt('risk.tri.unknown')
            })
          )
          .join(tt('risk.tri.itemSep'))
      })
    case 'unknown':
      return tt('risk.tri.unknownAll', { unknown: unknown.join(sep) })
    default:
      return tt('risk.tri.nodata', { label })
  }
}

function ItemRow({
  name,
  badge,
  desc,
  expand
}: {
  name: string
  badge: ReactNode
  desc: ReactNode
  expand?: ReactNode
}): JSX.Element {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  return (
    <div className="risk-item">
      <div className="risk-item-head">
        <span className="risk-item-name">{name}</span>
        {badge}
        {expand && (
          <button
            className="btn-icon"
            style={{ width: 26, height: 26, marginLeft: 'auto' }}
            onClick={() => setOpen((v) => !v)}
            title={open ? t('risk.item.collapse') : t('risk.item.expand')}
          >
            <ChevronDown
              size={15}
              style={{
                transform: open ? 'rotate(180deg)' : undefined,
                transition: 'transform var(--dur-fast) var(--ease)'
              }}
            />
          </button>
        )}
      </div>
      <p className="caption risk-item-desc">{desc}</p>
      {open && expand && <div style={{ marginTop: 8 }}>{expand}</div>}
    </div>
  )
}

function SrcList({
  perSource
}: {
  perSource: { source: string; value: boolean | null }[]
}): JSX.Element {
  const { t } = useLang()
  return (
    <div className="card card-subtle card-pad-sm">
      {perSource.map((p) => (
        <div className="risk-src" key={p.source}>
          <span style={{ minWidth: 110, color: 'var(--text-2)' }}>{p.source}</span>
          <span
            className={
              'badge ' +
              (p.value === true
                ? 'badge-bad'
                : p.value === false
                  ? 'badge-good'
                  : 'badge-neutral')
            }
          >
            {p.value === true ? t('risk.tri.hit') : p.value === false ? t('risk.tri.miss') : t('risk.tri.unknown')}
          </span>
        </div>
      ))}
    </div>
  )
}

function BlacklistTable({ list }: { list: BlacklistEntry[] }): JSX.Element {
  const { t } = useLang()
  return (
    <div className="card card-subtle card-pad-sm">
      <div className="gping-head" style={{ gridTemplateColumns: '1fr 90px 70px 1fr 64px', marginTop: 0 }}>
        <span>{t('risk.ti.table.engine')}</span>
        <span>{t('risk.ti.table.category')}</span>
        <span style={{ textAlign: 'right' }}>{t('risk.ti.table.status')}</span>
        <span>{t('risk.ti.table.code')}</span>
        <span style={{ textAlign: 'right' }}>{t('risk.ti.table.ms')}</span>
      </div>
      {list.map((b, i) => (
        <div
          className="gping-row"
          key={`${b.engine}-${i}`}
          style={{ gridTemplateColumns: '1fr 90px 70px 1fr 64px' }}
        >
          <span className="gping-node" title={b.zone}>
            {b.engine}
          </span>
          <span className="caption">{b.category ?? '—'}</span>
          <span style={{ textAlign: 'right' }}>
            <span className={'badge ' + (b.listed ? 'badge-bad' : 'badge-good')}>
              {b.listed ? t('risk.tri.hit') : t('risk.tri.miss')}
            </span>
          </span>
          <span className="caption mono">{b.codes?.join(', ') || '—'}</span>
          <span className="caption mono" style={{ textAlign: 'right' }}>
            {b.ms != null ? `${b.ms}ms` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ---------- 页面 ---------- */
export function RiskAnalysis(): JSX.Element {
  const { t, lang } = useLang()
  const { steps, run } = useDetectionContext()
  const all = successfulResults(steps)
  const { main, others } = exitGroups(all)
  /* levelOf 自带中英名称，按当前语言取用 */
  const levelName = (l: { cn: string; en: string }): string =>
    lang === 'en' ? l.en : l.cn

  if (!main) {
    return (
      <div className="page" style={{ paddingTop: 120 }}>
        <h1 className="h1">{t('risk.empty.title')}</h1>
        <p className="muted" style={{ marginTop: 10 }}>
          {t('risk.empty.desc')}
        </p>
        <div style={{ marginTop: 24 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              requestNav('dashboard')
              run()
            }}
          >
            {t('risk.startDetection')}
          </button>
        </div>
      </div>
    )
  }

  const rs = main.rs
  const srcRisks = sourceRisks(rs)
  const overall = median(srcRisks.map((s) => s.risk).filter((n): n is number => n != null))
  const overallLevel = overall != null ? levelOf(overall) : null
  const levelSet = new Set(
    srcRisks.map((s) => (s.risk != null ? levelOf(s.risk).cn : null)).filter(Boolean)
  )
  const hasLevelConflict = levelSet.size > 1

  const nc = rs.find((r) => r.provider.id === 'netcoffee')
  const lookup = nc?.raw as { lookup?: Record<string, unknown> } | undefined
  const intel = lookup?.lookup?.intelligence as
    | { threats?: unknown[]; abuser_level?: string; abuser_score_raw?: string }
    | undefined
  const blacklist = nc?.blacklist ?? []
  const listed = blacklist.filter((b) => b.listed)
  const spamListed = listed.filter((b) => /spam/i.test(b.category ?? ''))

  const vpn = flagConsensus(rs, 'vpn')
  const proxy = flagConsensus(rs, 'proxy')
  const tor = flagConsensus(rs, 'tor')
  const crawler = flagConsensus(rs, 'crawler')
  const abuser = flagConsensus(rs, 'abuser')

  const native = aggregateField(rs, (r) => r.nativeLabel)
  const shared = aggregateField(rs, (r) => r.sharedUsers)
  const ippureRaw = rs.find((r) => r.provider.id === 'ippure')?.raw as
    | { humanBot?: string | null; humanPct?: string | null }
    | undefined

  const gptOthers = others.filter((g) => g.rs.some((r) => r.provider.id === 'netcoffee_gpt'))

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">{t('risk.kicker')}</span>
      <h1 className="h1" style={{ marginTop: 6 }}>{t('common.nav.risk')}</h1>
      <p className="muted small" style={{ marginTop: 8, maxWidth: 640, lineHeight: 1.75 }}>
        {t('risk.introBefore', { n: rs.length })}{' '}
        <span className="mono">{main.ip}</span>{' '}
        {t('risk.introAfter')}
      </p>

      {/* ---------- 综合风险等级 ---------- */}
      <div className="card" style={{ marginTop: 26 }}>
        <div className="card-eyebrow">{t('risk.level.title')}</div>
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          {overallLevel ? (
            <>
              <span className="risk-level" style={{ color: overallLevel.color }}>
                {levelName(overallLevel)}
              </span>
              {lang !== 'en' && <span className="caption">{overallLevel.en}</span>}
              <span className="caption mono">{t('risk.level.score', { v: overall?.toFixed(0) ?? '' })}</span>
            </>
          ) : (
            <span className="badge badge-neutral">{t('risk.nodata')}</span>
          )}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {srcRisks.map((s) => (
            <span className="chip" key={s.name} title={s.scale}>
              {s.name}
              <span
                className={'badge ' + (s.risk != null ? '' : 'badge-neutral').trim()}
                style={
                  s.risk != null
                    ? { color: levelOf(s.risk).color, background: 'transparent', padding: 0, height: 'auto' }
                    : undefined
                }
              >
                {s.risk != null ? `${levelName(levelOf(s.risk))} · ${s.risk.toFixed(0)}` : '—'}
              </span>
            </span>
          ))}
        </div>
        <p className="caption" style={{ marginTop: 12, lineHeight: 1.7 }}>
          {t('risk.level.scales', {
            list: srcRisks
              .map((s) =>
                t('risk.level.scaleItem', { name: s.name, raw: s.rawLabel || '—', scale: s.scale })
              )
              .join(t('risk.tri.itemSep'))
          })}
          {hasLevelConflict && t('risk.level.conflictNote')}
        </p>
      </div>

      {/* ---------- ChatGPT 分流出口（独立，不参与主出口） ---------- */}
      {gptOthers.map((g) => {
        const gr = g.rs.find((r) => r.provider.id === 'netcoffee_gpt')
        const grisk = gr?.riskScore != null ? 100 - gr.riskScore : null
        const gl = grisk != null ? levelOf(grisk) : null
        return (
          <div
            className="card card-subtle"
            key={g.ip}
            style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <span className="badge badge-info">{t('risk.gpt.badge')}</span>
            <span className="mono small">{g.ip}</span>
            <span className="caption">
              {gr?.country ?? ''} {gr?.isp ?? ''} · {gr?.riskLabel ?? ''}
              {gl ? ` · ${t('risk.gpt.risk', { v: grisk?.toFixed(0) ?? '', level: levelName(gl) })}` : ''}
            </span>
            <span className="caption" style={{ marginLeft: 'auto' }}>
              {t('risk.gpt.note')}
            </span>
          </div>
        )
      })}

      {/* ---------- 威胁情报 ---------- */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-eyebrow" style={{ marginBottom: 4 }}>
          {t('risk.ti.title')}
        </div>
        <ItemRow
          name={t('risk.ti.blacklist')}
          badge={
            blacklist.length ? (
              <span className={'badge ' + (listed.length ? 'badge-bad' : 'badge-good')}>
                {t('risk.ti.blacklistHit', { hit: listed.length, total: blacklist.length })}
              </span>
            ) : (
              <span className="badge badge-neutral">{t('risk.nodata')}</span>
            )
          }
          desc={
            blacklist.length
              ? listed.length
                ? t('risk.ti.blacklistDescHit', {
                    n: listed.length,
                    engines: listed.map((b) => b.engine).join(t('risk.tri.sep'))
                  })
                : t('risk.ti.blacklistDescClear')
              : t('risk.ti.blacklistDescEmpty')
          }
          expand={blacklist.length ? <BlacklistTable list={blacklist} /> : undefined}
        />
        <ItemRow
          name={t('risk.ti.abuse')}
          badge={<span className={'badge ' + TRI_VIEW[abuser.state].cls}>{TRI_VIEW[abuser.state].text}</span>}
          desc={
            triDesc(abuser, tt('risk.tri.label.abuse')) +
            (intel?.abuser_level
              ? tt('risk.ti.abuseIntel', {
                  level: intel.abuser_level,
                  scorePart: intel.abuser_score_raw
                    ? tt('risk.ti.abuseIntelScore', { raw: intel.abuser_score_raw })
                    : ''
                })
              : '')
          }
          expand={<SrcList perSource={abuser.perSource} />}
        />
        <ItemRow
          name={t('risk.ti.spam')}
          badge={
            blacklist.length ? (
              <span className={'badge ' + (spamListed.length ? 'badge-bad' : 'badge-good')}>
                {spamListed.length ? t('risk.ti.spamHit', { n: spamListed.length }) : t('risk.ti.spamClear')}
              </span>
            ) : (
              <span className="badge badge-neutral">{t('risk.nodata')}</span>
            )
          }
          desc={
            spamListed.length
              ? t('risk.ti.spamDescHit', {
                  engines: spamListed.map((b) => b.engine).join(t('risk.tri.sep')),
                  codes: spamListed.map((b) => b.codes?.join('/')).join(t('risk.tri.sep'))
                })
              : blacklist.length
                ? t('risk.ti.spamDescClear')
                : t('risk.ti.blacklistDescEmpty')
          }
        />
        <ItemRow
          name={t('risk.ti.fraud')}
          badge={<span className="badge badge-neutral">{t('risk.nodata')}</span>}
          desc={t('risk.ti.fraudDesc')}
        />
        <ItemRow
          name={t('risk.ti.threats')}
          badge={
            intel?.threats ? (
              <span className={'badge ' + (intel.threats.length ? 'badge-bad' : 'badge-good')}>
                {intel.threats.length ? t('risk.ti.threatsHit', { n: intel.threats.length }) : t('risk.ti.threatsClear')}
              </span>
            ) : (
              <span className="badge badge-neutral">{t('risk.nodata')}</span>
            )
          }
          desc={
            intel?.threats
              ? intel.threats.length
                ? t('risk.ti.threatsDescHit', { tags: intel.threats.join(t('risk.tri.sep')) })
                : t('risk.ti.threatsDescClear')
              : t('risk.ti.threatsDescEmpty')
          }
        />
      </div>

      {/* ---------- 代理与匿名 ---------- */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-eyebrow" style={{ marginBottom: 4 }}>
          {t('risk.proxy.title')}
        </div>
        <ItemRow
          name={t('risk.proxy.vpn')}
          badge={<span className={'badge ' + TRI_VIEW[vpn.state].cls}>{TRI_VIEW[vpn.state].text}</span>}
          desc={triDesc(vpn, tt('risk.tri.label.vpn'))}
          expand={<SrcList perSource={vpn.perSource} />}
        />
        <ItemRow
          name={t('risk.proxy.proxy')}
          badge={<span className={'badge ' + TRI_VIEW[proxy.state].cls}>{TRI_VIEW[proxy.state].text}</span>}
          desc={triDesc(proxy, tt('risk.tri.label.proxy'))}
          expand={<SrcList perSource={proxy.perSource} />}
        />
        <ItemRow
          name={t('risk.proxy.tor')}
          badge={<span className={'badge ' + TRI_VIEW[tor.state].cls}>{TRI_VIEW[tor.state].text}</span>}
          desc={triDesc(tor, tt('risk.tri.label.torExit'))}
          expand={<SrcList perSource={tor.perSource} />}
        />
        <ItemRow
          name={t('risk.proxy.crawler')}
          badge={<span className={'badge ' + TRI_VIEW[crawler.state].cls}>{TRI_VIEW[crawler.state].text}</span>}
          desc={triDesc(crawler, tt('risk.tri.label.crawler'))}
          expand={<SrcList perSource={crawler.perSource} />}
        />
      </div>

      {/* ---------- 原生性与共享 ---------- */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-eyebrow" style={{ marginBottom: 4 }}>
          {t('risk.nat.title')}
        </div>
        <ItemRow
          name={t('risk.nat.native')}
          badge={
            native.state === 'nodata' ? (
              <span className="badge badge-neutral">{t('risk.nodata')}</span>
            ) : native.state === 'agree' ? (
              <span className="badge badge-warn">{String(native.value)}</span>
            ) : (
              <span className="badge badge-warn">{t('risk.nat.conflict')}</span>
            )
          }
          desc={
            native.state === 'nodata'
              ? t('risk.nat.nativeEmpty')
              : native.state === 'agree'
                ? t('risk.nat.nativeAgree', { v: String(native.value) })
                : t('risk.nat.nativeConflict', {
                    detail: native.perSource
                      .filter((p) => p.value)
                      .map((p) => t('risk.tri.conflictItem', { source: p.source, result: String(p.value) }))
                      .join(t('risk.tri.itemSep'))
                  })
          }
        />
        <ItemRow
          name={t('risk.nat.shared')}
          badge={
            shared.state === 'nodata' ? (
              <span className="badge badge-neutral">{t('risk.nodata')}</span>
            ) : (
              <span className="badge badge-neutral">{String(shared.value ?? '—')}</span>
            )
          }
          desc={
            shared.state === 'nodata'
              ? t('risk.nat.sharedEmpty')
              : t('risk.nat.sharedDesc', { v: String(shared.value) })
          }
        />
        <ItemRow
          name={t('risk.nat.human')}
          badge={
            ippureRaw?.humanBot ? (
              <span className="badge badge-neutral">{ippureRaw.humanBot}</span>
            ) : (
              <span className="badge badge-neutral">{t('risk.nodata')}</span>
            )
          }
          desc={
            ippureRaw?.humanPct
              ? t('risk.nat.humanDesc', { v: ippureRaw.humanPct })
              : t('risk.nat.humanEmpty')
          }
        />
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="btn btn-ghost"
          onClick={() => void window.ipInsight.openSource('https://ip.net.coffee/ip/')}
        >
          <ExternalLink size={15} /> {t('risk.viewNetcoffee')}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => void window.ipInsight.openSource('https://ping0.cc/')}
        >
          <ExternalLink size={15} /> {t('risk.viewPing0')}
        </button>
      </div>
    </div>
  )
}

