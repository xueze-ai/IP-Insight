import { net } from 'electron'
import dgram from 'dgram'
import https from 'https'
import type { DiagEvidence, DiagProbe, DiagStatus, DiagVia } from '@shared/diag'
import { EVIDENCE_MAX, makeEvidence } from './targets'
import { extractExitIp, parseTrace, parseTxtReply } from './textparse'

// =============================================================
// 出口诊断 - 真实探测原语
// · HTTP：主进程 net.fetch（与浏览器共用网络栈，遵循系统代理；
//   不伪造 Referer / Origin / 令牌；保留证书校验）。
// · DNS：本机 UDP 53 直接查询公共诊断区（whoami 类记录）。
// 所有失败保留真实错误；超时、403、429 等只影响该探测项。
// =============================================================

export const PROBE_TIMEOUT_MS = 9000

/**
 * IPv6 出口探测：用 Node https 强制 family=6 直连 Cloudflare trace。
 * 与系统代理路径可能不同（如实记录；多数本地代理不转发 IPv6）。
 * 失败时区分「未取得 IPv6 连接」（unsupported）与其他真实错误。
 */
export async function ipv6Probe(target = 'www.cloudflare.com'): Promise<DiagProbe> {
  const probe: DiagProbe = {
    id: `trace-v6-${target}`,
    source: 'cloudflare',
    sourceUrl: 'https://www.cloudflare.com/zh-cn/privacy/',
    target,
    targetHost: target,
    method: 'HTTP GET /cdn-cgi/trace（强制 IPv6 直连）',
    via: 'main-http',
    status: 'running',
    startedAt: new Date().toISOString()
  }
  const t0 = Date.now()
  await new Promise<void>((resolve) => {
    const req = https.request(
      {
        host: target,
        path: '/cdn-cgi/trace',
        method: 'GET',
        family: 6,
        servername: target,
        timeout: PROBE_TIMEOUT_MS,
        headers: { 'cache-control': 'no-cache' }
      },
      (res) => {
        let body = ''
        res.on('data', (c: Buffer) => {
          body += c.toString('utf8')
          if (body.length > 4096) body = body.slice(0, 4096) // trace 很短，防御性截断
        })
        res.on('end', () => {
          probe.finishedAt = new Date().toISOString()
          probe.durationMs = Date.now() - t0
          probe.httpStatus = res.statusCode
          const t = parseTrace(body)
          probe.evidence = [
            makeEvidence({
              kind: 'http',
              status: res.statusCode,
              durationMs: probe.durationMs,
              snippet: body.slice(0, EVIDENCE_MAX),
              note: '强制 IPv6 直连（Node https family=6），不经过本地代理'
            })
          ]
          if (res.statusCode === 200 && t.ip) {
            probe.status = 'success'
            probe.ip = t.ip
            probe.family = t.ip.includes(':') ? 'ipv6' : 'ipv4'
            probe.node = t.colo
            probe.country = t.loc
          } else {
            probe.status = 'failed'
            probe.error = `HTTP ${res.statusCode ?? '?'}`
          }
          resolve()
        })
      }
    )
    req.on('timeout', () => req.destroy(new Error('IPv6 请求超时')))
    req.on('error', (e) => {
      probe.finishedAt = new Date().toISOString()
      probe.durationMs = Date.now() - t0
      const msg = String(e.message ?? e)
      // 无 IPv6 连通性是常见且中性的结果：无 AAAA（ENOENT）、不可达、地址族不支持
      if (/ENETUNREACH|EADDRNOTAVAIL|EAFNOSUPPORT|ENOTSUP|EHOSTUNREACH|ENOENT|ETIME/i.test(msg)) {
        probe.status = 'unsupported'
        probe.error = '未取得 IPv6 出口（本机无 IPv6 连接或网络策略阻止）'
      } else if (/timed out|timeout/i.test(msg)) {
        probe.status = 'timeout'
        probe.error = msg.slice(0, 160)
      } else {
        probe.status = 'failed'
        probe.error = msg.slice(0, 160)
      }
      resolve()
    })
    req.end()
  })
  if (!probe.finishedAt) {
    probe.finishedAt = new Date().toISOString()
    probe.durationMs = Date.now() - t0
  }
  return probe
}

