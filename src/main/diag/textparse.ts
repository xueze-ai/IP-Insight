// =============================================================
// 出口诊断 - 纯文本 / 报文解析（无 Electron / 网络依赖，可独立单测）
// 所有模式均来自真实响应样例（脱敏）。
//
// 字段语义依据：
// - Google o-o.myaddr.l.google.com：裸 IP TXT = 递归解析器出口；
//   "edns0-client-subnet <网段>" = 客户端网段（ECS）。
//   多条裸 IP 中落在 ECS 网段内的是客户端代表地址，网段外的是解析器出口；
//   无法区分时标记 ambiguous（不输出猜测）。
// - Akamai whoami.ds.akahelp.net（官方博客
//   "Introducing the New Whoami Tool for DNS Resolver Information"）：
//   ns <ip> = 递归解析器出口；ip <ip> = ECS 网段中的代表地址（不是解析器出口）；
//   ecs <网段> = 客户端网段。
// =============================================================

import { isIP } from 'net'

/** 解析 Cloudflare /cdn-cgi/trace 文本（ip= colo= loc= …） */
export function parseTrace(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of body.split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

// ---------------- DNS 报文解析 ----------------

/** 跳过 DNS 报文中的域名字段（支持压缩指针），返回字段结束后的偏移 */
function skipDnsName(msg: Buffer, off: number): number {
  for (;;) {
    if (off >= msg.length) return off
    const b = msg[off]
    if (b === 0) return off + 1
    if ((b & 0xc0) === 0xc0) return off + 2
    off += b + 1
  }
}

export interface DnsReplyParse {
  txtRecords?: string[][] // 每条 TXT 记录 = 其字符段（character-string）数组
  rcode?: number
  idMatch?: boolean
  error?: string
}

/** 解析 DNS 应答：校验长度 / 事务 ID / rcode；提取全部 TXT 记录（保留字符段边界） */
export function parseDnsReply(msg: Buffer, expectId: number): DnsReplyParse {
  if (msg.length < 12) return { error: '应答过短' }
  const id = msg.readUInt16BE(0)
  const idMatch = id === expectId
  const rcode = msg[3] & 0xf
  const qd = msg.readUInt16BE(4)
  const an = msg.readUInt16BE(6)
  if (!idMatch) return { idMatch: false, rcode, error: '应答事务 ID 与请求不匹配' }
  if (an < 1) {
    return { idMatch, rcode, error: rcode === 3 ? 'NXDOMAIN' : `无应答记录(rcode=${rcode})` }
  }
  let off = 12
  for (let i = 0; i < qd; i++) {
    off = skipDnsName(msg, off)
    off += 4 // qtype + qclass
  }
  const txtRecords: string[][] = []
  for (let i = 0; i < an && off + 10 <= msg.length; i++) {
    off = skipDnsName(msg, off)
    if (off + 10 > msg.length) break
    const type = msg.readUInt16BE(off)
    const rdlen = msg.readUInt16BE(off + 8)
    const rd = msg.slice(off + 10, off + 10 + rdlen)
    if (type === 16 /* TXT */) {
      const segments: string[] = []
      let p = 0
      while (p < rd.length) {
        const l = rd[p]
        segments.push(rd.slice(p + 1, p + 1 + l).toString('latin1'))
        p += 1 + l
      }
      txtRecords.push(segments)
    }
    off += 10 + rdlen
  }
  if (!txtRecords.length) return { idMatch, rcode, error: '应答中无 TXT 记录' }
  return { txtRecords, rcode, idMatch }
}

export interface WhoamiParse {
  /** 递归解析器出口 IP（仅当语义明确时） */
  resolverExit?: string
  /** 出口语义来源 */
  exitSource?: 'ns' | 'txt'
  /** EDNS Client Subnet 网段（客户端网段） */
  ecsSubnet?: string
  /** ECS 网段中的代表地址（Akamai ip 段 / Google 落在网段内的裸 IP） */
  ecsRep?: string
  /** 全部 TXT 记录（每条内字符段以空格连接；保留原始顺序与边界信息） */
  records: string[]
  /** 存在多条裸 IP 且无法区分时为 true（不输出猜测的解析器出口） */
  ambiguous?: boolean
}

/** Google o-o.myaddr.l.google.com：裸 IP TXT = 解析器出口；edns0-client-subnet = 客户端网段 */
export function parseGoogleWhoami(records: string[][]): WhoamiParse {
  const flat = records.map((segs) => segs.join(' '))
  const out: WhoamiParse = { records: flat }
  const bareIps: string[] = []
  for (const line of flat) {
    const ecs = line.match(/^edns0-client-subnet\s+([0-9a-fA-F.:/]+)/i)
    if (ecs) {
      out.ecsSubnet = ecs[1]
      continue
    }
    const t = line.trim()
    if (t && isIP(t) !== 0) bareIps.push(t)
  }
  if (out.ecsSubnet) {
    // ECS 网段内的裸 IP 是客户端代表地址；网段外的是解析器出口
    const net = out.ecsSubnet.split('/')[0]
    const prefixLen = Number(out.ecsSubnet.split('/')[1] ?? '32')
    const inSubnet = (ip: string): boolean => sameSubnet(ip, net, prefixLen)
    const reps = bareIps.filter(inSubnet)
    const exits = bareIps.filter((ip) => !inSubnet(ip))
    if (reps.length) out.ecsRep = reps[0]
    if (exits.length === 1) {
      out.resolverExit = exits[0]
      out.exitSource = 'txt'
    } else if (exits.length > 1) {
      out.ambiguous = true
    }
  } else if (bareIps.length === 1) {
    out.resolverExit = bareIps[0]
    out.exitSource = 'txt'
  } else if (bareIps.length > 1) {
    out.ambiguous = true
  }
  return out
}

function sameSubnet(ip: string, net: string, prefixLen: number): boolean {
  if (net.includes(':') || ip.includes(':')) {
    const a = expandV6(ip)
    const b = expandV6(net)
    if (!a || !b) return false
    const bits = Math.min(Math.max(prefixLen || 0, 0), 128)
    const fullNibbles = Math.floor(bits / 4)
    const rest = bits % 4
    if (a.slice(0, fullNibbles) !== b.slice(0, fullNibbles)) return false
    if (rest > 0 && fullNibbles < 32) {
      const mask = (0xf << (4 - rest)) & 0xf
      if ((parseInt(a[fullNibbles] ?? '0', 16) & mask) !== (parseInt(b[fullNibbles] ?? '0', 16) & mask)) {
        return false
      }
    }
    return true
  }
  const pl = Math.min(Math.max(prefixLen || 0, 0), 32)
  const toInt = (s: string): number =>
    s.split('.').reduce((acc, o) => (((acc << 8) + (Number(o) || 0)) >>> 0), 0)
  const mask = pl === 0 ? 0 : ((0xffffffff << (32 - pl)) >>> 0)
  return ((toInt(ip) & mask) >>> 0) === ((toInt(net) & mask) >>> 0)
}

function expandV6(ip: string): string | null {
  if (!ip.includes(':')) return null
  const [head, tail = ''] = ip.split('::')
  const h = head ? head.split(':').filter(Boolean) : []
  const t = tail ? tail.split(':').filter(Boolean) : []
  const missing = 8 - h.length - t.length
  if (missing < 0) return null
  const parts = [...h, ...Array(missing).fill('0'), ...t]
  return parts.map((p) => p.padStart(4, '0').toLowerCase()).join('')
}

/** Akamai whoami.ds.akahelp.net：ns=解析器出口；ip=ECS 代表地址；ecs=客户端网段 */
export function parseAkamaiWhoami(records: string[][]): WhoamiParse {
  const flat = records.map((segs) => segs.join(' '))
  const out: WhoamiParse = { records: flat }
  for (const line of flat) {
    const parts = line.split(/\s+/).filter(Boolean)
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i].toLowerCase()
      const val = parts[i + 1]
      if (key === 'ns' && isIP(val) !== 0) {
        out.resolverExit = val
        out.exitSource = 'ns'
      } else if (key === 'ip' && isIP(val) !== 0) {
        out.ecsRep = val
      } else if (key === 'ecs') {
        out.ecsSubnet = val
      }
    }
    // 无键的裸 IP 段：语义不确定，不计作解析器出口
  }
  return out
}

