import { net } from 'electron'
import dgram from 'dgram'
import https from 'https'
import type {
  DiagEvidence,
  DiagProbe,
  DiagStatus,
  DiagVia,
  SplitCategory
} from '@shared/diag'
import {
  CDN_TARGETS,
  EVIDENCE_MAX,
  PUBLIC_IP_TARGETS,
  SPLIT_TARGETS,
  makeEvidence,
  type CdnTarget,
  type SplitTarget
} from './targets'
import {
  extractCdnSignals,
  parseAkamaiWhoami,
  parseBiliZone,
  parseDnsReply,
  parseGoogleWhoami,
  parseIpipText,
  parsePlainIp,
  parseTrace,
  parseTraceEcho,
  type SplitEchoParse
} from './textparse'

// =============================================================
// 出口诊断 - 探测骨架与真实执行
// · HTTP：主进程 net.fetch（与浏览器共用网络栈，跟随系统代理；
//   不伪造 Referer / Origin / 令牌；保留证书校验）。
// · IPv6：Node https 强制 family=6 直连（不经应用层代理；仍可能被
//   系统路由 / TUN 接管，如实记录机制，不据此推断其他路径）。
// · DNS：本机 UDP 直连指定解析器（按服务器地址选择 udp4/udp6）。
// 每次执行把尝试追加到 probe.attempts；最新一次决定展示值。
// 所有失败保留真实错误；超时、403、429 等只影响该探测项。
// =============================================================

export const PROBE_TIMEOUT_MS = 9000

// ---------------- 骨架创建 ----------------

export interface ProbeSpec {
  id: string
  source: string
  sourceUrl?: string
  target?: string
  targetHost?: string
  url?: string
  method: string
  mechKey: DiagProbe['mechKey']
  via: DiagVia
  category?: SplitCategory
}

/** 创建排队中的探测骨架（执行前即创建，页面可立即逐行渲染） */
export function makeProbe(spec: ProbeSpec): DiagProbe {
  return {
    id: spec.id,
    source: spec.source,
    sourceUrl: spec.sourceUrl,
    target: spec.target,
    targetHost: spec.targetHost,
    url: spec.url,
    method: spec.method,
    mechKey: spec.mechKey,
    via: spec.via,
    category: spec.category,
    status: 'queued'
  }
}

function recordAttempt(p: DiagProbe): void {
  p.attempts = p.attempts ?? []
  p.attempts.push({
    startedAt: p.startedAt ?? new Date().toISOString(),
    finishedAt: p.finishedAt,
    status: p.status,
    error: p.error
  })
}

/** HTTP 响应上下文（parse 回调输入） */
export interface HttpCtx {
  status: number
  headers: Record<string, string> // 同名多值以 ", " 合并（保持出现顺序）
  body: string | null
  durationMs: number
}

type HttpParse = (ctx: HttpCtx) => { patch?: Partial<DiagProbe>; evidence?: DiagEvidence[]; error?: string }

