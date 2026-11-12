import { net } from 'electron'
import dgram from 'dgram'
import dns from 'dns'
import https from 'https'
import type {
  WhoDnsProbe,
  WhoEgressSample,
  WhoGeo,
  WhoRawItem,
  WhoServerFacts,
  WhoServerReport,
  WhoServerRequest
} from '@shared/whoami'
import { parseAkamaiWhoami, parseDnsReply, parseGoogleWhoami, parseTrace } from '../diag/textparse'

// =============================================================
// 「网站眼里的你」——服务器侧可见信息
//
// 这里只做「真实请求 → 真实响应」的采集：
// · /cdn-cgi/trace：Cloudflare 官方公开诊断路径，回显出口 IP / 节点 / TLS / HTTP 版本等
// · ip-api.com（回退 ipwho.is）：按出口 IP 查归属，并读取代理 / 机房 / 移动标记
// · Akamai / Google 官方 DNS 诊断区：回显递归解析器出口（区分 ECS 客户端网段）
// · check.torproject.org 公开出口节点列表：判断出口是否在 Tor 列表中
// · Node https 直连：拿到 TLS 协议 / 密码套件 / ALPN（trace 不提供这些）
// 拿不到就标 unavailable / error，不补默认值、不推断。
// =============================================================

const TIMEOUT_MS = 9000
const TOR_LIST_URL = 'https://check.torproject.org/tor-exit-list.txt'
const TOR_CACHE_MS = 30 * 60_000

let torCache: { at: number; set: Set<string> } | null = null

interface EchoProbe {
  fields: Record<string, string> | null
  ms: number
  status: number
  error?: string
}

function echoHeaders(req: WhoServerRequest): Record<string, string> {
  const h: Record<string, string> = {
    'cache-control': 'no-cache',
    accept: 'text/plain,*/*'
  }
  if (req.userAgent) h['user-agent'] = req.userAgent
  if (req.acceptLanguage) h['accept-language'] = req.acceptLanguage
  return h
}

/** 读取一个回显端点（/cdn-cgi/trace 为 key=value，纯文本接口为单行） */
async function fetchEcho(url: string, req: WhoServerRequest): Promise<EchoProbe> {
  const t0 = Date.now()
  try {
    const r = await net.fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: echoHeaders(req),
      credentials: 'omit'
    })
    const body = (await r.text()) ?? ''
    return {
      fields: body.includes('=') ? parseTrace(body) : { raw: body.trim().slice(0, 120) },
      ms: Date.now() - t0,
      status: r.status
    }
  } catch (e) {
    return {
      fields: null,
      ms: Date.now() - t0,
      status: 0,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}

/** 查出口 IP 归属（ip-api 优先，回退 ipwho.is）；带代理 / 机房 / 移动标记 */
async function lookupGeoDetail(ip: string, lang: 'zh' | 'en'): Promise<WhoGeo | null> {
  if (!ip) return null
  const langParam = lang === 'en' ? 'en' : 'zh-CN'
  try {
    const fields =
      'status,message,country,regionName,city,isp,org,as,asname,timezone,lat,lon,proxy,hosting,mobile,reverse,query'
    const r = await net.fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}&lang=${langParam}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' }, credentials: 'omit' }
    )
    const j = (await r.json()) as {
      status?: string
      country?: string
      regionName?: string
      city?: string
      isp?: string
      org?: string
      as?: string
      asname?: string
      timezone?: string
      lat?: number
      lon?: number
      proxy?: boolean
      hosting?: boolean
      mobile?: boolean
      reverse?: string
    }
    if (j.status === 'success') {
      return {
        country: j.country,
        region: j.regionName,
        city: j.city,
        isp: j.isp,
        org: j.org,
        asn: j.as,
        asname: j.asname,
        timezone: j.timezone,
        lat: j.lat,
        lon: j.lon,
        proxy: j.proxy,
        hosting: j.hosting,
        mobile: j.mobile,
        reverse: j.reverse,
        source: 'ip-api.com',
        fetchedAt: new Date().toISOString()
      }
    }
  } catch {
    /* 回退到 ipwho.is */
  }
  try {
    const r = await net.fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
      credentials: 'omit'
    })
    const j = (await r.json()) as {
      success?: boolean
      country?: string
      region?: string
      city?: string
      connection?: { isp?: string; org?: string; asn?: number }
      timezone?: { id?: string }
      latitude?: number
      longitude?: number
    }
    if (j.success !== false) {
      return {
        country: j.country,
        region: j.region,
        city: j.city,
        isp: j.connection?.isp,
        org: j.connection?.org,
        asn: j.connection?.asn != null ? `AS${j.connection.asn}` : undefined,
        timezone: j.timezone?.id,
        lat: j.latitude,
        lon: j.longitude,
        source: 'ipwho.is',
        fetchedAt: new Date().toISOString()
      }
    }
  } catch {
    /* 归属不可得：保留 IP，标注未获取 */
  }
  return null
}

