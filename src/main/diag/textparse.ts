// =============================================================
// 出口诊断 - 纯文本解析（无 Electron / 网络依赖，可独立单测）
// 所有模式均来自 2026-10 脱敏后的真实响应样例。
// =============================================================

/** 解析 Cloudflare /cdn-cgi/trace 文本（ip= colo= loc= …） */
export function parseTrace(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of body.split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

/** 跳过 DNS 报文中的域名字段（支持压缩指针），返回字段结束后的偏移 */
function skipDnsName(msg: Buffer, off: number): number {
  for (;;) {
    if (off >= msg.length) return off
    const b = msg[off]
    if (b === 0) return off + 1
    // 压缩指针（0b11xxxxxx）：固定 2 字节
    if ((b & 0xc0) === 0xc0) return off + 2
    off += b + 1
  }
}

/** 解析 DNS 应答报文中的第一个 TXT 记录（含 rcode 检查与压缩指针支持） */
export function parseTxtReply(
  msg: Buffer
): { txt?: string; rcode?: number; error?: string } {
  if (msg.length < 12) return { error: '应答过短' }
  const rcode = msg[3] & 0xf
  const qd = msg.readUInt16BE(4)
  const an = msg.readUInt16BE(6)
  if (an < 1) {
    return { rcode, error: rcode === 3 ? 'NXDOMAIN' : `无应答记录(rcode=${rcode})` }
  }
  let off = 12
  for (let i = 0; i < qd; i++) {
    off = skipDnsName(msg, off)
    off += 4 // qtype + qclass
  }
  // 遍历应答记录，找第一条 TXT
  for (let i = 0; i < an && off + 10 <= msg.length; i++) {
    off = skipDnsName(msg, off)
    if (off + 10 > msg.length) break
    const type = msg.readUInt16BE(off)
    const rdlen = msg.readUInt16BE(off + 8)
    const rd = msg.slice(off + 10, off + 10 + rdlen)
    if (type === 16) {
      let txt = ''
      let p = 0
      while (p < rd.length) {
        const l = rd[p]
        txt += rd.slice(p + 1, p + 1 + l).toString('latin1')
        p += 1 + l
      }
      // 只保留可打印 ASCII（诊断 TXT 可能含 EDNS 二进制段，无法恢复的字节以 · 占位）
      return { txt: txt.replace(/[^\x20-\x7e]/g, '·'), rcode }
    }
    off += 10 + rdlen
  }
  return { rcode, error: '应答中无 TXT 记录' }
}

/** 从诊断 TXT 内容提取解析器出口 IP（排除 EDNS Client Subnet 网段与被截断的片段） */
export function extractExitIp(txt: string): { ip?: string; ecs?: string } {
  const v4s = txt.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? []
  // IPv6：先取 hex/冒号串，再校验组数——避免把被二进制截断的片段误认为完整地址
  const rawV6 = txt.match(/\b[0-9a-fA-F:]{2,45}\b/g) ?? []
  const v6s = rawV6.filter((s) => {
    if (!s.includes(':')) return false
    // 以冒号开头/结尾且不含 :: 的串是被截断的片段
    if ((s[0] === ':' || s[s.length - 1] === ':') && !s.includes('::')) return false
    const groups = s.split(':').filter((g) => g.length > 0)
    if (s.includes('::')) return groups.length >= 1 && groups.length <= 7
    return groups.length === 8 // 无 :: 的完整地址恰为 8 组（截断片段通常 4-7 组）
  })
  const ecsMatch = txt.match(/edns0-client-subnet\s+([0-9a-fA-F.:/]+)/i)
  const ecs = ecsMatch ? ecsMatch[1] : undefined
  // ECS 标记之后出现的地址优先排除（多为网段或被截断的尾段）
  const ecsIdx = ecsMatch ? (ecsMatch.index ?? 0) : -1
  const beforeEcs = (s: string): boolean => ecsIdx < 0 || txt.indexOf(s) < ecsIdx
  const candidates = [...v4s, ...v6s].filter((c) => {
    if (!beforeEcs(c)) return false
    // ECS 网络地址本身（如 198.51.100.0/24）不是出口
    if (ecs && (c === ecs || c === ecs.split('/')[0])) return false
    return true
  })
  // 取最后一个候选：诊断记录通常以「出口 IP」结尾
  return { ip: candidates[candidates.length - 1], ecs }
}