// ---------------- CDN 响应头信号提取 ----------------

export interface CdnSignals {
  /** 节点原始完整标识（保留原文，不裁剪） */
  node?: string
  /** 缓存信号段落（按响应中出现顺序；多段不合并） */
  cacheSignals: string[]
}

/**
 * 从响应头提取 CDN PoP / 缓存信号。
 * - 节点信号：完整保留原始值（如 X-Amz-Cf-Pop: HKG61-P1）。
 * - 缓存信号：收集所有携带缓存语义的头（可多次出现，按出现顺序保留全部段落）。
 */
export function extractCdnSignals(
  headers: Record<string, string | string[]>,
  signal: string
): CdnSignals {
  const node = pickNode(headers, signal)
  const cacheSignals: string[] = []
  const pushAll = (key: string): void => {
    const v = headers[key.toLowerCase()]
    if (!v) return
    for (const one of Array.isArray(v) ? v : [v]) {
      for (const seg of String(one).split(',')) {
        const s = seg.trim()
        if (s) cacheSignals.push(s)
      }
    }
  }
  pushAll('x-cache')
  pushAll('x-77-cache')
  pushAll('x-cf2')
  pushAll('x-cache-hits')
  return { node, cacheSignals }
}

function pickNode(headers: Record<string, string | string[]>, signal: string): string | undefined {
  const first = (k: string): string | undefined => {
    const v = headers[k.toLowerCase()]
    if (v == null) return undefined
    const one = Array.isArray(v) ? v[0] : v
    const s = String(one).trim()
    return s || undefined
  }
  switch (signal) {
    case 'x-served-by':
      return first('x-served-by')
    case 'x-amz-cf-pop':
      return first('x-amz-cf-pop')
    case 'x-77-pop':
      return first('x-77-pop')
    case 'server-bunny':
      return first('server')
    case 'x-cf1':
      return first('x-cf1')
    case 'x-cdn-pop':
      return first('x-cdn-pop')
    default:
      return undefined
  }
}