// ---------------- DNS 递归出口 ----------------

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

async function queryWhoami(
  server: string,
  name: string,
  timeout = 7000
): Promise<{ records?: string[][]; error?: string; ms: number }> {
  const t0 = Date.now()
  return new Promise((resolve) => {
    const useV6 = server.includes(':')
    let sock: dgram.Socket
    try {
      sock = dgram.createSocket(useV6 ? 'udp6' : 'udp4')
    } catch (e) {
      resolve({ error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 })
      return
    }
    const pending = buildTxtQuery(name)
    let done = false
    const finish = (v: { records?: string[][]; error?: string }): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      try {
        sock.close()
      } catch {
        /* closed */
      }
      resolve({ ...v, ms: Date.now() - t0 })
    }
    const timer = setTimeout(() => finish({ error: `DNS 查询超时（${timeout}ms）` }), timeout)
    sock.on('message', (msg) => {
      const r = parseDnsReply(msg, pending.id)
      if (r.txtRecords?.length) finish({ records: r.txtRecords })
      else finish({ error: r.error ?? 'DNS 应答无 TXT 记录' })
    })
    sock.on('error', (e) => finish({ error: String(e.message ?? e).slice(0, 160) }))
    sock.send(pending.buf, 53, server, (e) => {
      if (e) finish({ error: String(e.message ?? e).slice(0, 160) })
    })
  })
}

async function probeDns(server: string, label: string, zone: string): Promise<WhoDnsProbe> {
  if (!server) {
    return { name: label, server: '', zone, status: 'unavailable', error: '未取得 DNS 服务器地址' }
  }
  const r = await queryWhoami(server, zone === 'akamai' ? 'whoami.ds.akahelp.net' : 'o-o.myaddr.l.google.com')
  const base: WhoDnsProbe = {
    name: label,
    server,
    zone,
    records: r.records?.map((seg) => seg.join(' ')),
    status: r.records ? 'ok' : 'error',
    error: r.error,
    durationMs: r.ms
  }
  if (!r.records) return base
  const who = zone === 'akamai' ? parseAkamaiWhoami(r.records) : parseGoogleWhoami(r.records)
  if (who.ecsSubnet) base.ecs = who.ecsSubnet
  if (who.resolverExit) {
    base.exitIp = who.resolverExit
    base.family = who.resolverExit.includes(':') ? 'ipv6' : 'ipv4'
    base.status = 'ok'
  } else {
    base.status = 'partial'
    base.error = who.ambiguous ? '存在多条裸 IP，语义不明确，不输出猜测的出口' : '应答未给出解析器出口'
  }
  return base
}

// ---------------- Tor 出口节点列表 ----------------

