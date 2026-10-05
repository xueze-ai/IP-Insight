import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  XCircle
} from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'
import type { NormalizedIPResult } from '@shared/types'
import type { SourceStep } from '../hooks/useDetection'
import { useDetectionContext } from '../state/DetectionContext'

/* ---------- 数据完整度（真实填充率，不伪造） ---------- */
function completeness(r: NormalizedIPResult): number {
  const checks: (boolean | null | undefined)[] = [
    !!r.ip,
    !!r.ipv4,
    !!r.isp,
    !!r.asn,
    !!r.organization,
    !!r.country,
    !!r.region,
    !!r.city,
    r.location?.lat != null,
    !!r.timezone,
    r.flags?.residential != null,
    r.flags?.datacenter != null,
    r.flags?.vpn != null,
    r.flags?.proxy != null,
    r.flags?.tor != null,
    r.riskScore != null,
    !!r.nativeLabel,
    !!r.sharedUsers,
    !!r.blacklistSummary,
    !!r.dnsLeak,
    !!r.webRTCLeak,
    !!r.fingerprint,
    !!r.globalPing,
    r.downloadMbps != null,
    r.uploadMbps != null
  ]
  const done = checks.filter(Boolean).length
  return Math.round((done / checks.length) * 100)
}

/* ---------- 多源一致性维度 ---------- */
const DIMS: { key: string; label: string }[] = [
  { key: 'residential', label: '住宅 IP' },
  { key: 'datacenter', label: '数据中心' },
  { key: 'vpn', label: 'VPN' },
  { key: 'proxy', label: '代理 Proxy' },
  { key: 'tor', label: 'Tor' }
]

type DimState = 'agree' | 'conflict' | 'nodata'
function dimState(results: NormalizedIPResult[], key: string): DimState {
  const vals = results
    .map((r) => {
      const f = r.flags as Record<string, boolean | null | undefined> | undefined
      return f ? f[key] : undefined
    })
    .filter((v): v is boolean => v === true || v === false)
  if (!vals.length) return 'nodata'
  return vals.every((v) => v === vals[0]) ? 'agree' : 'conflict'
}

/* ---------- 按出口 IP 分组（不同出口不直接比较类型） ---------- */
function groupByExit(results: NormalizedIPResult[]): Map<string, NormalizedIPResult[]> {
  const m = new Map<string, NormalizedIPResult[]>()
  for (const r of results) {
    if (!r.ip) continue
    const arr = m.get(r.ip) ?? []
    arr.push(r)
    m.set(r.ip, arr)
  }
  return m
}

function exitLabel(rs: NormalizedIPResult[]): string {
  const ids = rs.map((r) => r.provider.id)
  if (ids.includes('netcoffee_gpt')) return 'ChatGPT 出口'
  return '其他出口'
}