/** 执行 HTTP 探测（net.fetch，跟随系统代理）；失败 / 超时只落在本探测项 */
export async function execHttpProbe(
  probe: DiagProbe,
  opts: { timeoutMs?: number; parse: HttpParse; shouldAbort?: () => boolean }
): Promise<DiagProbe> {
  const url = probe.url ?? ''
  probe.status = 'running'
  probe.startedAt = new Date().toISOString()
  probe.error = undefined
  const t0 = Date.now()
  const timeout = opts.timeoutMs ?? PROBE_TIMEOUT_MS
  try {
    const p = net.fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeout),
      headers: { 'cache-control': 'no-cache' },
      credentials: 'omit'
    })
    const hardTimer = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('probe hard-timeout')), timeout + 4000)
    )
    const r = await Promise.race([p, hardTimer])
    if (opts.shouldAbort?.()) {
      probe.status = 'canceled'
      probe.error = '已取消'
      probe.finishedAt = new Date().toISOString()
      probe.durationMs = Date.now() - t0
      recordAttempt(probe)
      return probe
    }
    const body = await Promise.race([
      r.text().catch(() => null),
      new Promise<null>((res) => setTimeout(() => res(null), 3000))
    ])
    probe.durationMs = Date.now() - t0
    probe.finishedAt = new Date().toISOString()
    probe.httpStatus = r.status
    const headers: Record<string, string> = {}
    for (const [k, v] of (r.headers as unknown as Map<string, string>).entries()) {
      headers[k.toLowerCase()] = v
    }
    const parsed = opts.parse({ status: r.status, headers, body, durationMs: probe.durationMs })
    Object.assign(probe, parsed.patch ?? {})
    probe.evidence = parsed.evidence
    if (parsed.error) {
      probe.status = 'failed'
      probe.error = parsed.error
    } else if (r.ok) {
      probe.status = 'success'
    } else {
      probe.status = describeHttpFailure(r.status).status
      probe.error = describeHttpFailure(r.status).text
    }
  } catch (e) {
    probe.finishedAt = new Date().toISOString()
    probe.durationMs = Date.now() - t0
    const msg = e instanceof Error ? e.message : String(e)
    if (/cancel|abort/i.test(msg) && opts.shouldAbort?.()) {
      probe.status = 'canceled'
      probe.error = '已取消'
    } else if (/timeout|timed?[- ]?out|abort/i.test(msg)) {
      probe.status = 'timeout'
      probe.error = `请求超时（${timeout}ms）`
    } else {
      probe.status = 'failed'
      probe.error = msg.slice(0, 200)
    }
  }
  recordAttempt(probe)
  return probe
}

/** HTTP 状态码 → 状态与简短说明（403/429/5xx 区分呈现） */
function describeHttpFailure(status: number): { status: DiagStatus; text: string } {
  if (status === 403) return { status: 'failed', text: 'HTTP 403（目标拒绝访问，可能有人机验证或地区限制）' }
  if (status === 429) return { status: 'failed', text: 'HTTP 429（请求频率受限）' }
  if (status >= 500) return { status: 'failed', text: `HTTP ${status}（目标服务端错误）` }
  return { status: 'failed', text: `HTTP ${status}` }
}

function ipFamily(ip: string): 'ipv4' | 'ipv6' | 'unknown' {
  return ip.includes(':') ? 'ipv6' : 'ipv4'
}

// ---------------- 分流 / 公网出口：各回显机制解析 ----------------

/** trace（/cdn-cgi/trace）解析：ip= 出口、colo= 节点、loc= 国家码 */
export function traceParse(note: string): HttpParse {
  return ({ status, body, durationMs }) => {
    if (body == null) {
      return { error: '响应不可读', evidence: [makeEvidence({ kind: 'http', status, durationMs, note })] }
    }
    const t = parseTrace(body)
    const ev = makeEvidence({ kind: 'http', status, durationMs, snippet: body.slice(0, EVIDENCE_MAX), note })
    if (!t.ip) return { error: '响应中无 ip 字段', evidence: [ev] }
    return {
      patch: { ip: t.ip, family: ipFamily(t.ip), node: t.colo },
      evidence: [ev]
    }
  }
}

