import type {
  HistoryRecord,
  NormalizedIPResult,
  ReportModel,
  ReportSource
} from '@shared/types'
import {
  aggregateField,
  buildConsistencyText,
  exitGroups,
  flagConsensus,
  TRI_VIEW,
  type FieldAggregate
} from './aggregate'

// =============================================================
// 报告模型构建：把一次检测（当前会话或历史记录）整理成
// 导出层（HTML/PDF/JSON/TXT）共用的结构化模型。
// =============================================================

function fv(agg: FieldAggregate<unknown>): string {
  if (agg.state === 'nodata') return '—'
  if (agg.state === 'agree') return String(agg.value)
  return '多源不一致'
}

const FLAG_LABELS: { field: string; label: string }[] = [
  { field: 'vpn', label: 'VPN' },
  { field: 'proxy', label: 'Proxy' },
  { field: 'tor', label: 'Tor' },
  { field: 'crawler', label: 'Crawler' },
  { field: 'residential', label: '住宅' },
  { field: 'datacenter', label: '数据中心' },
  { field: 'hosting', label: '托管' }
]

function flagText(v: boolean | null | undefined): string {
  if (v === true) return '命中'
  if (v === false) return '未命中'
  return '未提供'
}

/* 单源人类可读明细行 */
function sourceRows(r: NormalizedIPResult): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  const push = (label: string, v?: string | null): void => {
    if (v != null && v !== '') rows.push({ label, value: v })
  }
  push('公网 IP', r.ip)
  push('ISP 运营商', r.isp)
  push('ASN', r.asn ?? undefined)
  push('组织', r.organization)
  push(
    '位置',
    [r.country, r.region, r.city].filter(Boolean).join(' · ') || undefined
  )
  push(
    '坐标',
    r.location?.lat != null && r.location?.lon != null
      ? `${r.location.lat}, ${r.location.lon}`
      : undefined
  )
  push('时区', r.timezone)
  push(
    '网络类型',
    r.flags?.residential
      ? '住宅'
      : r.flags?.datacenter
        ? '数据中心'
        : r.flags?.hosting
          ? '托管'
          : undefined
  )
  push('风险口径', r.riskLabel)
  push('原生性', r.nativeLabel)
  push('共享出口', r.sharedUsers)
  const flags = (r.flags ?? {}) as Record<string, boolean | null>
  const flagStr = FLAG_LABELS.map((f) => `${f.label} ${flagText(flags[f.field])}`).join('　')
  rows.push({ label: '属性标签', value: flagStr })
  if (r.blacklistSummary) {
    const names = (r.blacklist ?? [])
      .filter((b) => b.listed)
      .map((b) => b.engine)
      .join('、')
    push(
      'DNSBL 黑名单',
      `${r.blacklistSummary.listed}/${r.blacklistSummary.checked} 家命中${names ? `：${names}` : ''}`
    )
  }
  if (r.dnsLeak?.status)
    push('DNS 泄露', `${r.dnsLeak.status}${r.dnsLeak.exitIp ? `（出口 ${r.dnsLeak.exitIp}）` : ''}`)
  if (r.webRTCLeak?.status)
    push('WebRTC 泄露', `${r.webRTCLeak.status}${r.webRTCLeak.exitIp ? `（出口 ${r.webRTCLeak.exitIp}）` : ''}`)
  if (r.globalPing?.length) {
    push(
      '全球节点延迟',
      r.globalPing
        .map((g) => `${g.name ?? g.node} ${g.avgMs ?? g.latencyMs ?? '—'}ms`)
        .join('、')
    )
  }
  if (r.downloadMbps != null || r.uploadMbps != null)
    push(
      '本机测速',
      `下载 ${r.downloadMbps != null ? r.downloadMbps.toFixed(1) : '—'} Mbps / 上传 ${r.uploadMbps != null ? r.uploadMbps.toFixed(1) : '—'} Mbps`
    )
  if (r.fingerprint) {
    const fp = r.fingerprint
    push(
      '浏览器指纹',
      [
        fp.browser ? `${fp.browser} ${fp.browserVersion ?? ''}` : '',
        fp.os,
        fp.screen,
        fp.canvas ? `Canvas ${fp.canvas}` : '',
        fp.webgl ? `WebGL ${fp.webgl}` : '',
        fp.audio ? `Audio ${fp.audio}` : '',
        fp.visitorId ? `综合 ${fp.visitorId}` : ''
      ]
        .filter(Boolean)
        .join(' · ') || undefined
    )
  }
  if (r.scenarios?.length)
    push(
      '场景评分',
      r.scenarios
        .map((s) => {
          const stars = Math.max(0, Math.min(5, s.stars))
          return `${s.name} ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`
        })
        .join('、')
    )
  return rows
}