export interface HttpProbeInput {
  id: string
  source: string
  sourceUrl?: string
  target?: string
  targetHost?: string
  url: string
  method?: string
  via?: DiagVia
  timeoutMs?: number
  /** 解析响应：返回探测项的补充字段与证据 */
  parse: (ctx: {
    status: number
    headers: Record<string, string>
    body: string | null
    durationMs: number
    opaque: boolean
  }) => { patch?: Partial<DiagProbe>; evidence?: DiagEvidence[]; error?: string }
}

/** 单个 HTTP 探测：状态只落在该探测项上，绝不抛出 */
export async function httpProbe(input: HttpProbeInput): Promise<DiagProbe> {
  const probe: DiagProbe = {
    id: input.id,
    source: input.source,
    sourceUrl: input.sourceUrl,
    target: input.target,
    targetHost: input.targetHost ?? input.url,
    method: input.method ?? 'HTTP GET',
    via: input.via ?? 'main-http',
    status: 'running',
    startedAt: new Date().toISOString()
  }
  const t0 = Date.now()
  const timeout = input.timeoutMs ?? PROBE_TIMEOUT_MS
  let settled = false
  try {
    // AbortSignal.timeout + 双保险计时器：网络栈卡死时也保证有限时间返回
    const p = net.fetch(input.url, {
      method: input.method ?? 'GET',
      signal: AbortSignal.timeout(timeout),
      headers: { 'cache-control': 'no-cache' },
      // 允许读取诊断所需的少量响应头（X-Served-By 等）；不发送任何凭据
      credentials: 'omit'
    })
    const hardTimer = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('probe hard-timeout')), timeout + 4000)
    )
    const r = await Promise.race([p, hardTimer])
    settled = true
    const body = await Promise.race([
      r.text().catch(() => null),
      new Promise<null>((res) => setTimeout(() => res(null), 3000))
    ])
    const durationMs = Date.now() - t0
    const headers: Record<string, string> = {}
    for (const [k, v] of (r.headers as unknown as Map<string, string>).entries()) {
      headers[k.toLowerCase()] = v
    }
    const parsed = input.parse({
      status: r.status,
      headers,
      body,
      durationMs,
      opaque: r.type === 'opaque'
    })
    probe.finishedAt = new Date().toISOString()
    probe.durationMs = durationMs
    probe.httpStatus = r.status
    Object.assign(probe, parsed.patch ?? {})
    probe.evidence = parsed.evidence
    if (parsed.error) {
      probe.status = 'failed'
      probe.error = parsed.error
    } else if (r.ok) {
      probe.status = 'success'
    } else {
      // 4xx/5xx：保留状态码作为真实结果
      probe.status = 'failed'
      probe.error = `HTTP ${r.status}`
    }
  } catch (e) {
    probe.finishedAt = new Date().toISOString()
    probe.durationMs = Date.now() - t0
    const msg = e instanceof Error ? e.message : String(e)
    const timedOut = settled === false && /timeout|abort/i.test(msg)
    probe.status = timedOut || /timeout/i.test(msg) ? 'timeout' : 'failed'
    probe.error = msg.slice(0, 200)
  }
  return probe
}

// parseTrace / parseTxtReply / extractExitIp 位于 ./textparse（纯函数，可独立单测）

/** trace 探测共用 parse */
export function traceParse(): HttpProbeInput['parse'] {
  return ({ status, body, durationMs }) => {
    if (body == null) {
      return {
        error: '响应不可读',
        evidence: [makeEvidence({ kind: 'http', status, durationMs, note: '响应体不可读（可能为空或被截断）' })]
      }
    }
    const t = parseTrace(body)
    const ip = t.ip
    const ev = makeEvidence({ kind: 'http', status, durationMs, snippet: body.slice(0, EVIDENCE_MAX), note: 'Cloudflare /cdn-cgi/trace 原文' })
    if (!ip) return { error: '响应中无 ip 字段', evidence: [ev] }
    return {
      patch: { ip, family: ip.includes(':') ? 'ipv6' : 'ipv4', node: t.colo, country: t.loc },
      evidence: [ev]
    }
  }
}

