import type {
  HistoryRecord,
  NormalizedIPResult,
  ReportModel,
  ReportSource
} from '@shared/types'
import type { DiagRunSummary, DiagStatus } from '@shared/diag'
import {
  aggregateField,
  buildConsistencyText,
  exitGroups,
  flagConsensus,
  leakBadgeCls,
  leakBadgeState,
  TRI_VIEW,
  type FieldAggregate
} from './aggregate'
import { tt } from '../i18n'

// =============================================================
// 报告模型构建：把一次检测（当前会话或历史记录）整理成
// 导出层（HTML/PDF/JSON/TXT）共用的结构化模型。
// =============================================================

function fv(agg: FieldAggregate<unknown>): string {
  if (agg.state === 'nodata') return '—'
  if (agg.state === 'agree') return String(agg.value)
  return tt('misc.report.inconsistent')
}

// label 用 getter 延迟求值，保持 { field, label } 结构不变。
const FLAG_LABELS: { field: string; label: string }[] = [
  { field: 'vpn', label: 'VPN' },
  { field: 'proxy', label: 'Proxy' },
  { field: 'tor', label: 'Tor' },
  { field: 'crawler', label: 'Crawler' },
  { field: 'residential', get label() { return tt('misc.report.flagLabels.residential') } },
  { field: 'datacenter', get label() { return tt('misc.report.flagLabels.datacenter') } },
  { field: 'hosting', get label() { return tt('misc.report.flagLabels.hosting') } }
]

function flagText(v: boolean | null | undefined): string {
  if (v === true) return tt('misc.flagText.hit')
  if (v === false) return tt('misc.flagText.miss')
  return tt('misc.flagText.na')
}

