import { ChevronDown, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { BlacklistEntry, NormalizedIPResult } from '@shared/types'
import { useDetectionContext } from '../state/DetectionContext'
import { requestNav } from '../state/navStore'
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

/* 布尔共识 → 简短说明（不替用户拍板） */
function triDesc(c: TriConsensus, label: string): string {
  const hit = c.perSource.filter((p) => p.value === true).map((p) => p.source)
  const clear = c.perSource.filter((p) => p.value === false).map((p) => p.source)
  const unknown = c.perSource.filter((p) => p.value === null).map((p) => p.source)
  switch (c.state) {
    case 'found':
      return `${hit.join('、')} 判定命中${label}${c.mixed ? `；${unknown.join('、')} 未提供该字段` : ''}。`
    case 'clear':
      return c.mixed
        ? `${clear.join('、')} 判定无${label}；${unknown.join('、')} 未提供该字段。`
        : `全部 ${c.perSource.length} 个覆盖源均判定无${label}。`
    case 'conflict':
      return `多源判断不一致（${c.perSource
        .map((p) => `${p.source}：${p.value === true ? '命中' : p.value === false ? '未命中' : '无法判断'}`)
        .join('；')}），当前无法确认。`
    case 'unknown':
      return `各源均提供该字段但均无法判断（${unknown.join('、')}）。`
    default:
      return `暂无数据源提供${label}判定。`
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
            title={open ? '收起' : '展开逐源 / 逐条明细'}
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
            {p.value === true ? '命中' : p.value === false ? '未命中' : '无法判断'}
          </span>
        </div>
      ))}
    </div>
  )
}