function splitParseFor(echo: SplitTarget['echo'], note: string): HttpParse {
  if (echo === 'cdn-cgi-trace') return traceParse(note)
  return ({ status, body, durationMs }) => {
    if (body == null) {
      return { error: '响应不可读', evidence: [makeEvidence({ kind: 'http', status, durationMs, note })] }
    }
    let parsed: SplitEchoParse
    switch (echo) {
      case 'bili-zone':
        parsed = parseBiliZone(body)
        break
      case 'ipip-text':
        parsed = parseIpipText(body)
        break
      case 'plain-ip':
        parsed = parsePlainIp(body)
        break
      default:
        parsed = { error: undefined }
    }
    const ev = makeEvidence({ kind: 'http', status, durationMs, snippet: body.slice(0, EVIDENCE_MAX), note })
    if (parsed.error) return { error: parsed.error, evidence: [ev] }
    const patch: Partial<DiagProbe> = parsed.ip
      ? { ip: parsed.ip, family: ipFamily(parsed.ip) }
      : {}
    // 目标自身提供的归属（来源即目标本身，不冒充独立归属查询）
    if (parsed.inlineGeo && (parsed.inlineGeo.country || parsed.inlineGeo.isp)) {
      patch.geo = {
        country: parsed.inlineGeo.country,
        region: parsed.inlineGeo.region,
        city: parsed.inlineGeo.city,
        isp: parsed.inlineGeo.isp,
        source: '目标自身提供',
        fetchedAt: new Date().toISOString()
      }
    }
    return { patch, evidence: [ev] }
  }
}

/** 可达性探测（无出口回显的目标）：只记录状态/耗时/关键头 */
function reachabilityParse(note: string): HttpParse {
  return ({ status, headers, durationMs, body }) => {
    const keys = ['server', 'content-type', 'date', 'cf-ray']
    const snippet = keys.filter((k) => headers[k]).map((k) => `${k}: ${String(headers[k]).slice(0, 120)}`).join('\n')
    return {
      evidence: [
        makeEvidence({
          kind: 'http',
          status,
          durationMs,
          snippet: snippet + (body ? `\n[body ${body.length}B]` : ''),
          note
        })
      ]
    }
  }
}

// ---------------- 骨架构建（从目标配置） ----------------

export function splitProbeSpecs(): ProbeSpec[] {
  return SPLIT_TARGETS.map((t) => ({
    id: `split-${t.name}`,
    source: t.echo === 'cdn-cgi-trace' ? 'cloudflare' : t.echo === 'none' ? 'target-site' : 'target-api',
    sourceUrl: t.sourceUrl,
    target: t.name,
    targetHost: t.host,
    url: t.url,
    method:
      t.echo === 'cdn-cgi-trace'
        ? 'HTTP GET /cdn-cgi/trace'
        : t.echo === 'none'
          ? 'HTTP GET（不回显出口）'
          : 'HTTP GET（目标公开回显接口）',
    mechKey: 'http-proxy' as const,
    via: 'main-http' as const,
    category: t.category
  }))
}

export function execSplitProbe(probe: DiagProbe, target: SplitTarget, shouldAbort: () => boolean): Promise<DiagProbe> {
  const parse = target.echo === 'none' ? reachabilityParse('该目标不回显出口 IP：仅记录可达性、状态与耗时') : splitParseFor(target.echo, `回显机制：${target.echo}（${target.note}）`)
  return execHttpProbe(probe, { parse, shouldAbort })
}

export function cdnProbeSpecs(): ProbeSpec[] {
  return CDN_TARGETS.map((t) => ({
    id: `cdn-${t.cdn}`,
    source: 'cdn-target',
    sourceUrl: t.sourceUrl,
    target: t.cdn,
    targetHost: t.host,
    url: t.url,
    method: t.signal === 'trace-colo' ? 'HTTP GET /cdn-cgi/trace' : 'HTTP GET（响应头信号）',
    mechKey: 'http-proxy' as const,
    via: 'main-http' as const
  }))
}