function ExitGroupCard({
  ip,
  rs
}: {
  ip: string
  rs: NormalizedIPResult[]
}): JSX.Element {
  const r0 = rs[0]
  const type = r0.flags?.residential
    ? '住宅'
    : r0.flags?.datacenter
      ? '数据中心'
      : '类型未判定'
  const loc = [r0.country, r0.region, r0.city].filter(Boolean).join(' ')
  return (
    <div className="card card-subtle">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="card-eyebrow">{exitLabel(rs)} · 独立画像</div>
        <span className="badge badge-neutral">{rs.length} 源覆盖</span>
      </div>
      <div className="mono" style={{ marginTop: 12, fontSize: 19, fontWeight: 600 }}>
        {ip}
      </div>
      <div className="small two" style={{ marginTop: 8, lineHeight: 1.7 }}>
        {type} ·{' '}
        {r0.riskLabel ?? (r0.riskScore != null ? `评分 ${r0.riskScore}` : '无风险评分')}
        <br />
        {loc || '无位置信息'}
      </div>
      <div className="caption" style={{ marginTop: 10, lineHeight: 1.6 }}>
        该出口 IP 与主出口不同，其类型判定不与主出口直接比较；
        {rs.length === 1
          ? '仅 1 个数据源覆盖，无法多源交叉验证。'
          : '已在覆盖该出口的源之间进行比较。'}
      </div>
      <div style={{ marginTop: 12 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => void window.ipInsight.openSource(r0.provider.sourceUrl)}
        >
          <ExternalLink size={15} /> 查看原网站
        </button>
      </div>
    </div>
  )
}

/* ---------- 单个数据源卡片 ---------- */
function ProviderCard({ s }: { s: SourceStep }): JSX.Element {
  const [showRaw, setShowRaw] = useState(false)
  const r = s.result
  const ok = s.status === 'ok' && r && r.ok

  const type = r?.flags?.residential
    ? '住宅'
    : r?.flags?.datacenter
      ? '数据中心'
      : '类型未判定'
  const loc = [r?.country, r?.region, r?.city].filter(Boolean).join(' ')
  const comp = r ? completeness(r) : 0

  return (
    <div className="card provider-card">
      <div className="provider-top">
        <span className="provider-name">{s.name}</span>
        {ok ? (
          <span className="badge badge-good">
            <CheckCircle2 size={13} /> 检测成功
          </span>
        ) : (
          <span className="badge badge-bad">
            <XCircle size={13} /> 不可用
          </span>
        )}
      </div>

      {ok && r ? (
        <>
          <div className="provider-meta">
            <span>耗时 {s.durationMs != null ? (s.durationMs / 1000).toFixed(1) : '—'}s</span>
            <span>数据完整度 {comp}%</span>
          </div>
          <div className="provider-main">
            <div>{type} · {r.riskLabel ?? (r.riskScore != null ? `评分 ${r.riskScore}` : '无风险评分')}</div>
            <div className="muted" style={{ marginTop: 3 }}>{loc || '无位置信息'}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowRaw((v) => !v)}>
              <ChevronDown size={15} /> {showRaw ? '收起原始结果' : '原始结果'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void window.ipInsight.openSource(r.provider.sourceUrl)}
            >
              <ExternalLink size={15} /> 查看原网站
            </button>
          </div>
          {showRaw && (
            <pre
              className="mono"
              style={{
                margin: 0,
                maxHeight: 280,
                overflow: 'auto',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                padding: 12,
                fontSize: 11.5,
                lineHeight: 1.6
              }}
            >
              {JSON.stringify(r.raw ?? r, null, 2)}
            </pre>
          )}
        </>
      ) : (
        <div className="provider-main muted">
          {r?.error || s.result?.error || '该数据源暂时不可用（超时 / 访问受限 / 需人工验证）。'}
          <div style={{ marginTop: 10 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                void window.ipInsight.openSource(
                  r?.provider?.sourceUrl ?? sourceUrlFallback(s.key)
                )
              }
            >
              <ExternalLink size={15} /> 手动打开原网站
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function sourceUrlFallback(key: string): string {
  const map: Record<string, string> = {
    ping0: 'https://ping0.cc/',
    netcoffee: 'https://ip.net.coffee/',
    netcoffee_gpt: 'https://ip.net.coffee/gpt/',
    ippure: 'https://ippure.com/'
  }
  return map[key] ?? 'https://ip.net.coffee/'
}

/* ---------- 多源检测区块 ---------- */
export function MultiSource(): JSX.Element {
  const { steps } = useDetectionContext()
  const results = steps
    .map((s) => s.result)
    .filter((r): r is NormalizedIPResult => !!r && r.ok)

  // 按出口 IP 分组：主出口 = 覆盖源最多的 IP（并列时按 steps 顺序，含 Ping0 的优先）
  const groups = [...groupByExit(results).entries()].map(([ip, rs]) => ({
    ip,
    rs
  }))
  groups.sort((a, b) => b.rs.length - a.rs.length)
  const main = groups[0]
  const others = groups.slice(1)

  const mainResults = main ? main.rs : []
  const dimResults = DIMS.map((d) => ({
    ...d,
    state: dimState(mainResults, d.key)
  }))
  const judgeable = dimResults.filter((d) => d.state !== 'nodata')
  const agrees = judgeable.filter((d) => d.state === 'agree').length
  const percent = judgeable.length
    ? Math.round((agrees / judgeable.length) * 100)
    : 0
  const hasConflict = judgeable.some((d) => d.state === 'conflict')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* 主出口多源一致性 */}
      <div className="card" id="consistency-card">
        <div className="card-eyebrow">多源一致性 · 主出口</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 16 }}>
          <div style={{ flex: '0 0 auto' }}>
            <div
              className="mono"
              style={{ fontSize: 46, fontWeight: 600, letterSpacing: '-1px', lineHeight: 1 }}
            >
              {percent}%
            </div>
            <div className="caption" style={{ marginTop: 6 }}>
              {mainResults.length} 源覆盖主出口
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="mono small" style={{ marginBottom: 8 }}>{main?.ip}</div>
            <div className="small two" style={{ lineHeight: 1.7 }}>
              {judgeable.length} 个可判断维度中，{agrees} 个在覆盖源之间结论一致。
              {hasConflict
                ? '存在分歧的项目当前无法确认，已如实标注。'
                : '可判断维度未发现分歧。'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14, gap: 9 }}>
              {dimResults.map((d) => (
                <div
                  key={d.key}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span className="small" style={{ color: 'var(--text-2)' }}>{d.label}</span>
                  {d.state === 'agree' ? (
                    <span className="badge badge-good"><Check size={13} /> 一致</span>
                  ) : d.state === 'conflict' ? (
                    <span className="badge badge-warn"><AlertTriangle size={13} /> 存在分歧</span>
                  ) : (
                    <span className="badge badge-neutral">无数据</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 其他出口（如 ChatGPT 出口）独立画像，不与主出口直接比较 */}
      {others.map((g) => (
        <ExitGroupCard key={g.ip} ip={g.ip} rs={g.rs} />
      ))}

      {/* 四源卡片 */}
      <div id="providers-block">
        <div className="card-eyebrow" style={{ marginBottom: 12 }}>多源检测结果</div>
        <div className="providers-grid">
          {steps.map((s) => (
            <ProviderCard key={s.key} s={s} />
          ))}
        </div>
      </div>
    </div>
  )
}