async function loadTorExits(): Promise<Set<string> | null> {
  if (torCache && Date.now() - torCache.at < TOR_CACHE_MS) return torCache.set
  try {
    const r = await net.fetch(TOR_LIST_URL, {
      signal: AbortSignal.timeout(12000),
      credentials: 'omit',
      headers: { accept: 'text/plain' }
    })
    if (!r.ok) return null
    const text = await r.text()
    const set = new Set(
      text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    )
    torCache = { at: Date.now(), set }
    return set
  } catch {
    return null
  }
}

// ---------------- TLS / IPv6 直连观测 ----------------

interface TlsObs {
  protocol?: string
  cipher?: string
  alpn?: string
}

function observeTls(host: string): Promise<TlsObs> {
  return new Promise((resolve) => {
    const req = https.request(
      { host, path: '/cdn-cgi/trace', method: 'GET', timeout: TIMEOUT_MS, headers: { 'cache-control': 'no-cache' } },
      (res) => {
        const socket = res.socket as unknown as {
          getProtocol?: () => string
          getCipher?: () => { name?: string }
          alpnProtocol?: string
        }
        const out: TlsObs = {
          protocol: socket.getProtocol?.(),
          cipher: socket.getCipher?.()?.name,
          alpn: socket.alpnProtocol
        }
        res.resume()
        res.on('end', () => resolve(out))
      }
    )
    req.on('timeout', () => req.destroy(new Error('TLS 观测超时')))
    req.on('error', () => resolve({}))
    req.end()
  })
}

/** IPv6 出口（Node https 强制 family=6；不经应用层代理，仍可能被系统 TUN 接管） */
function observeIpv6(): Promise<{ ip?: string }> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: 'www.cloudflare.com',
        path: '/cdn-cgi/trace',
        method: 'GET',
        family: 6,
        servername: 'www.cloudflare.com',
        timeout: TIMEOUT_MS,
        headers: { 'cache-control': 'no-cache' }
      },
      (res) => {
        let body = ''
        res.on('data', (c: Buffer) => {
          body += c.toString('utf8')
          if (body.length > 2048) body = body.slice(0, 2048)
        })
        res.on('end', () => {
          const t = parseTrace(body)
          resolve(t.ip ? { ip: t.ip } : {})
        })
      }
    )
    req.on('timeout', () => req.destroy(new Error('IPv6 请求超时')))
    req.on('error', () => resolve({}))
    req.end()
  })
}

// ---------------- 组装 ----------------

function rawItem(id: string, value: string | null, source: string, detail?: string): WhoRawItem {
  return { id, value, source, detail, status: value ? 'ok' : 'unavailable' }
}