/* 单源人类可读明细行 */
function sourceRows(r: NormalizedIPResult): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  const push = (label: string, v?: string | null): void => {
    if (v != null && v !== '') rows.push({ label, value: v })
  }
  push(tt('misc.report.rows.publicIp'), r.ip)
  push(tt('misc.report.rows.isp'), r.isp)
  push('ASN', r.asn ?? undefined)
  push(tt('misc.report.rows.org'), r.organization)
  push(
    tt('misc.report.rows.location'),
    [r.country, r.region, r.city].filter(Boolean).join(' · ') || undefined
  )
  push(
    tt('misc.report.rows.coords'),
    r.location?.lat != null && r.location?.lon != null
      ? `${r.location.lat}, ${r.location.lon}`
      : undefined
  )
  push(tt('misc.report.rows.timezone'), r.timezone)
  push(
    tt('misc.report.rows.netType'),
    r.flags?.residential
      ? tt('misc.netType.residential')
      : r.flags?.datacenter
        ? tt('misc.netType.datacenter')
        : r.flags?.hosting
          ? tt('misc.netType.hosting')
          : undefined
  )
  push(tt('misc.report.rows.risk'), r.riskLabel)
  push(tt('misc.report.rows.native'), r.nativeLabel)
  push(tt('misc.report.rows.shared'), r.sharedUsers)
  const flags = (r.flags ?? {}) as Record<string, boolean | null>
  const flagStr = FLAG_LABELS.map((f) => `${f.label} ${flagText(flags[f.field])}`).join('　')
  rows.push({ label: tt('misc.report.rows.flags'), value: flagStr })
  if (r.blacklistSummary) {
    const names = (r.blacklist ?? [])
      .filter((b) => b.listed)
      .map((b) => b.engine)
      .join('、')
    push(
      tt('misc.report.rows.blacklist'),
      tt('misc.report.blacklistValue', {
        listed: r.blacklistSummary.listed,
        checked: r.blacklistSummary.checked,
        names: names ? tt('misc.report.blacklistNames', { names }) : ''
      })
    )
  }
  if (r.dnsLeak?.status)
    push(
      tt('misc.report.rows.dnsLeak'),
      tt('misc.report.leakValue', {
        status: r.dnsLeak.status,
        exit: r.dnsLeak.exitIp ? tt('misc.report.leakExit', { ip: r.dnsLeak.exitIp }) : ''
      })
    )
  if (r.webRTCLeak?.status)
    push(
      tt('misc.report.rows.webrtcLeak'),
      tt('misc.report.leakValue', {
        status: r.webRTCLeak.status,
        exit: r.webRTCLeak.exitIp ? tt('misc.report.leakExit', { ip: r.webRTCLeak.exitIp }) : ''
      })
    )
  if (r.globalPing?.length) {
    push(
      tt('misc.report.rows.ping'),
      r.globalPing
        .map((g) => `${g.name ?? g.node} ${g.avgMs ?? g.latencyMs ?? '—'}ms`)
        .join('、')
    )
  }
  if (r.downloadMbps != null || r.uploadMbps != null)
    push(
      tt('misc.report.rows.speed'),
      tt('misc.report.speedValue', {
        down: r.downloadMbps != null ? r.downloadMbps.toFixed(1) : '—',
        up: r.uploadMbps != null ? r.uploadMbps.toFixed(1) : '—'
      })
    )
  if (r.fingerprint) {
    const fp = r.fingerprint
    push(
      tt('misc.report.rows.fingerprint'),
      [
        fp.browser ? `${fp.browser} ${fp.browserVersion ?? ''}` : '',
        fp.os,
        fp.screen,
        fp.canvas ? `Canvas ${fp.canvas}` : '',
        fp.webgl ? `WebGL ${fp.webgl}` : '',
        fp.audio ? `Audio ${fp.audio}` : '',
        fp.visitorId ? tt('misc.report.fpVisitor', { id: fp.visitorId }) : ''
      ]
        .filter(Boolean)
        .join(' · ') || undefined
    )
  }
  if (r.scenarios?.length)
    push(
      tt('misc.report.rows.scenarios'),
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
    { field: tt('misc.report.matrix.publicIp'), get: (r) => r.ip ?? null },
    { field: 'ISP', get: (r) => r.isp ?? null },
    { field: 'ASN', get: (r) => r.asn ?? null },
    { field: tt('misc.report.matrix.location'), get: (r) => [r.country, r.city].filter(Boolean).join(' · ') || null },
    { field: tt('misc.report.matrix.netType'), get: (r) => (r.flags?.residential ? tt('misc.netType.residential') : r.flags?.datacenter ? tt('misc.netType.datacenter') : r.flags?.hosting ? tt('misc.netType.hosting') : null) },
    { field: 'VPN', get: (r) => (r.flags && 'vpn' in r.flags ? flagText(r.flags.vpn ?? null) : null) },
    { field: 'Proxy', get: (r) => (r.flags && 'proxy' in r.flags ? flagText(r.flags.proxy ?? null) : null) },
    { field: 'Tor', get: (r) => (r.flags && 'tor' in r.flags ? flagText(r.flags.tor ?? null) : null) },
    { field: tt('misc.report.matrix.risk'), get: (r) => r.riskLabel ?? null }
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
  diag?: DiagRunSummary | null
}

/** 诊断状态 → 报告用本地化文本 */
function diagStatusText(s: DiagStatus | undefined): string {
  const map: Record<DiagStatus, string> = {
    queued: tt('diag.status.queued'),
    pending: tt('diag.status.pending'),
    running: tt('diag.status.running'),
    success: tt('diag.status.success'),
    partial: tt('diag.status.partial'),
    failed: tt('diag.status.failed'),
    timeout: tt('diag.status.timeout'),
    canceled: tt('diag.status.canceled'),
    skipped: tt('diag.status.skipped'),
    unsupported: tt('diag.status.unsupported')
  }
  return (s && map[s]) || String(s ?? '—')
}

const DIAG_MODULE_KEYS: Record<'publicIp' | 'splitTunnel' | 'cdnNode' | 'dnsExit', Parameters<typeof tt>[0]> = {
  publicIp: 'diag.module.publicIp',
  splitTunnel: 'diag.module.splitTunnel',
  cdnNode: 'diag.module.cdnNode',
  dnsExit: 'diag.module.dnsExit'
}

