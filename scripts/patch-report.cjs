const fs = require('fs')
const p = 'src/renderer/src/utils/report.ts'
let s = fs.readFileSync(p, 'utf-8')

// 1. probeRows: add geo / cache / ecs columns
s = s.replace(
  `  const probeRows = moduleIds.flatMap((id) =>
    (diag.probes[id] ?? []).map((p) => ({
      module: tt(DIAG_MODULE_KEYS[id]),
      target: p.target,
      source: p.source,
      method: p.method,
      via: p.via,
      status: diagStatusText(p.status),
      ip: p.ip,
      node: p.node,
      httpStatus: p.httpStatus,
      durationMs: p.durationMs,
      error: p.error
    }))
  )`,
  `  const geoText = (p: (typeof diag.probes)['publicIp'][number]): string | undefined =>
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
  )`
)

// 2. module rows: ECS summary for dnsExit
s = s.replace(
  `      const bad = probes.filter((p) => p.status === 'failed' || p.status === 'timeout')`,
  `      const ecs = [...new Set(probes.filter((p) => p.ecsSubnet).map((p) => p.ecsSubnet as string))]
      if (ecs.length) rows.push({ label: tt('diag.col.ecs'), value: ecs.join('；') })
      const bad = probes.filter((p) => p.status === 'failed' || p.status === 'timeout')`
)

fs.writeFileSync(p, s)
console.log('report.ts patched')