export function execCdnProbe(probe: DiagProbe, target: CdnTarget, shouldAbort: () => boolean): Promise<DiagProbe> {
  const parse: HttpParse =
    target.signal === 'trace-colo'
      ? traceParse(`${target.originNote}；节点 = trace colo 字段`)
      : ({ status, headers, body, durationMs }) => {
          const sig = extractCdnSignals(headers, target.signal)
          const keys = ['server', 'x-served-by', 'x-cache', 'x-cache-hits', 'x-amz-cf-pop', 'x-77-pop', 'x-77-cache', 'x-cf1', 'x-cf2', 'x-cdn-pop', 'cf-ray', 'content-type', 'date']
          const snippet = keys.filter((k) => headers[k]).map((k) => `${k}: ${String(headers[k]).slice(0, 160)}`).join('\n')
          return {
            patch: { node: sig.node, cacheSignals: sig.cacheSignals.length ? sig.cacheSignals : undefined },
            evidence: [
              makeEvidence({
                kind: 'http',
                status,
                durationMs,
                snippet: snippet + (body ? `\n[body ${body.length}B]` : ''),
                note: `${target.originNote}；节点信号 = ${target.signal}，缓存信号按响应头顺序保留`
              })
            ]
          }
        }
  return execHttpProbe(probe, { parse, shouldAbort })
}

export function publicIpProbeSpecs(): ProbeSpec[] {
  return [
    ...PUBLIC_IP_TARGETS.map(
      (t): ProbeSpec => ({
        id: `trace-${t.host}`,
        source: 'cloudflare',
        sourceUrl: 'https://www.cloudflare.com/',
        target: t.host,
        targetHost: t.host,
        url: t.url,
        method: `HTTP GET /cdn-cgi/trace（${t.note}）`,
        mechKey: 'http-proxy',
        via: 'main-http'
      })
    ),
    {
      id: 'trace-v6-www.cloudflare.com',
      source: 'cloudflare',
      sourceUrl: 'https://www.cloudflare.com/',
      target: 'www.cloudflare.com（IPv6）',
      targetHost: 'www.cloudflare.com',
      url: 'https://www.cloudflare.com/cdn-cgi/trace',
      method: 'HTTP GET /cdn-cgi/trace（Node https 强制 IPv6 直连，不经应用层代理）',
      mechKey: 'node-direct',
      via: 'node-direct'
    }
  ]
}