/** 把一轮诊断摘要转成人类可读的模块行 + 探测项明细 */
function buildDiagSection(diag: DiagRunSummary): ReportModel['diag'] {
  const moduleIds = ['publicIp', 'splitTunnel', 'cdnNode', 'dnsExit'] as const
  const modules = moduleIds
    .filter((id) => diag.moduleStatus[id] != null)
    .map((id) => {
      const probes = diag.probes[id] ?? []
      const rows: { label: string; value: string }[] = []
      // 关键结果行
      const ips = [...new Set(probes.filter((p) => p.ip && p.status === 'success').map((p) => p.ip as string))]
      if (ips.length) rows.push({ label: tt('misc.report.diag.observedEgress'), value: ips.join(' / ') })
      const nodes = probes.filter((p) => p.node && p.status === 'success')
      if (nodes.length) {
        rows.push({
          label: tt('misc.report.diag.nodes'),
          value: nodes.slice(0, 6).map((p) => `${p.cdn ?? p.target ?? ''} ${p.node}`).join('；') + (nodes.length > 6 ? ` …(${nodes.length})` : '')
        })
      }
      const ecs = [...new Set(probes.filter((p) => p.ecsSubnet).map((p) => p.ecsSubnet as string))]
      if (ecs.length) rows.push({ label: tt('diag.col.ecs'), value: ecs.join('；') })
      const bad = probes.filter((p) => p.status === 'failed' || p.status === 'timeout')
      if (bad.length) {
        rows.push({
          label: tt('misc.report.diag.failedProbes'),
          value: bad.slice(0, 6).map((p) => `${p.target ?? p.id}（${p.error ?? diagStatusText(p.status)}）`).join('；')
        })
      }
      rows.push({ label: tt('misc.report.diag.probeStats'), value: tt('diag.moduleStats', { ok: probes.filter((p) => p.status === 'success').length, total: probes.length }) })
      return {
        id,
        status: diagStatusText(diag.moduleStatus[id]),
        rows
      }
    })
  const geoText = (p: DiagRunSummary['probes']['publicIp'][number]): string | undefined =>
    p.geo
      ? [p.geo.country, p.geo.city, p.geo.isp].filter(Boolean).join(' · ') + `（${p.geo.source}）`
      : p.ip
        ? tt('diag.geo.notFetched')
        : undefined
  const probeRows = moduleIds.flatMap((id) =>
    (diag.probes[id] ?? []).map((p) => ({
      module: tt(DIAG_MODULE_KEYS[id]),
      target: p.target,
      source: p.source,
      method: p.method,
      via: p.via,
      status: diagStatusText(p.status),
      ip: p.ip,
      geo: geoText(p),
      node: p.node,
      cache: p.cacheSignals?.length ? p.cacheSignals.join(' → ') : undefined,
      ecs: p.ecsSubnet,
      httpStatus: p.httpStatus,
      durationMs: p.durationMs,
      error: p.error
    }))
  )
  return {
    runId: diag.runId,
    startedAt: diag.startedAt,
    finishedAt: diag.finishedAt,
    status: diagStatusText(diag.status),
    modules,
    probes: probeRows
  }
}

