import type { NormalizedIPResult } from '@shared/types'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { useDetectionContext } from '../state/DetectionContext'
import { requestNav } from '../state/navStore'
import {
  aggregateField,
  exitGroups,
  successfulResults,
  type FieldAggregate
} from '../utils/aggregate'

/* ---------- 字段值：一致给值，分歧可展开看各源 ---------- */
function FieldVal<T>({
  agg,
  tone = 'conflict'
}: {
  agg: FieldAggregate<T>
  tone?: 'conflict' | 'differ'
}): JSX.Element {
  const [open, setOpen] = useState(false)
  if (agg.state === 'nodata') return <span className="muted">—</span>
  if (agg.state === 'agree') return <span>{String(agg.value)}</span>
  return (
    <>
      <button
        className={'badge ' + (tone === 'differ' ? 'badge-neutral' : 'badge-warn')}
        style={{ border: 'none', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        {tone === 'differ' ? '各源表述有差异' : '多源不一致'}{' '}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div style={{ width: '100%', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {agg.perSource
            .filter((p) => p.value != null && String(p.value) !== '')
            .map((p) => (
              <div key={p.source} className="caption" style={{ display: 'flex', gap: 10 }}>
                <span style={{ minWidth: 82 }}>{p.source}</span>
                <span className="mono" style={{ color: 'var(--text-2)' }}>{String(p.value)}</span>
              </div>
            ))}
        </div>
      )}
    </>
  )
}

function Row({ k, children }: { k: string; children: ReactNode }): JSX.Element {
  return (
    <div className="kv-row">
      <div className="kv-key">{k}</div>
      <div className="kv-val">{children}</div>
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="card">
      <div className="card-eyebrow" style={{ marginBottom: 14 }}>{title}</div>
      <div className="kv">{children}</div>
    </div>
  )
}

/* 取 Net.Coffee raw.lookup（扩展字段，单源） */
function netcoffeeLookup(
  rs: NormalizedIPResult[]
): Record<string, unknown> | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nc = rs.find((r) => r.provider.id === 'netcoffee')
  const raw = nc?.raw as { lookup?: Record<string, unknown> } | undefined
  return raw?.lookup
}

/* ---------- IP 信息页 ---------- */
export function IpInfo(): JSX.Element {
  const { steps, run } = useDetectionContext()
  const all = successfulResults(steps)
  const { main, others } = exitGroups(all)

  if (!main) {
    return (
      <div className="page" style={{ paddingTop: 120 }}>
        <h1 className="h1">暂无 IP 信息</h1>
        <p className="muted" style={{ marginTop: 10 }}>
          先完成一次综合检测，即可查看聚合后的网络与位置信息。
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
  const isp = aggregateField(rs, (r) => r.isp)
  const asn = aggregateField(rs, (r) => r.asn)
  const org = aggregateField(rs, (r) => r.organization)
  const netType = aggregateField(rs, (r) => {
    if (r.flags?.residential) return '住宅'
    if (r.flags?.datacenter) return '数据中心'
    if (r.flags?.hosting) return '托管'
    return null
  })

  const country = aggregateField(rs, (r) => r.country)
  const region = aggregateField(rs, (r) => r.region)
  const city = aggregateField(rs, (r) => r.city)
  const tz = aggregateField(rs, (r) => r.timezone)
  const lat = aggregateField(rs, (r) => r.location?.lat)
  const lon = aggregateField(rs, (r) => r.location?.lon)

  const lk = netcoffeeLookup(rs)
  const range = lk?.range as
    | { first?: string; last?: string; count?: number; prefix?: number }
    | undefined
  const latest = rs
    .map((r) => r.fetchedAt)
    .sort()
    .pop()

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">IP Information · 公网 IP</span>
      <h1 className="h1 mono" style={{ marginTop: 6, fontSize: 28 }}>{main.ip}</h1>
      <p className="muted small" style={{ marginTop: 8 }}>
        {rs.length} 个数据源覆盖主出口
        {latest ? ` · 最近检测 ${new Date(latest).toLocaleString()}` : ''}
      </p>

      <div className="ip-cols" style={{ marginTop: 26 }}>
        <Section title="Network · 网络">
          <Row k="ISP 运营商"><FieldVal agg={isp} tone="differ" /></Row>
          <Row k="ASN"><FieldVal agg={asn} /></Row>
          <Row k="Organization 组织"><FieldVal agg={org} tone="differ" /></Row>
          <Row k="Network Type 网络类型"><FieldVal agg={netType} /></Row>
        </Section>

        <Section title="Location · 位置">
          <Row k="Country 国家"><FieldVal agg={country} tone="differ" /></Row>
          <Row k="Region 省/州"><FieldVal agg={region} tone="differ" /></Row>
          <Row k="City 城市"><FieldVal agg={city} tone="differ" /></Row>
          <Row k="Timezone 时区"><FieldVal agg={tz} /></Row>
          <Row k="Latitude 纬度"><FieldVal agg={lat} tone="differ" /></Row>
          <Row k="Longitude 经度"><FieldVal agg={lon} tone="differ" /></Row>
        </Section>
      </div>

      {lk && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="card-eyebrow">扩展网络信息 · Net.Coffee lookup（单源，未交叉）</div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void window.ipInsight.openSource('https://ip.net.coffee/ip/')}
            >
              <ExternalLink size={15} /> 查看原网站
            </button>
          </div>
          <div className="kv" style={{ marginTop: 12 }}>
            <Row k="Prefix (CIDR)">{lk.cidr != null ? String(lk.cidr) : '—'}</Row>
            <Row k="IP Range">
              {range ? `${range.first} – ${range.last}（${range.count} 个，/${range.prefix}）` : '—'}
            </Row>
            <Row k="rDNS 反向解析">{lk.rdns ? String(lk.rdns) : <span className="muted">无</span>}</Row>
            <Row k="RPKI 状态">{lk.rpki_status != null ? String(lk.rpki_status) : '—'}</Row>
            <Row k="注册国/地区">{lk.registered_country != null ? String(lk.registered_country) : '—'}</Row>
            <Row k="ASN 类型">{lk.asn_kind != null ? String(lk.asn_kind) : '—'}</Row>
            <Row k="ASN 带宽">{lk.asn_tbps != null ? String(lk.asn_tbps) : '—'}</Row>
            <Row k="ASN IPv4 规模">{lk.asn_ipv4_count != null ? String(lk.asn_ipv4_count) : '—'}</Row>
            <Row k="ASN 分配时间">{lk.asn_allocated != null ? String(lk.asn_allocated) : '—'}</Row>
            <Row k="数据中心名称">{lk.datacenter_name != null ? String(lk.datacenter_name) : '—'}</Row>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <p className="caption" style={{ marginTop: 16, lineHeight: 1.7 }}>
          另有 {others.map((g) => g.ip).join('、')} 等其他出口（如 ChatGPT 出口），其画像见
          「综合检测 → 完整结果」中的独立出口卡片，不与主出口直接比较。
        </p>
      )}
    </div>
  )
}