function BlacklistTable({ list }: { list: BlacklistEntry[] }): JSX.Element {
  return (
    <div className="card card-subtle card-pad-sm">
      <div className="gping-head" style={{ gridTemplateColumns: '1fr 90px 70px 1fr 64px', marginTop: 0 }}>
        <span>黑名单引擎</span>
        <span>类别</span>
        <span style={{ textAlign: 'right' }}>状态</span>
        <span>返回码</span>
        <span style={{ textAlign: 'right' }}>耗时</span>
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
              {b.listed ? '命中' : '未命中'}
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
  const { steps, run } = useDetectionContext()
  const all = successfulResults(steps)
  const { main, others } = exitGroups(all)

  if (!main) {
    return (
      <div className="page" style={{ paddingTop: 120 }}>
        <h1 className="h1">暂无风险数据</h1>
        <p className="muted" style={{ marginTop: 10 }}>
          先完成一次综合检测，即可查看多源交叉后的风险分析。
        </p>
        <div style={{ marginTop: 24 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              requestNav('dashboard')
              run()
            }}
          >
            开始综合检测
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
      <span className="dash-kicker">Risk Analysis · 多源交叉</span>
      <h1 className="h1" style={{ marginTop: 6 }}>风险分析</h1>
      <p className="muted small" style={{ marginTop: 8, maxWidth: 640, lineHeight: 1.75 }}>
        综合 {rs.length} 个数据源对主出口{' '}
        <span className="mono">{main.ip}</span>{' '}
        的风险判断。各源口径不同，均已归一为 0–100 风险值并保留原始标注。
      </p>

      {/* ---------- 综合风险等级 ---------- */}
      <div className="card" style={{ marginTop: 26 }}>
        <div className="card-eyebrow">综合风险等级 · 主出口</div>
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
                {overallLevel.cn}
              </span>
              <span className="caption">{overallLevel.en}</span>
              <span className="caption mono">归一风险值 {overall?.toFixed(0)} / 100</span>
            </>
          ) : (
            <span className="badge badge-neutral">无数据</span>
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
                {s.risk != null ? `${levelOf(s.risk).cn} · ${s.risk.toFixed(0)}` : '—'}
              </span>
            </span>
          ))}
        </div>
        <p className="caption" style={{ marginTop: 12, lineHeight: 1.7 }}>
          {srcRisks.map((s) => `${s.name}：${s.rawLabel || '—'}（${s.scale}）`).join('；')}。
          {hasLevelConflict &&
            ' 各源风险等级存在分歧（口径与数值差异见上），综合等级取中位数，非确定结论。'}
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
            <span className="badge badge-info">ChatGPT 分流出口</span>
            <span className="mono small">{g.ip}</span>
            <span className="caption">
              {gr?.country ?? ''} {gr?.isp ?? ''} · {gr?.riskLabel ?? ''}
              {gl ? ` · 归一风险 ${grisk?.toFixed(0)}（${gl.cn}）` : ''}
            </span>
            <span className="caption" style={{ marginLeft: 'auto' }}>
              IP 与主出口不同，不直接比较
            </span>
          </div>
        )
      })}

      {/* ---------- 威胁情报 ---------- */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-eyebrow" style={{ marginBottom: 4 }}>
          Threat Intelligence · 威胁情报
        </div>
        <ItemRow
          name="黑名单 Blacklist"
          badge={
            blacklist.length ? (
              <span className={'badge ' + (listed.length ? 'badge-bad' : 'badge-good')}>
                {listed.length} / {blacklist.length} 家命中
              </span>
            ) : (
              <span className="badge badge-neutral">无数据</span>
            )
          }
          desc={
            blacklist.length
              ? listed.length
                ? `命中 ${listed.length} 家 DNSBL：${listed.map((b) => b.engine).join('、')}；展开查看逐家类别与返回码。`
                : '12 家 DNSBL 均未命中（Net.Coffee 实测，单源）。'
              : '本次检测未取得黑名单数据。'
          }
          expand={blacklist.length ? <BlacklistTable list={blacklist} /> : undefined}
        />
        <ItemRow
          name="滥用 Abuse"
          badge={<span className={'badge ' + TRI_VIEW[abuser.state].cls}>{TRI_VIEW[abuser.state].text}</span>}
          desc={
            triDesc(abuser, '滥用标记') +
            (intel?.abuser_level
              ? ` 另：Net.Coffee 情报库历史滥用等级 ${intel.abuser_level}${intel.abuser_score_raw ? `（${intel.abuser_score_raw}）` : ''}，属历史评分口径，与当前实时标记不同。`
              : '')
          }
          expand={<SrcList perSource={abuser.perSource} />}
        />
        <ItemRow
          name="垃圾邮件 Spam"
          badge={
            blacklist.length ? (
              <span className={'badge ' + (spamListed.length ? 'badge-bad' : 'badge-good')}>
                {spamListed.length ? `${spamListed.length} 家 Spam 列表命中` : '未命中 Spam 列表'}
              </span>
            ) : (
              <span className="badge badge-neutral">无数据</span>
            )
          }
          desc={
            spamListed.length
              ? `命中 Spam 类列表：${spamListed.map((b) => b.engine).join('、')}（返回码 ${spamListed.map((b) => b.codes?.join('/')).join('、')}）。`
              : blacklist.length
                ? '未命中任何 Spam 类 DNSBL 列表。'
                : '本次检测未取得黑名单数据。'
          }
        />
        <ItemRow
          name="欺诈 Fraud"
          badge={<span className="badge badge-neutral">无数据</span>}
          desc="当前四个数据源均未提供欺诈（Fraud）标签项；暂留空，后续接入提供该字段的数据源后自动显示。"
        />
        <ItemRow
          name="威胁标签 Threats"
          badge={
            intel?.threats ? (
              <span className={'badge ' + (intel.threats.length ? 'badge-bad' : 'badge-good')}>
                {intel.threats.length ? `${intel.threats.length} 个威胁标签` : '无威胁标签'}
              </span>
            ) : (
              <span className="badge badge-neutral">无数据</span>
            )
          }
          desc={
            intel?.threats
              ? intel.threats.length
                ? `Net.Coffee 情报库标记：${intel.threats.join('、')}（单源）。`
                : 'Net.Coffee 情报库未标记任何威胁类型（单源，未交叉）。'
              : '本次检测未取得情报库威胁标签。'
          }
        />
      </div>

      {/* ---------- 代理与匿名 ---------- */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-eyebrow" style={{ marginBottom: 4 }}>
          Proxy & Anonymity · 代理与匿名
        </div>
        <ItemRow
          name="VPN"
          badge={<span className={'badge ' + TRI_VIEW[vpn.state].cls}>{TRI_VIEW[vpn.state].text}</span>}
          desc={triDesc(vpn, 'VPN')}
          expand={<SrcList perSource={vpn.perSource} />}
        />
        <ItemRow
          name="代理 Proxy"
          badge={<span className={'badge ' + TRI_VIEW[proxy.state].cls}>{TRI_VIEW[proxy.state].text}</span>}
          desc={triDesc(proxy, '代理')}
          expand={<SrcList perSource={proxy.perSource} />}
        />
        <ItemRow
          name="Tor"
          badge={<span className={'badge ' + TRI_VIEW[tor.state].cls}>{TRI_VIEW[tor.state].text}</span>}
          desc={triDesc(tor, 'Tor 出口')}
          expand={<SrcList perSource={tor.perSource} />}
        />
        <ItemRow
          name="爬虫 Crawler"
          badge={<span className={'badge ' + TRI_VIEW[crawler.state].cls}>{TRI_VIEW[crawler.state].text}</span>}
          desc={triDesc(crawler, '爬虫 / 蜘蛛特征')}
          expand={<SrcList perSource={crawler.perSource} />}
        />
      </div>

      {/* ---------- 原生性与共享 ---------- */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-eyebrow" style={{ marginBottom: 4 }}>
          Nativeness · 原生性与共享
        </div>
        <ItemRow
          name="原生性"
          badge={
            native.state === 'nodata' ? (
              <span className="badge badge-neutral">无数据</span>
            ) : native.state === 'agree' ? (
              <span className="badge badge-warn">{String(native.value)}</span>
            ) : (
              <span className="badge badge-warn">多源不一致</span>
            )
          }
          desc={
            native.state === 'nodata'
              ? '暂无数据源提供原生 / 广播判定。'
              : native.state === 'agree'
                ? `覆盖源一致判定：${String(native.value)}。`
                : `各源判定存在差异：${native.perSource
                    .filter((p) => p.value)
                    .map((p) => `${p.source}：${String(p.value)}`)
                    .join('；')}。`
          }
        />
        <ItemRow
          name="共享出口"
          badge={
            shared.state === 'nodata' ? (
              <span className="badge badge-neutral">无数据</span>
            ) : (
              <span className="badge badge-neutral">{String(shared.value ?? '—')}</span>
            )
          }
          desc={
            shared.state === 'nodata'
              ? '暂无数据源提供共享人数估计。'
              : `Ping0 估计同一出口共享人数为 ${String(shared.value)}（单源区间估计，非精确值）。`
          }
        />
        <ItemRow
          name="人机流量比"
          badge={
            ippureRaw?.humanBot ? (
              <span className="badge badge-neutral">{ippureRaw.humanBot}</span>
            ) : (
              <span className="badge badge-neutral">无数据</span>
            )
          }
          desc={
            ippureRaw?.humanPct
              ? `IPPure 统计该 IP 段人机流量比 ${ippureRaw.humanPct}（单源统计口径）。`
              : '本次检测未取得人机流量比。'
          }
        />
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="btn btn-ghost"
          onClick={() => void window.ipInsight.openSource('https://ip.net.coffee/ip/')}
        >
          <ExternalLink size={15} /> 查看 Net.Coffee 原始检测
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => void window.ipInsight.openSource('https://ping0.cc/')}
        >
          <ExternalLink size={15} /> 查看 Ping0 原始检测
        </button>
      </div>
    </div>
  )
}