/** 从响应头提取 CDN PoP / 缓存状态（按 target 配置的信号） */
export function cdnHeaderParse(cfg: {
  signal: string
  cacheSignal?: string
}): HttpProbeInput['parse'] {
  return ({ status, headers, durationMs, body }) => {
    const ev = makeEvidence({
      kind: 'http',
      status,
      durationMs,
      snippet: headersSnippet(headers, body),
      note: '响应头摘录（诊断信号）'
    })
    let node: string | undefined
    let cache: string | undefined
    switch (cfg.signal) {
      case 'x-served-by': {
        const v = headers['x-served-by']
        // 形如 cache-sin-wsss1830044-SIN → 取末段 PoP 代码
        const m = v?.match(/cache-[a-z0-9]+-[a-z0-9]*-?([A-Z]{2,4})/) ?? v?.match(/-([A-Z]{2,4})\s*$/)
        node = m ? m[1] : undefined
        break
      }
      case 'x-amz-cf-pop': {
        const m = headers['x-amz-cf-pop']?.match(/^([A-Z]{3})/)
        node = m ? m[1] : headers['x-amz-cf-pop']
        break
      }
      case 'x-77-pop':
        node = headers['x-77-pop'] || undefined
        break
      case 'server-bunny': {
        // Server: BunnyCDN-LA1-1108 / BunnyCDNE-JP1-1171
        const m = headers['server']?.match(/BunnyCDN\w*-([A-Z]{2}\d)/)
        node = m ? m[1] : undefined
        break
      }
      case 'x-cf1': {
        // X-CF1: 28637:fA.hkg3:co:...:cacheN.hkg3-01:H → hkg3
        const m = headers['x-cf1']?.match(/\.([a-z]{3}\d?)[:\-]/)
        node = m ? m[1].toUpperCase() : undefined
        break
      }
      case 'x-cdn-pop':
        node = headers['x-cdn-pop'] || undefined
        break
      default:
        node = undefined
    }
    switch (cfg.cacheSignal) {
      case 'x-cache': {
        const v = headers['x-cache'] ?? ''
        if (/hit/i.test(v)) cache = 'HIT'
        else if (/miss/i.test(v)) cache = 'MISS'
        break
      }
      case 'x-77-cache': {
        const v = headers['x-77-cache'] ?? ''
        if (/^hit/i.test(v)) cache = 'HIT'
        else if (/^miss/i.test(v)) cache = 'MISS'
        break
      }
      case 'x-cf2': {
        const v = headers['x-cf2'] ?? ''
        if (/^H$/i.test(v.trim())) cache = 'HIT'
        else if (/^M$/i.test(v.trim())) cache = 'MISS'
        break
      }
      default:
        cache = undefined
    }
    const patch: Partial<DiagProbe> = { node }
    if (cache) patch.ip = undefined
    return {
      patch,
      evidence: [
        ev,
        ...(cache ? [makeEvidence({ kind: 'http', status, note: `缓存状态信号：${cache}（来自响应头）` })] : [])
      ]
    }
  }
}

function headersSnippet(headers: Record<string, string>, body: string | null): string {
  const keys = ['server', 'x-served-by', 'x-cache', 'x-amz-cf-pop', 'x-77-pop', 'x-77-cache', 'x-cf1', 'x-cf2', 'x-cdn-pop', 'cf-ray', 'content-type', 'date']
  const lines = keys.filter((k) => headers[k]).map((k) => `${k}: ${headers[k].slice(0, 120)}`)
  return lines.join('\n') + (body ? `\n[body ${body.length}B]` : '')
}

/** 可达性探测（无出口回显的目标）：只记录状态/耗时/关键头 */
export function reachabilityParse(): HttpProbeInput['parse'] {
  return ({ status, headers, durationMs, body }) => {
    const ev = makeEvidence({
      kind: 'http',
      status,
      durationMs,
      snippet: headersSnippet(headers, body),
      note: '该目标不回显出口 IP：仅记录可达性、状态与耗时'
    })
    return { evidence: [ev] }
  }
}

// ---------------- DNS UDP 探测 ----------------

