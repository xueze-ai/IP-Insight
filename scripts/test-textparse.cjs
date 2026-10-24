// 单元测试：出口诊断文本解析（脱敏真实响应样例；不依赖外站在线、不依赖 electron）
// 覆盖：DNS 报文（ID 校验 / 全 TXT / 字符段）、Google & Akamai whoami 字段语义
//      （ns=解析器出口、ip=ECS 代表、ecs=客户端网段、仅 ECS、歧义多 IP）、
//      CDN 信号（原始节点 / 多段缓存顺序）、分流回显（trace / bilibili / ipip / 纯文本）。
// 运行：node scripts/test-textparse.cjs
const { execSync } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ipi-textparse-'))
const outJs = path.join(tmp, 'textparse.cjs')
execSync(`npx esbuild src/main/diag/textparse.ts --bundle --platform=node --outfile=${outJs}`, {
  stdio: 'pipe'
})
const {
  parseTrace,
  parseDnsReply,
  parseGoogleWhoami,
  parseAkamaiWhoami,
  extractCdnSignals,
  parseTraceEcho,
  parseBiliZone,
  parseIpipText,
  parsePlainIp
} = require(outJs)

let pass = 0
let fail = 0
function check(desc, got, want) {
  const g = JSON.stringify(got, Object.keys(got ?? {}).sort())
  const w = JSON.stringify(want, Object.keys(want ?? {}).sort())
  const ok = g === w
  if (ok) pass++
  else {
    fail++
    console.log(`FAIL  ${desc}\n      got  ${g}\n      want ${w}`)
  }
}

/* ---------------- Google o-o.myaddr.l.google.com ---------------- */
// 单条裸 IP（无 ECS）：解析器出口
check(
  'google: bare ip only',
  pick(parseGoogleWhoami([['192.0.2.32']]), ['resolverExit', 'exitSource', 'ecsSubnet']),
  { resolverExit: '192.0.2.32', exitSource: 'txt' }
)
// 两条记录：出口 + ECS 网段（网段内地址为客户端代表）
check(
  'google: exit + ecs subnet',
  pick(parseGoogleWhoami([['192.0.2.32'], ['edns0-client-subnet 198.51.100.0/24']]), ['resolverExit', 'ecsSubnet', 'ecsRep']),
  { resolverExit: '192.0.2.32', ecsSubnet: '198.51.100.0/24', ecsRep: undefined }
)
// 出口 + ECS + 网段内客户端代表地址（三条）
check(
  'google: exit + ecs + client rep in subnet',
  pick(parseGoogleWhoami([['192.0.2.32'], ['198.51.100.55'], ['edns0-client-subnet 198.51.100.0/24']]), ['resolverExit', 'ecsSubnet', 'ecsRep']),
  { resolverExit: '192.0.2.32', ecsSubnet: '198.51.100.0/24', ecsRep: '198.51.100.55' }
)
// 仅 ECS：不输出解析器出口
check(
  'google: ecs only → no exit',
  pick(parseGoogleWhoami([['edns0-client-subnet 198.51.100.0/24']]), ['resolverExit', 'ecsSubnet']),
  { resolverExit: undefined, ecsSubnet: '198.51.100.0/24' }
)
// 多条裸 IP 无 ECS：歧义，不猜
check(
  'google: ambiguous bare ips',
  pick(parseGoogleWhoami([['192.0.2.32'], ['198.51.100.55']]), ['resolverExit', 'ambiguous']),
  { resolverExit: undefined, ambiguous: true }
)

/* ---------------- Akamai whoami.ds.akahelp.net ---------------- */
// ns = 解析器出口
check(
  'akamai: ns → resolver exit',
  pick(parseAkamaiWhoami([['ns', '192.0.2.32']]), ['resolverExit', 'exitSource']),
  { resolverExit: '192.0.2.32', exitSource: 'ns' }
)
// ns + ip + ecs：ip 是 ECS 代表地址，不是解析器出口
check(
  'akamai: ns + ip + ecs semantics',
  pick(parseAkamaiWhoami([['ns', '192.0.2.32', 'ecs', '198.51.100.0/24', 'ip', '198.51.100.55']]), ['resolverExit', 'ecsSubnet', 'ecsRep']),
  { resolverExit: '192.0.2.32', ecsSubnet: '198.51.100.0/24', ecsRep: '198.51.100.55' }
)
// 仅 ip（无 ns）：不计作解析器出口
check(
  'akamai: ip only → not an exit',
  pick(parseAkamaiWhoami([['ip', '198.51.100.55']]), ['resolverExit', 'ecsRep']),
  { resolverExit: undefined, ecsRep: '198.51.100.55' }
)
// 多条 TXT 记录（字符段以空格连接后逐段解析）
check(
  'akamai: multiple records',
  pick(parseAkamaiWhoami([['ns', '192.0.2.32'], ['ecs', '198.51.100.0/24']]), ['resolverExit', 'ecsSubnet']),
  { resolverExit: '192.0.2.32', ecsSubnet: '198.51.100.0/24' }
)

