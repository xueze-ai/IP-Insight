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
import { useLang } from '../i18n'

/* ---------- 字段值：一致给值，分歧可展开看各源 ---------- */
function FieldVal<T>({
  agg,
  tone = 'conflict'
}: {
  agg: FieldAggregate<T>
  tone?: 'conflict' | 'differ'
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const { t } = useLang()
  if (agg.state === 'nodata') return <span className="muted">—</span>
  if (agg.state === 'agree') return <span>{String(agg.value)}</span>
  return (
    <>
      <button
        className={'badge ' + (tone === 'differ' ? 'badge-neutral' : 'badge-warn')}
        style={{ border: 'none', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        {tone === 'differ' ? t('ipinfo.differ') : t('ipinfo.conflict')}{' '}
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
  const { t } = useLang()
  const all = successfulResults(steps)
  const { main, others } = exitGroups(all)

  if (!main) {
    return (
      <div className="page" style={{ paddingTop: 120 }}>
        <h1 className="h1">{t('ipinfo.empty.title')}</h1>
        <p className="muted" style={{ marginTop: 10 }}>
          {t('ipinfo.empty.desc')}
        </p>
        <div style={{ marginTop: 24 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              requestNav('dashboard')
              run()
            }}
          >
            {t('ipinfo.startDetection')}
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
    if (r.flags?.residential) return t('ipinfo.netTypeVal.residential')
    if (r.flags?.datacenter) return t('ipinfo.netTypeVal.datacenter')
    if (r.flags?.hosting) return t('ipinfo.netTypeVal.hosting')
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
      <span className="dash-kicker">{t('ipinfo.kicker')}</span>
      <h1 className="h1 mono" style={{ marginTop: 6, fontSize: 28 }}>{main.ip}</h1>
      <p className="muted small" style={{ marginTop: 8 }}>
        {t('ipinfo.coverage', { n: rs.length })}
        {latest ? t('ipinfo.latest', { date: new Date(latest).toLocaleString() }) : ''}
      </p>

      <div className="ip-cols" style={{ marginTop: 26 }}>
        <Section title={t('ipinfo.section.network')}>
          <Row k={t('ipinfo.row.isp')}><FieldVal agg={isp} tone="differ" /></Row>
          <Row k={t('ipinfo.row.asn')}><FieldVal agg={asn} /></Row>
          <Row k={t('ipinfo.row.org')}><FieldVal agg={org} tone="differ" /></Row>
          <Row k={t('ipinfo.row.netType')}><FieldVal agg={netType} /></Row>
        </Section>

        <Section title={t('ipinfo.section.location')}>
          <Row k={t('ipinfo.row.country')}><FieldVal agg={country} tone="differ" /></Row>
          <Row k={t('ipinfo.row.region')}><FieldVal agg={region} tone="differ" /></Row>
          <Row k={t('ipinfo.row.city')}><FieldVal agg={city} tone="differ" /></Row>
          <Row k={t('ipinfo.row.timezone')}><FieldVal agg={tz} /></Row>
          <Row k={t('ipinfo.row.lat')}><FieldVal agg={lat} tone="differ" /></Row>
          <Row k={t('ipinfo.row.lon')}><FieldVal agg={lon} tone="differ" /></Row>
        </Section>
      </div>

      {lk && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="card-eyebrow">{t('ipinfo.ext.title')}</div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void window.ipInsight.openSource('https://ip.net.coffee/ip/')}
            >
              <ExternalLink size={15} /> {t('ipinfo.ext.viewSource')}
            </button>
          </div>
          <div className="kv" style={{ marginTop: 12 }}>
            <Row k="Prefix (CIDR)">{lk.cidr != null ? String(lk.cidr) : '—'}</Row>
            <Row k="IP Range">
              {range ? t('ipinfo.rangeFmt', { first: range.first, last: range.last, count: range.count, prefix: range.prefix }) : '—'}
            </Row>
            <Row k={t('ipinfo.ext.rdns')}>{lk.rdns ? String(lk.rdns) : <span className="muted">{t('ipinfo.none')}</span>}</Row>
            <Row k={t('ipinfo.ext.rpki')}>{lk.rpki_status != null ? String(lk.rpki_status) : '—'}</Row>
            <Row k={t('ipinfo.ext.regCountry')}>{lk.registered_country != null ? String(lk.registered_country) : '—'}</Row>
            <Row k={t('ipinfo.ext.asnKind')}>{lk.asn_kind != null ? String(lk.asn_kind) : '—'}</Row>
            <Row k={t('ipinfo.ext.asnBandwidth')}>{lk.asn_tbps != null ? String(lk.asn_tbps) : '—'}</Row>
            <Row k={t('ipinfo.ext.asnIpv4')}>{lk.asn_ipv4_count != null ? String(lk.asn_ipv4_count) : '—'}</Row>
            <Row k={t('ipinfo.ext.asnAllocated')}>{lk.asn_allocated != null ? String(lk.asn_allocated) : '—'}</Row>
            <Row k={t('ipinfo.ext.dcName')}>{lk.datacenter_name != null ? String(lk.datacenter_name) : '—'}</Row>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <p className="caption" style={{ marginTop: 16, lineHeight: 1.7 }}>
          {t('ipinfo.othersNote', { ips: others.map((g) => g.ip).join('、') })}
        </p>
      )}
    </div>
  )
}