export function buildReportModel(input: ReportInput): ReportModel {
  const ok = input.results.filter((r) => r.ok)
  const { main } = exitGroups(ok)
  const mrs = main?.rs ?? ok

  const netType = aggregateField(mrs, (r) => {
    if (r.flags?.residential) return tt('misc.netType.residential')
    if (r.flags?.datacenter) return tt('misc.netType.datacenter')
    if (r.flags?.hosting) return tt('misc.netType.hosting')
    return null
  })

  const fields: { label: string; value: string }[] = [
    { label: tt('misc.report.summary.isp'), value: fv(aggregateField(mrs, (r) => r.isp)) },
    { label: 'ASN', value: fv(aggregateField(mrs, (r) => r.asn)) },
    { label: 'Organization', value: fv(aggregateField(mrs, (r) => r.organization)) },
    { label: tt('misc.report.summary.netType'), value: fv(netType) },
    { label: tt('misc.report.summary.country'), value: fv(aggregateField(mrs, (r) => r.country)) },
    { label: tt('misc.report.summary.region'), value: fv(aggregateField(mrs, (r) => r.region)) },
    { label: tt('misc.report.summary.city'), value: fv(aggregateField(mrs, (r) => r.city)) },
    { label: tt('misc.report.summary.timezone'), value: fv(aggregateField(mrs, (r) => r.timezone)) },
    {
      label: tt('misc.report.summary.coords'),
      value: fv(
        aggregateField(mrs, (r) =>
          r.location?.lat != null && r.location?.lon != null
            ? `${r.location.lat}, ${r.location.lon}`
            : null
        )
      )
    },
    { label: 'VPN', value: TRI_VIEW[flagConsensus(ok, 'vpn').state].text },
    { label: tt('misc.report.summary.proxy'), value: TRI_VIEW[flagConsensus(ok, 'proxy').state].text },
    { label: 'Tor', value: TRI_VIEW[flagConsensus(ok, 'tor').state].text },
    { label: tt('misc.report.summary.crawler'), value: TRI_VIEW[flagConsensus(ok, 'crawler').state].text },
    {
      label: tt('misc.report.summary.native'),
      value: fv(aggregateField(mrs, (r) => r.nativeLabel))
    }
  ]

  const gpt = ok.find((r) => r.provider.id === 'netcoffee_gpt')
  if (gpt?.dnsLeak?.status) fields.push({ label: tt('misc.report.summary.dnsLeak'), value: gpt.dnsLeak.status })
  if (gpt?.webRTCLeak?.status)
    fields.push({ label: tt('misc.report.summary.webrtcLeak'), value: gpt.webRTCLeak.status })
  const nc = ok.find((r) => r.provider.id === 'netcoffee')
  if (nc?.blacklistSummary)
    fields.push({
      label: tt('misc.report.summary.blacklist'),
      value: tt('misc.report.summary.blacklistValue', {
        listed: nc.blacklistSummary.listed,
        checked: nc.blacklistSummary.checked
      })
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
        ? tt('misc.netType.residential')
        : r?.flags?.datacenter
          ? tt('misc.netType.datacenter')
          : r?.flags?.hosting
            ? tt('misc.netType.hosting')
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
    diag: input.diag ? buildDiagSection(input.diag) : undefined,
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
    aiReport: rec.aiReport,
    diag: rec.diag
  }
}

/** 诊断摘要 → 有界 AI 事实行（不含原始证据全文；行数与长度受限） */
export function diagAiLines(diag: DiagRunSummary): string[] {
  const moduleNames: Record<string, string> = {
    publicIp: tt('diag.module.publicIp'),
    splitTunnel: tt('diag.module.splitTunnel'),
    cdnNode: tt('diag.module.cdnNode'),
    dnsExit: tt('diag.module.dnsExit')
  }
  const lines: string[] = []
  for (const id of Object.keys(moduleNames)) {
    const probes = diag.probes[id as keyof typeof diag.probes] ?? []
    for (const p of probes.slice(0, 12)) {
      const target = p.target ?? p.id
      if (p.status === 'success') {
        if (p.ip) {
          lines.push(`[${moduleNames[id]}] ${target}: ${tt('diag.status.success')}, exit ${p.ip}${p.family ? ` (${p.family})` : ''}${p.node ? `, node ${p.node}` : ''}, via ${p.via}, source ${p.source}`)
        } else if (p.node) {
          lines.push(`[${moduleNames[id]}] ${target}: ${tt('diag.status.success')}, node ${p.node}, via ${p.via}, source ${p.source}`)
        } else {
          lines.push(`[${moduleNames[id]}] ${target}: ${tt('diag.statusLong.reachOnly')}, via ${p.via}`)
        }
      } else if (p.status !== 'pending' && p.status !== 'skipped') {
        lines.push(`[${moduleNames[id]}] ${target}: ${diagStatusText(p.status)}${p.error ? ` (${p.error.slice(0, 60)})` : ''}`)
      }
    }
  }
  return lines.slice(0, 60)
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