function pick(obj, keys) {
  const out = {}
  for (const k of keys) out[k] = obj?.[k]
  return out
}

/* ---------------- DNS 报文解析 ---------------- */
function mkTxtReply(txts, opts = {}) {
  const hdr = Buffer.alloc(12)
  hdr.writeUInt16BE(opts.id ?? 0x1234, 0)
  hdr.writeUInt16BE(0x8180, 2)
  hdr.writeUInt16BE(1, 4) // qd
  hdr.writeUInt16BE(txts.length, 6) // an
  const qname = Buffer.from([0])
  const qtype = Buffer.from([0, 16])
  const qcls = Buffer.from([0, 1])
  const parts = [hdr, qname, qtype, qcls]
  for (const t of txts) {
    const rd = Buffer.from([t.length, ...Buffer.from(t, 'latin1')])
    parts.push(Buffer.from([0]), Buffer.from([0, 16]), Buffer.from([0, 1]), Buffer.from([0, 0, 0, 30]), Buffer.from([0, rd.length]), rd)
  }
  return Buffer.concat(parts)
}
// 全部 TXT 记录 + 字符段边界保留
check(
  'dns: two txt records kept',
  pick(parseDnsReply(mkTxtReply(['192.0.2.32', 'edns0-client-subnet 198.51.100.0/24']), 0x1234), ['idMatch', 'rcode', 'error']),
  { idMatch: true, rcode: 0, error: undefined }
)
const two = parseDnsReply(mkTxtReply(['192.0.2.32', 'edns0-client-subnet 198.51.100.0/24']), 0x1234)
check('dns: txtRecords content', two.txtRecords, [['192.0.2.32'], ['edns0-client-subnet 198.51.100.0/24']])
// 事务 ID 不匹配
check('dns: id mismatch', pick(parseDnsReply(mkTxtReply(['x']), 0xbeef), ['idMatch', 'error']), { idMatch: false, error: '应答事务 ID 与请求不匹配' })
// NXDOMAIN
const nx = Buffer.alloc(12)
nx.writeUInt16BE(1, 0)
nx.writeUInt16BE(0x8003, 2)
check('dns: nxdomain', pick(parseDnsReply(nx, 1), ['rcode', 'error']), { rcode: 3, error: 'NXDOMAIN' })

/* ---------------- Cloudflare trace ---------------- */
check('trace parse', parseTrace('fl=1a2b\nip=203.0.113.7\ncolo=SIN\nloc=SG\nhttp=http/1.1\n'), {
  fl: '1a2b', ip: '203.0.113.7', colo: 'SIN', loc: 'SG', http: 'http/1.1'
})
check('trace echo', parseTraceEcho('ip=203.0.113.7\ncolo=SIN'), { ip: '203.0.113.7' })
check('trace echo missing', parseTraceEcho('fl=1'), { error: '响应中无 ip 字段' })

/* ---------------- CDN 信号 ---------------- */
// CloudFront：原始节点完整保留（HKG61-P1 不裁剪）；多段缓存顺序保留
check(
  'cdn: cloudfront pop + multi-segment cache',
  extractCdnSignals({ 'x-amz-cf-pop': 'HKG61-P1', 'x-cache': 'Miss from cloudfront, Hit from cloudfront' }, 'x-amz-cf-pop'),
  { node: 'HKG61-P1', cacheSignals: ['Miss from cloudfront', 'Hit from cloudfront'] }
)
// Fastly：X-Served-By 完整保留
check(
  'cdn: fastly served-by raw',
  extractCdnSignals({ 'x-served-by': 'cache-sin-wsss1830044-SIN', 'x-cache': 'HIT' }, 'x-served-by'),
  { node: 'cache-sin-wsss1830044-SIN', cacheSignals: ['HIT'] }
)
// 无信号头：无节点、无缓存（不编造）
check('cdn: none', extractCdnSignals({}, 'none'), { node: undefined, cacheSignals: [] })

/* ---------------- 分流回显 ---------------- */
check(
  'bili zone',
  parseBiliZone('{"code":0,"message":"OK","data":{"addr":"203.0.113.7","country":"中国","province":"示例省","city":"示例市","isp":"移动"}}'),
  { ip: '203.0.113.7', inlineGeo: { country: '中国', region: '示例省', city: '示例市', isp: '移动' } }
)
check('bili zone error', parseBiliZone('{"code":-1}'), { error: '接口返回 code=-1' })
check(
  'ipip text',
  parseIpipText('当前 IP：203.0.113.7  来自于：中国 示例省 示例市  example-isp.test'),
  { ip: '203.0.113.7', inlineGeo: { country: '中国', region: '示例省', city: '示例市', isp: 'example-isp.test' } }
)
check('ipip text missing', parseIpipText('hello'), { error: '响应中未找到 IP 字段' })
check('plain ip', parsePlainIp('203.0.113.7\n'), { ip: '203.0.113.7' })
check('plain ip invalid', parsePlainIp('not an ip'), { error: '响应不是纯 IP 文本' })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