/* 多源对比矩阵：关键字段 × 各源取值 */
function buildMatrix(results: NormalizedIPResult[]): {
  field: string
  perSource: { source: string; value: string }[]
}[] {
  const ok = results.filter((r) => r.ok)
  const fields: { field: string; get: (r: NormalizedIPResult) => string | null }[] = [
    { field: '公网 IP', get: (r) => r.ip ?? null },
    { field: 'ISP', get: (r) => r.isp ?? null },
    { field: 'ASN', get: (r) => r.asn ?? null },
    { field: '位置', get: (r) => [r.country, r.city].filter(Boolean).join(' · ') || null },
    { field: '网络类型', get: (r) => (r.flags?.residential ? '住宅' : r.flags?.datacenter ? '数据中心' : r.flags?.hosting ? '托管' : null) },
    { field: 'VPN', get: (r) => (r.flags && 'vpn' in r.flags ? flagText(r.flags.vpn ?? null) : null) },
    { field: 'Proxy', get: (r) => (r.flags && 'proxy' in r.flags ? flagText(r.flags.proxy ?? null) : null) },
    { field: 'Tor', get: (r) => (r.flags && 'tor' in r.flags ? flagText(r.flags.tor ?? null) : null) },
    { field: '风险口径', get: (r) => r.riskLabel ?? null }
  ]
  return fields.map((f) => ({
    field: f.field,
    perSource: ok.map((r) => ({ source: r.provider.name, value: f.get(r) ?? '—' }))
  }))
}

export interface ReportInput {
  startedAt: string
  finishedAt: string
  currentIp?: string | null
  results: NormalizedIPResult[]
  sources: { name: string; ok: boolean; error?: string; durationMs?: number }[]
  aiReport?: string | null
}