/** IPv6 直连探测（Node https family=6）：无 IPv6 连通性 → unsupported（中性） */
export async function execIpv6Probe(probe: DiagProbe, shouldAbort: () => boolean): Promise<DiagProbe> {
  const target = 'www.cloudflare.com'
  probe.status = 'running'
  probe.startedAt = new Date().toISOString()
  probe.error = undefined
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
          if (body.length > 4096) body = body.slice(0, 4096)
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
              note: 'Node https family=6 强制 IPv6 直连：不经应用层代理；系统级路由 / TUN 接管时仍会受影响，本机制不代表测量了全部真实路径'
            })
          ]
          if (res.statusCode === 200 && t.ip) {
            probe.status = 'success'
            probe.ip = t.ip
            probe.family = ipFamily(t.ip)
            probe.node = t.colo
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
      if (shouldAbort()) {
        probe.status = 'canceled'
        probe.error = '已取消'
      } else if (/ENETUNREACH|EADDRNOTAVAIL|EAFNOSUPPORT|ENOTSUP|EHOSTUNREACH|ENOENT|ETIME/i.test(msg)) {
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
  recordAttempt(probe)
  return probe
}

// ---------------- DNS TXT 探测 ----------------

export interface DnsJobSpec extends ProbeSpec {
  queryName: string
  server: string
  sourceUrl: string
  zoneSource: 'google-authoritative' | 'akamai-authoritative'
  resolverKind: 'system' | 'public'
  serverAddr: string
}

function buildTxtQuery(name: string): { buf: Buffer; id: number } {
  const id = Math.floor(Math.random() * 65535)
  const labels = name.split('.').map((l) => Buffer.concat([Buffer.from([l.length]), Buffer.from(l)]))
  const qname = Buffer.concat([...labels, Buffer.from([0])])
  const header = Buffer.alloc(12)
  header.writeUInt16BE(id, 0)
  header.writeUInt16BE(0x0100, 2) // RD=1
  header.writeUInt16BE(1, 4)
  return { buf: Buffer.concat([header, qname, Buffer.from([0, 16, 0, 1])]), id }
}

/** 执行 DNS TXT 探测（按服务器地址选择 udp4/udp6；全 TXT 记录 + 字段语义解析） */
export async function execDnsProbe(probe: DiagProbe, spec: DnsJobSpec, shouldAbort: () => boolean): Promise<DiagProbe> {
  probe.status = 'running'
  probe.startedAt = new Date().toISOString()
  probe.error = undefined
  probe.serverAddr = spec.serverAddr
  probe.resolverKind = spec.resolverKind
  const t0 = Date.now()
  const timeout = PROBE_TIMEOUT_MS
  const useV6 = spec.server.includes(':')
  await new Promise<void>((resolve) => {
    const sock = useV6 ? dgram.createSocket('udp6') : dgram.createSocket('udp4')
    let done = false
    const { buf, id } = buildTxtQuery(spec.queryName)
    const finish = (): void => {
      if (!done) {
        done = true
        try {
          sock.close()
        } catch {
          /* already closed */
        }
        resolve()
      }
    }
    const timer = setTimeout(() => {
      if (shouldAbort()) {
        probe.status = 'canceled'
        probe.error = '已取消'
      } else {
        probe.status = 'timeout'
        probe.error = `DNS 查询超时（${timeout}ms）`
      }
      finish()
    }, timeout)
    sock.on('message', (msg) => {
      clearTimeout(timer)
      probe.finishedAt = new Date().toISOString()
      probe.durationMs = Date.now() - t0
      const r = parseDnsReply(msg, id)
      if (r.txtRecords && r.txtRecords.length) {
        const who =
          spec.zoneSource === 'akamai-authoritative' ? parseAkamaiWhoami(r.txtRecords) : parseGoogleWhoami(r.txtRecords)
        probe.dnsRecords = who.records
        probe.ecsSubnet = who.ecsSubnet
        probe.ecsRep = who.ecsRep
        probe.status = 'success'
        if (who.resolverExit) {
          probe.ip = who.resolverExit
          probe.family = ipFamily(who.resolverExit)
          probe.exitSource = who.exitSource
        } else {
          probe.ip = undefined
          probe.exitSource = undefined
        }
        probe.evidence = [
          makeEvidence({
            kind: 'dns',
            durationMs: probe.durationMs,
            snippet: who.records.join('\n'),
            note: `${spec.queryName} TXT 原文（经 ${spec.serverAddr} ${useV6 ? 'udp6' : 'udp4'} 查询）${who.ecsSubnet ? `；ECS 网段: ${who.ecsSubnet}` : ''}${who.ambiguous ? '；存在多条裸 IP 且语义不确定，不输出猜测的解析器出口' : ''}`
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
    sock.send(buf, 53, spec.server, (e) => {
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
  recordAttempt(probe)
  return probe
}

export { recordAttempt }

// ---------------- 聚合 ----------------

/** 聚合模块状态：有成功有失败/取消 → partial；全失败 → failed；全取消 → canceled */
export function aggregateStatus(probes: DiagProbe[], runTimedOut = false): DiagStatus {
  if (!probes.length) return 'pending'
  const st = probes.map((p) => p.status)
  if (st.every((s) => s === 'queued' || s === 'pending' || s === 'skipped')) return 'pending'
  if (st.includes('running')) return 'running'
  const ok = st.filter((s) => s === 'success').length
  const bad = st.filter((s) => ['failed', 'timeout'].includes(s)).length
  const canceled = st.filter((s) => s === 'canceled').length
  if (ok > 0) return bad + canceled > 0 ? 'partial' : 'success'
  if (canceled > 0 && bad === 0) return 'canceled'
  if (runTimedOut && bad > 0 && st.every((s) => s === 'timeout' || s === 'unsupported' || s === 'skipped')) return 'timeout'
  return 'failed'
}
