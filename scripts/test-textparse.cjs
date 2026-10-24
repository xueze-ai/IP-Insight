// 单元测试：出口诊断文本解析（脱敏真实响应样例；不依赖外站在线、不依赖 electron）
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
const { extractExitIp, parseTrace, parseTxtReply } = require(outJs)

let pass = 0
let fail = 0
function check(desc, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass++
  else {
    fail++
    console.log(`FAIL  ${desc}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`)
  }
}

/* ---------- extractExitIp（样例取自 2026-10 真实响应，已脱敏） ---------- */
// AliDNS 向 Google 权威查询：纯出口
check('AliDNS @ google', extractExitIp('\r192.0.2.32'), { ip: '192.0.2.32' })
// Akamai 诊断区：ns 前缀 + 出口
check('AliDNS @ akamai (ns)', extractExitIp('\u0002ns\r192.0.2.32'), { ip: '192.0.2.32' })
// Akamai 诊断区：ip 前缀 + 出口
check('Google @ akamai (ip)', extractExitIp('\u0002ip\f198.51.100.84\f'), { ip: '198.51.100.84' })
// DNSPod @ akamai：ECS 网段在前、出口被二进制截断 → 不给 ip（诚实缺失）
check('DNSPod @ akamai (ECS + truncated)', extractExitIp('"edns0-client-subnet 198.51.100.0/24·f····203.0.113.25'), {
  ip: undefined,
  ecs: '198.51.100.0/24'
})
// Google @ google：出口在前、ECS 在后
check('Google @ google (exit before ECS)', extractExitIp('192.0.2.152·f···edns0-client-subnet 198.51.100.'), {
  ip: '192.0.2.152',
  ecs: '198.51.100.'
})
// 被截断的 IPv6 片段（4 组，无 ::）→ 不给 ip
check('truncated IPv6 fragment', extractExitIp('2001:db8:8765:4321'), { ip: undefined })
// 完整 IPv6（含 ::）
check('full IPv6 with ::', extractExitIp('2001:db8:8765:4321::1'), { ip: '2001:db8:8765:4321::1' })
// 114DNS 出口
check('114DNS @ google', extractExitIp('\r192.0.2.136'), { ip: '192.0.2.136' })
// 无地址
check('no address', extractExitIp('no-ip-here'), { ip: undefined })
// 前导冒号的截断片段（2026-10 真实样例：akamai 诊断区二进制截断）
check('leading-colon truncation', extractExitIp('·:2001:0db8:1:2:3:4:5'), { ip: undefined })

/* ---------- parseTrace ---------- */
check(
  'trace parse',
  parseTrace('fl=1a2b\nip=203.0.113.7\ncolo=SIN\nloc=SG\nhttp=http/1.1\n'),
  { fl: '1a2b', ip: '203.0.113.7', colo: 'SIN', loc: 'SG', http: 'http/1.1' }
)

/* ---------- parseTxtReply：真实 DNS 报文 ---------- */
// 构造一个标准应答：根问名 + 1 个 TXT 应答
function mkTxtReply(txt) {
  const hdr = Buffer.alloc(12)
  hdr.writeUInt16BE(0x1234, 0)
  hdr.writeUInt16BE(0x8180, 2)
  hdr.writeUInt16BE(1, 4) // qd
  hdr.writeUInt16BE(1, 6) // an
  const qname = Buffer.from([0]) // 根
  const qtype = Buffer.from([0, 16]) // TXT
  const qcls = Buffer.from([0, 1]) // IN
  const rrName = Buffer.from([0])
  const type = Buffer.from([0, 16])
  const cls = Buffer.from([0, 1])
  const ttl = Buffer.from([0, 0, 0, 30])
  const rd = Buffer.from([txt.length, ...Buffer.from(txt, 'latin1')])
  const rdlen = Buffer.from([0, rd.length])
  return Buffer.concat([hdr, qname, qtype, qcls, rrName, type, cls, ttl, rdlen, rd])
}
const r1 = parseTxtReply(mkTxtReply('192.0.2.136'))
check('parseTxtReply plain', { txt: r1.txt }, { txt: '192.0.2.136' })
// NXDOMAIN
const nx = Buffer.alloc(12)
nx.writeUInt16BE(3, 2) // flags rcode=3
check('parseTxtReply NXDOMAIN', parseTxtReply(nx), { rcode: 3, error: 'NXDOMAIN' })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