// ---------------- 分流目标响应解析 ----------------

export interface SplitEchoParse {
  ip?: string
  error?: string
  /** 目标自身同时提供的归属信息（记录为该目标的口径，不冒充独立归属查询） */
  inlineGeo?: { country?: string; region?: string; city?: string; isp?: string }
}

/** Cloudflare trace 文本 */
export function parseTraceEcho(body: string): SplitEchoParse {
  const t = parseTrace(body)
  if (!t.ip) return { error: '响应中无 ip 字段' }
  return { ip: t.ip }
}

/** Bilibili zone API（官方播放器自用公开接口，回显观察到的出口与归属） */
export function parseBiliZone(body: string): SplitEchoParse {
  try {
    const j = JSON.parse(body) as {
      code?: number
      data?: { addr?: string; country?: string; province?: string; city?: string; isp?: string }
    }
    if (j.code !== 0 || !j.data?.addr) return { error: `接口返回 code=${j.code ?? '?'}` }
    return {
      ip: j.data.addr,
      inlineGeo: {
        country: j.data.country,
        region: j.data.province,
        city: j.data.city,
        isp: j.data.isp
      }
    }
  } catch {
    return { error: 'JSON 解析失败' }
  }
}

/** IPIP.net myip.ipip.net 文本：「当前 IP：x.x.x.x  来自于：中国 <省> <市> <ISP 域名>」（样例已脱敏） */
export function parseIpipText(body: string): SplitEchoParse {
  const m = body.match(/当前\s*IP[：:]\s*([0-9a-fA-F.:]+)/)
  if (!m) return { error: '响应中未找到 IP 字段' }
  const geo: NonNullable<SplitEchoParse['inlineGeo']> = {}
  const loc = body.match(/来自于[：:]\s*(.+)/)
  if (loc) {
    const parts = loc[1].trim().split(/\s+/)
    geo.country = parts[0]
    if (parts[1]) geo.region = parts[1]
    if (parts[2]) geo.city = parts[2]
    const last = parts[parts.length - 1]
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(last)) geo.isp = last
  }
  return { ip: m[1], inlineGeo: geo.country ? geo : undefined }
}

/** 纯文本 IP 回显（ipinfo.io/ip、api.ip.sb/ip） */
export function parsePlainIp(body: string): SplitEchoParse {
  const t = body.trim()
  const first = t.split(/\s+/)[0] ?? ''
  if (isIP(first) !== 0) return { ip: first }
  return { error: '响应不是纯 IP 文本' }
}