export async function collectServer(req: WhoServerRequest = {}): Promise<WhoServerReport> {
  const lang = req.lang === 'en' ? 'en' : 'zh'
  const collectedAt = new Date().toISOString()
  const items: WhoRawItem[] = []
  const facts: WhoServerFacts = { dns: [], dnsServers: [], egress: [] }

  try {
    facts.dnsServers = dns.getServers().filter(Boolean)
  } catch {
    facts.dnsServers = []
  }

  const [cf, speed, chatgpt, ipSb, tls, ipv6, tor] = await Promise.all([
    fetchEcho('https://www.cloudflare.com/cdn-cgi/trace', req),
    fetchEcho('https://speed.cloudflare.com/cdn-cgi/trace', req),
    fetchEcho('https://chatgpt.com/cdn-cgi/trace', req),
    fetchEcho('https://api.ip.sb/ip', req),
    observeTls('www.cloudflare.com'),
    observeIpv6(),
    loadTorExits()
  ])

  const cfFields = cf.fields ?? {}
  facts.trace = Object.keys(cfFields).length ? cfFields : undefined

  const egressOf = (host: string, url: string, p: EchoProbe, field = 'ip'): WhoEgressSample => {
    const raw = p.fields?.[field]?.trim()
    const ip = raw && /^[0-9a-fA-F:.]+$/.test(raw) ? raw : undefined
    return {
      host,
      url,
      ip,
      family: ip ? (ip.includes(':') ? 'ipv6' : 'ipv4') : undefined,
      colo: p.fields?.['colo'],
      country: p.fields?.['loc'],
      durationMs: p.ms,
      status: ip ? 'ok' : p.fields ? 'partial' : p.status === 0 ? 'error' : 'partial',
      error: p.error ?? (ip ? undefined : '未回显 IP')
    }
  }

  facts.egress = [
    egressOf('www.cloudflare.com', 'https://www.cloudflare.com/cdn-cgi/trace', cf),
    egressOf('speed.cloudflare.com', 'https://speed.cloudflare.com/cdn-cgi/trace', speed),
    egressOf('chatgpt.com', 'https://chatgpt.com/cdn-cgi/trace', chatgpt),
    egressOf('api.ip.sb', 'https://api.ip.sb/ip', ipSb, 'raw')
  ]

  const latencies = [cf.ms, speed.ms, chatgpt.ms].filter((n) => n > 0)
  if (latencies.length) {
    facts.latencySamples = latencies
    facts.latencyMs = Math.min(...latencies)
  }

  const ips = [...new Set(facts.egress.map((e) => e.ip).filter((v): v is string => !!v))]
  const mainIp = cfFields['ip'] ?? ips[0]

  facts.tlsCipher = tls.cipher
  facts.tlsAlpn = tls.alpn
  facts.ipv6 = ipv6.ip ?? null
  facts.ipv6Status = ipv6.ip ? 'ok' : 'unavailable'

  const ts = Number(cfFields['ts'])
  if (Number.isFinite(ts) && ts > 0) facts.clockSkewMs = Math.round((Date.now() / 1000 - ts) * 1000)

  if (mainIp) facts.geo = await lookupGeoDetail(mainIp, lang).catch(() => null)
  facts.torExit = tor && mainIp ? tor.has(mainIp) : null

  const systemServer = facts.dnsServers[0] ?? ''
  const [dnsSystem, dnsPublic] = await Promise.all([
    probeDns(systemServer, '系统配置解析器', 'akamai'),
    probeDns('223.5.5.5', '阿里云公共 DNS（参考）', 'akamai')
  ])
  facts.dns = [dnsSystem, dnsPublic]

  const g = facts.geo
  items.push(rawItem('server.ip', mainIp ?? null, 'cdn-cgi/trace · ip'))
  if (mainIp) items.push(rawItem('server.family', mainIp.includes(':') ? 'IPv6' : 'IPv4', 'trace · ip'))
  items.push(
    rawItem(
      'server.geo',
      [g?.city, g?.region, g?.country].filter(Boolean).join(', ') || null,
      'ip-api.com（按出口 IP 估）',
      g || !mainIp ? undefined : '归属未获取（IP 已测得）'
    )
  )
  items.push(
    rawItem(
      'server.coords',
      g?.lat != null && g?.lon != null ? `${g.lat}, ${g.lon}` : null,
      'ip-api.com · lat / lon（按 IP 估，城市级）'
    )
  )
  items.push(
    rawItem(
      'server.asn',
      [g?.asn, g?.asname || g?.org || g?.isp].filter(Boolean).join(' · ') || null,
      'ip-api.com · as / asname'
    )
  )
  const netFlags = g
    ? [
        g.hosting ? (lang === 'zh' ? '机房 IP' : 'Hosting') : lang === 'zh' ? '非机房' : 'Not hosting',
        g.proxy ? (lang === 'zh' ? '被标记为代理' : 'Proxy flagged') : lang === 'zh' ? '未标代理' : 'Not proxy',
        g.mobile ? (lang === 'zh' ? '移动网络' : 'Mobile') : null
      ]
        .filter(Boolean)
        .join(' · ')
    : null
  items.push(rawItem('server.netType', netFlags, 'ip-api.com · hosting / proxy / mobile'))
  items.push(rawItem('server.reverseDns', g?.reverse || null, 'ip-api.com · reverse'))
  items.push(rawItem('server.ipTimezone', g?.timezone || null, 'ip-api.com · timezone'))
  items.push(
    rawItem(
      'server.colo',
      cfFields['colo'] ? `${cfFields['colo']}${facts.latencyMs != null ? ` · ${facts.latencyMs} ms` : ''}` : null,
      'trace · colo（边缘节点代码，不是你的城市）'
    )
  )
  items.push(rawItem('server.http', cfFields['http'] ?? null, 'trace · http'))
  items.push(
    rawItem(
      'server.tls',
      [cfFields['tls'], tls.protocol].filter(Boolean).join(' / ') || null,
      'trace · tls + Node TLSSocket.getProtocol'
    )
  )
  items.push(rawItem('server.kex', cfFields['kex'] ?? null, 'trace · kex'))
  items.push(
    rawItem(
      'server.cipher',
      [tls.cipher, tls.alpn].filter(Boolean).join(' · ') || null,
      'Node https · getCipher / alpnProtocol'
    )
  )
  items.push(
    rawItem(
      'server.sni',
      cfFields['sni'] ? `SNI ${cfFields['sni']}` : null,
      'trace · sni（trace 不提供 ECH 状态，只记录 SNI 是否发送）'
    )
  )
  items.push(
    rawItem(
      'server.warp',
      cfFields['warp'] ? `WARP ${cfFields['warp']} · Gateway ${cfFields['gateway'] ?? '—'}` : null,
      'trace · warp / gateway'
    )
  )
  items.push(
    rawItem(
      'server.ipv6',
      facts.ipv6 ?? null,
      'Node https family=6（不经应用层代理）',
      facts.ipv6 ? undefined : '未取得 IPv6 出口：无 IPv6 连接或被网络策略阻止（中性，不代表异常）'
    )
  )
  items.push(
    rawItem(
      'server.egress',
      ips.length ? `${ips.length} 个出口 · ${ips.join(' / ')}` : null,
      '4 个站点各自回显（多出口是正常分流，不是异常）'
    )
  )
  items.push(rawItem('server.dnsServer', facts.dnsServers.join(', ') || null, 'dns.getServers()（系统配置）'))
  items.push(
    rawItem('server.dnsResolver', dnsSystem.exitIp ?? null, 'Akamai whoami TXT · ns 段（经系统解析器查询）', dnsSystem.error)
  )
  const dnsGeo = dnsSystem.exitIp ? await lookupGeoDetail(dnsSystem.exitIp, lang).catch(() => null) : null
  items.push(
    rawItem(
      'server.dnsResolverGeo',
      dnsGeo ? [dnsGeo.country, dnsGeo.isp].filter(Boolean).join(' · ') : null,
      'ip-api.com（按 DNS 递归出口 IP 查）'
    )
  )
  items.push(
    rawItem(
      'server.rtt',
      facts.latencyMs != null ? `${facts.latencyMs} ms` : null,
      'cdn-cgi/trace 请求耗时（3 个站点取最小值）'
    )
  )
  items.push(
    rawItem(
      'server.clockSkew',
      facts.clockSkewMs != null ? `${(facts.clockSkewMs / 1000).toFixed(1)} s` : null,
      'trace · ts 与本机 Date.now()（秒级精度）'
    )
  )
  items.push(
    rawItem(
      'server.tor',
      facts.torExit == null
        ? null
        : facts.torExit
          ? lang === 'zh'
            ? '命中 Tor 出口列表'
            : 'In Tor exit list'
          : lang === 'zh'
            ? '不在 Tor 出口列表'
            : 'Not a Tor exit',
      'check.torproject.org/tor-exit-list.txt'
    )
  )

  const reachable = facts.egress.filter((e) => e.status === 'ok').length
  return {
    ok: reachable > 0,
    collectedAt,
    items,
    facts,
    error: reachable > 0 ? undefined : '没有取到任何出口信息：请检查网络或代理设置'
  }
}