export interface DnsProbeInput {
  id: string
  source: string
  sourceUrl?: string
  /** 解析器标识 */
  target: string
  targetHost: string
  /** 被查询的诊断区名 */
  queryName: string
  server: string
  timeoutMs?: number
}

function buildTxtQuery(name: string): Buffer {
  const labels = name.split('.').map((l) => Buffer.concat([Buffer.from([l.length]), Buffer.from(l)]))
  const qname = Buffer.concat([...labels, Buffer.from([0])])
  const header = Buffer.alloc(12)
  header.writeUInt16BE(Math.floor(Math.random() * 65535), 0)
  header.writeUInt16BE(0x0100, 2) // RD=1
  header.writeUInt16BE(1, 4)
  return Buffer.concat([header, qname, Buffer.from([0, 16, 0, 1])]) // TXT IN
}

/** 单次 DNS TXT 探测（UDP 53 直连指定解析器） */
export async function dnsProbe(input: DnsProbeInput): Promise<DiagProbe> {
  const probe: DiagProbe = {
    id: input.id,
    source: input.source,
    sourceUrl: input.sourceUrl,
    target: input.target,
    targetHost: input.queryName,
    method: 'DNS TXT (UDP 53)',
    via: 'dns-udp',
    status: 'running',
    startedAt: new Date().toISOString()
  }
  const t0 = Date.now()
  const timeout = input.timeoutMs ?? PROBE_TIMEOUT_MS
  await new Promise<void>((resolve) => {
    const sock = dgram.createSocket('udp4')
    let done = false
    const finish = (): void => {
      if (!done) {
        done = true
        try { sock.close() } catch { /* already closed */ }
        resolve()
      }
    }
    const timer = setTimeout(() => {
      probe.status = 'timeout'
      probe.error = `DNS 查询超时（${timeout}ms）`
      finish()
    }, timeout)
    sock.on('message', (msg) => {
      clearTimeout(timer)
      const r = parseTxtReply(msg)
      probe.finishedAt = new Date().toISOString()
      probe.durationMs = Date.now() - t0
      if (r.txt != null) {
        const { ip, ecs } = extractExitIp(r.txt)
        probe.status = 'success'
        if (ip) {
          probe.ip = ip
          probe.family = ip.includes(':') ? 'ipv6' : 'ipv4'
        }
        probe.evidence = [
          makeEvidence({
            kind: 'dns',
            durationMs: probe.durationMs,
            snippet: r.txt.slice(0, EVIDENCE_MAX),
            note: `${input.queryName} TXT 原文（经 ${input.server || '系统配置解析器'} 查询）${ecs ? `；EDNS Client Subnet: ${ecs}` : ''}`
          })
        ]
      } else {
        probe.status = 'failed'
        probe.error = r.error ?? 'DNS 应答解析失败'
      }
      finish()
    })
    sock.on('error', (e) => {
      clearTimeout(timer)
      probe.status = 'failed'
      probe.error = String(e.message ?? e).slice(0, 200)
      finish()
    })
    sock.send(buildTxtQuery(input.queryName), 53, input.server || '127.0.0.1', (e) => {
      if (e) {
        clearTimeout(timer)
        probe.status = 'failed'
        probe.error = String(e.message ?? e).slice(0, 200)
        finish()
      }
    })
  })
  if (!probe.finishedAt) {
    probe.finishedAt = new Date().toISOString()
    probe.durationMs = Date.now() - t0
  }
  return probe
}

/** 聚合模块状态：有成功有失败 → partial；全失败 → failed … */
export function aggregateStatus(probes: DiagProbe[]): DiagStatus {
  if (!probes.length) return 'pending'
  const st = probes.map((p) => p.status)
  if (st.every((s) => s === 'pending' || s === 'skipped')) return 'pending'
  if (st.includes('running')) return 'running'
  const ok = st.filter((s) => s === 'success').length
  const bad = st.filter((s) => ['failed', 'timeout'].includes(s)).length
  if (ok === 0 && bad > 0) return 'failed'
  if (ok > 0 && bad > 0) return 'partial'
  if (ok === st.length) return 'success'
  return 'partial'
}