export function buildReportModel(input: ReportInput): ReportModel {
  const ok = input.results.filter((r) => r.ok)
  const { main } = exitGroups(ok)
  const mrs = main?.rs ?? ok

  const netType = aggregateField(mrs, (r) => {
    if (r.flags?.residential) return '住宅'
    if (r.flags?.datacenter) return '数据中心'
    if (r.flags?.hosting) return '托管'
    return null
  })

  const fields: { label: string; value: string }[] = [
    { label: 'ISP 运营商', value: fv(aggregateField(mrs, (r) => r.isp)) },
    { label: 'ASN', value: fv(aggregateField(mrs, (r) => r.asn)) },
    { label: 'Organization', value: fv(aggregateField(mrs, (r) => r.organization)) },
    { label: '网络类型', value: fv(netType) },
    { label: '国家 / 地区', value: fv(aggregateField(mrs, (r) => r.country)) },
    { label: '省 / 州', value: fv(aggregateField(mrs, (r) => r.region)) },
    { label: '城市', value: fv(aggregateField(mrs, (r) => r.city)) },
    { label: '时区', value: fv(aggregateField(mrs, (r) => r.timezone)) },
    {
      label: '经纬度',
      value: fv(
        aggregateField(mrs, (r) =>
          r.location?.lat != null && r.location?.lon != null
            ? `${r.location.lat}, ${r.location.lon}`
            : null
        )
      )
    },
    { label: 'VPN', value: TRI_VIEW[flagConsensus(ok, 'vpn').state].text },
    { label: '代理 Proxy', value: TRI_VIEW[flagConsensus(ok, 'proxy').state].text },
    { label: 'Tor', value: TRI_VIEW[flagConsensus(ok, 'tor').state].text },
    { label: '爬虫 Crawler', value: TRI_VIEW[flagConsensus(ok, 'crawler').state].text },
    {
      label: '原生性',
      value: fv(aggregateField(mrs, (r) => r.nativeLabel))
    }
  ]

  const gpt = ok.find((r) => r.provider.id === 'netcoffee_gpt')
  if (gpt?.dnsLeak?.status) fields.push({ label: 'DNS 泄露', value: gpt.dnsLeak.status })
  if (gpt?.webRTCLeak?.status)
    fields.push({ label: 'WebRTC 泄露', value: gpt.webRTCLeak.status })
  const nc = ok.find((r) => r.provider.id === 'netcoffee')
  if (nc?.blacklistSummary)
    fields.push({
      label: 'DNSBL 黑名单',
      value: `${nc.blacklistSummary.listed} / ${nc.blacklistSummary.checked} 家命中`
    })

  const sources: ReportSource[] = input.sources.map((s) => {
    const r = input.results.find((x) => x.provider.name === s.name)
    return {
      name: s.name,
      ok: s.ok,
      error: s.error ?? r?.error,
      ip: r?.ip,
      riskLabel: r?.riskLabel,
      netType: r?.flags?.residential
        ? '住宅'
        : r?.flags?.datacenter
          ? '数据中心'
          : r?.flags?.hosting
            ? '托管'
            : undefined,
      durationMs: s.durationMs
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    currentIp: input.currentIp ?? undefined,
    successCount: ok.length,
    totalCount: input.sources.length,
    sources,
    sourceDetails: input.results.map((r) => {
      const s = input.sources.find((x) => x.name === r.provider.name)
      return {
        name: r.provider.name,
        ok: r.ok,
        error: r.error,
        durationMs: s?.durationMs,
        rows: sourceRows(r)
      }
    }),
    matrix: buildMatrix(input.results),
    consistency: buildConsistencyText(ok),
    fields,
    raw: input.results.map((r) => ({ source: r.provider.name, raw: r.raw ?? null })),
    ai: input.aiReport ?? undefined
  }
}

export function recordToInput(rec: HistoryRecord): ReportInput {
  return {
    startedAt: rec.startedAt,
    finishedAt: rec.finishedAt,
    currentIp: rec.currentIp,
    results: rec.results,
    sources: rec.sources.map((s) => ({
      name: s.name,
      ok: s.ok,
      error: s.error,
      durationMs: s.durationMs
    })),
    aiReport: rec.aiReport
  }
}

// =============================================================
// AI 载荷瘦身：剔除体积巨大的 raw（DOM 文本 / BGP 快照 / 邻居列表等），
// 只保留分析所需的标准化字段与关键摘要。
// 效果：prompt token 大幅下降 → 首字更快、总时长更短、模型注意力更集中（质量更高）。
// =============================================================
export function aiPayload(results: NormalizedIPResult[]): NormalizedIPResult[] {
  return results.map((r) => {
    const listed = (r.blacklist ?? []).filter((b) => b.listed)
    const fp = r.fingerprint
    return {
      provider: r.provider,
      fetchedAt: r.fetchedAt,
      ok: r.ok,
      error: r.error,
      ip: r.ip,
      ipv4: r.ipv4,
      ipv6: r.ipv6,
      rdns: r.rdns,
      isp: r.isp,
      asn: r.asn,
      organization: r.organization,
      country: r.country,
      region: r.region,
      city: r.city,
      location: r.location,
      timezone: r.timezone,
      flags: r.flags,
      riskScore: r.riskScore,
      riskLabel: r.riskLabel,
      nativeLabel: r.nativeLabel,
      sharedUsers: r.sharedUsers,
      blacklistSummary: r.blacklistSummary,
      blacklistListed: listed.map((b) => ({
        engine: b.engine,
        category: b.category,
        codes: b.codes
      })),
      dnsLeak: r.dnsLeak,
      webRTCLeak: r.webRTCLeak,
      fingerprint: fp
        ? {
            browser: fp.browser,
            browserVersion: fp.browserVersion,
            os: fp.os,
            platform: fp.platform,
            timezone: fp.timezone,
            timezoneConsistent: fp.timezoneConsistent,
            language: fp.language,
            languages: fp.languages,
            screen: fp.screen,
            colorDepth: fp.colorDepth,
            hardwareConcurrency: fp.hardwareConcurrency,
            deviceMemory: fp.deviceMemory,
            canvas: fp.canvas,
            webgl: fp.webgl,
            webglRenderer: fp.webglRenderer,
            audio: fp.audio,
            visitorId: fp.visitorId,
            cookiesEnabled: fp.cookiesEnabled,
            fontsCount: fp.fonts?.length
          }
        : undefined,
      globalPing: r.globalPing?.map((g) => ({
        node: g.node,
        name: g.name,
        continent: g.continent,
        avgMs: g.avgMs ?? g.latencyMs,
        reachable: g.reachable
      })),
      downloadMbps: r.downloadMbps,
      uploadMbps: r.uploadMbps,
      scenarios: r.scenarios
    } as unknown as NormalizedIPResult
  })
}
