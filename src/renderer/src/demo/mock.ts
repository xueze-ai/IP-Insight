import type {
  AiAnalyzeRequest,
  AiAskRequest,
  AppSettings,
  HistoryRecord,
  NormalizedIPResult,
  ReachProbeResult,
  ServiceStatusFeed,
  UpdateStatus
} from '@shared/types'
import type { DiagEvent, DiagEvidence, DiagGeo, DiagProbe, DiagRun, DiagRunSummary } from '@shared/diag'

// =============================================================
// Demo 模式（浏览器预览用）
// 当页面运行在普通浏览器中（无 Electron preload 注入 window.ipInsight）时自动启用，
// 使用 RFC 5737 文档保留地址（203.0.113.x / 198.51.100.x）与示例 ASN（AS64512）
// 构造样例数据，仅用于界面预览 / 开源仓库效果截图，不参与任何真实检测。
// =============================================================

const MAIN_IP = '203.0.113.7'
const GPT_IP = '198.51.100.23'

const nowIso = (): string => new Date().toISOString()
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function base(provider: { id: string; name: string; url: string }): NormalizedIPResult {
  return {
    provider: { id: provider.id as NormalizedIPResult['provider']['id'], name: provider.name, sourceUrl: provider.url },
    fetchedAt: nowIso(),
    ok: true
  }
}

const PING0: NormalizedIPResult = {
  ...base({ id: 'ping0', name: 'Ping0', url: 'https://ping0.cc/' }),
  ip: MAIN_IP,
  ipv4: MAIN_IP,
  isp: 'Example Broadband Pte Ltd',
  asn: 'AS64512',
  organization: 'EXAMPLE-AS-DOC (documentation range)',
  country: 'Singapore',
  region: 'Central Singapore',
  city: 'Singapore',
  location: { lat: 1.2897, lon: 103.8501 },
  flags: { residential: false, datacenter: true, hosting: true, vpn: false, proxy: true, tor: false, crawler: false },
  riskScore: 68,
  riskLabel: '风险 68/100（风控值 · 越高越危险）· 偏高',
  nativeLabel: '广播 IP',
  sharedUsers: '10 - 100（一般）',
  scenarios: [
    { name: 'TikTok', stars: 2, recommended: false, raw: '2 星' },
    { name: '跨境电商', stars: 3, recommended: null, raw: '3 星' },
    { name: 'AI 服务', stars: 4, recommended: true, raw: '4 星' }
  ]
}

const NETCOFFEE: NormalizedIPResult = {
  ...base({ id: 'netcoffee', name: 'Net.Coffee', url: 'https://ip.net.coffee/' }),
  ip: MAIN_IP,
  ipv4: MAIN_IP,
  isp: 'Example Cloud Network',
  asn: 'AS64512',
  organization: 'EXAMPLE-AS-DOC',
  country: 'Singapore',
  region: 'Central Singapore',
  city: 'Singapore',
  location: { lat: 1.2905, lon: 103.851 },
  timezone: 'Asia/Singapore',
  flags: { residential: false, datacenter: true, hosting: true, vpn: false, proxy: false, tor: false, crawler: false, mobile: false, abuser: false },
  riskScore: 58,
  riskLabel: '信任分 58/100（越高越安全）· 一般',
  blacklistSummary: { listed: 2, checked: 12 },
  blacklist: [
    { engine: 'Spamhaus ZEN', zone: 'zen.spamhaus.org', category: 'Spam', listed: true, codes: ['127.0.0.3'], ms: 120, status: 'ok' },
    { engine: 'SpamCop BL', zone: 'bl.spamcop.net', category: 'Spam', listed: false, codes: [], ms: 90, status: 'nxdomain' },
    { engine: 'Barracuda BRBL', zone: 'b.barracudacentral.org', category: 'Reputation', listed: false, codes: [], ms: 110, status: 'nxdomain' },
    { engine: 'DroneBL', zone: 'dnsbl.dronebl.org', category: 'Botnet', listed: false, codes: [], ms: 130, status: 'nxdomain' },
    { engine: 'Surriel PSBL', zone: 'psbl.surriel.com', category: 'Spam', listed: false, codes: [], ms: 100, status: 'nxdomain' },
    { engine: 'Blocklist.de', zone: 'bl.blocklist.de', category: 'Botnet', listed: false, codes: [], ms: 105, status: 'nxdomain' },
    { engine: 'WPBL', zone: 'db.wpbl.info', category: 'Malware', listed: false, codes: [], ms: 95, status: 'nxdomain' },
    { engine: 'GBUdb Truncate', zone: 'truncate.gbudb.net', category: 'Reputation', listed: true, codes: ['127.0.0.2'], ms: 140, status: 'ok' },
    { engine: 'Tornevall', zone: 'opm.tornevall.org', category: 'Proxy/Tor', listed: false, codes: [], ms: 115, status: 'nxdomain' },
    { engine: 'JunkEmailFilter', zone: 'hostkarma.junkemailfilter.com', category: 'Reputation', listed: false, codes: [], ms: 100, status: 'nxdomain' },
    { engine: 'S5h All', zone: 'all.s5h.net', category: 'Spam', listed: false, codes: [], ms: 108, status: 'nxdomain' },
    { engine: 'Manitu ixHash', zone: 'ix.manitu.net', category: 'Spam', listed: false, codes: [], ms: 99, status: 'nxdomain' }
  ],
  globalPing: [
    { node: 'n01', latencyMs: 288, minMs: 286, avgMs: 288, maxMs: 291, reachable: true, name: '中国上海', city: 'Shanghai', continent: '亚洲', cc: 'cn' },
    { node: 'n02', latencyMs: 8, minMs: 6, avgMs: 8, maxMs: 11, reachable: true, name: '中国香港', city: 'Hong Kong', continent: '亚洲', cc: 'hk' },
    { node: 'n03', latencyMs: 68, minMs: 66, avgMs: 68, maxMs: 70, reachable: true, name: '日本东京', city: 'Tokyo', continent: '亚洲', cc: 'jp' },
    { node: 'n04', latencyMs: 3, minMs: 2, avgMs: 3, maxMs: 4, reachable: true, name: '新加坡', city: 'Singapore', continent: '亚洲', cc: 'sg' },
    { node: 'n05', latencyMs: 21, minMs: 19, avgMs: 21, maxMs: 24, reachable: true, name: '越南胡志明', city: 'Ho Chi Minh City', continent: '亚洲', cc: 'vn' },
    { node: 'n06', latencyMs: 12, minMs: 10, avgMs: 12, maxMs: 14, reachable: true, name: '印尼雅加达', city: 'Jakarta', continent: '亚洲', cc: 'id' },
    { node: 'n07', latencyMs: 118, minMs: 116, avgMs: 118, maxMs: 121, reachable: true, name: '印度孟买', city: 'Mumbai', continent: '亚洲', cc: 'in' },
    { node: 'n08', latencyMs: null, minMs: null, avgMs: null, maxMs: null, reachable: false, name: '以色列特拉维夫', city: 'Tel Aviv', continent: '亚洲', cc: 'il' },
    { node: 'n09', latencyMs: 172, minMs: 170, avgMs: 172, maxMs: 175, reachable: true, name: '美国洛杉矶', city: 'Los Angeles', continent: '美洲', cc: 'us' },
    { node: 'n10', latencyMs: 208, minMs: 205, avgMs: 208, maxMs: 210, reachable: true, name: '美国亚特兰大', city: 'Atlanta', continent: '美洲', cc: 'us' },
    { node: 'n11', latencyMs: 189, minMs: 187, avgMs: 189, maxMs: 192, reachable: true, name: '加拿大温哥华', city: 'Vancouver', continent: '美洲', cc: 'ca' },
    { node: 'n12', latencyMs: 261, minMs: 259, avgMs: 261, maxMs: 264, reachable: true, name: '巴西圣保罗', city: 'Sao Paulo', continent: '美洲', cc: 'br' },
    { node: 'n13', latencyMs: 156, minMs: 154, avgMs: 156, maxMs: 158, reachable: true, name: '德国法兰克福', city: 'Frankfurt', continent: '欧洲', cc: 'de' },
    { node: 'n14', latencyMs: 149, minMs: 147, avgMs: 149, maxMs: 152, reachable: true, name: '荷兰阿姆斯特丹', city: 'Amsterdam', continent: '欧洲', cc: 'nl' },
    { node: 'n15', latencyMs: 152, minMs: 150, avgMs: 152, maxMs: 155, reachable: true, name: '法国巴黎', city: 'Paris', continent: '欧洲', cc: 'fr' },
    { node: 'n16', latencyMs: 168, minMs: 166, avgMs: 168, maxMs: 171, reachable: true, name: '瑞典斯德哥尔摩', city: 'Stockholm', continent: '欧洲', cc: 'se' },
    { node: 'n17', latencyMs: 151, minMs: 149, avgMs: 151, maxMs: 153, reachable: true, name: '瑞士苏黎世', city: 'Zurich', continent: '欧洲', cc: 'ch' },
    { node: 'n18', latencyMs: 163, minMs: 161, avgMs: 163, maxMs: 166, reachable: true, name: '西班牙马德里', city: 'Madrid', continent: '欧洲', cc: 'es' },
    { node: 'n19', latencyMs: null, minMs: null, avgMs: null, maxMs: null, reachable: false, name: '俄罗斯莫斯科', city: 'Moscow', continent: '欧洲', cc: 'ru' },
    { node: 'n20', latencyMs: 174, minMs: 172, avgMs: 174, maxMs: 177, reachable: true, name: '土耳其伊斯坦布尔', city: 'Istanbul', continent: '欧洲', cc: 'tr' }
  ]
}

const GPT: NormalizedIPResult = {
  ...base({ id: 'netcoffee_gpt', name: 'Net.Coffee GPT', url: 'https://ip.net.coffee/gpt/' }),
  ip: GPT_IP,
  ipv4: GPT_IP,
  isp: 'Example Residential KK',
  asn: 'AS64513',
  organization: 'EXAMPLE-RES-DOC',
  country: 'Japan',
  region: 'Tokyo',
  city: 'Tokyo',
  location: { lat: 35.6895, lon: 139.6917 },
  timezone: 'Asia/Tokyo',
  flags: { residential: true, datacenter: false, vpn: false, proxy: false, tor: false, crawler: false, abuser: false },
  riskScore: 96,
  riskLabel: 'ChatGPT 出口信任分 96/100（越高越安全）· 极度纯净',
  dnsLeak: { status: 'DNS 请求出口与主出口不同（Demo 样例，不判泄露）', verdict: 'unknown', exitIp: '203.0.113.99', provider: 'Example DNS', detail: 'sg' },
  webRTCLeak: { status: '未检测到泄露', verdict: 'clean' },
  fingerprint: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    browser: 'Chrome',
    browserVersion: '152.0.0.0',
    os: 'Windows',
    platform: 'Win32',
    timezone: 'Asia/Singapore',
    timezoneConsistent: false,
    language: 'zh-CN',
    languages: ['zh-CN', 'zh-Hans-CN', 'en'],
    screen: '1920x1080',
    colorDepth: 24,
    hardwareConcurrency: 16,
    deviceMemory: 8,
    canvas: 'DEMO0001',
    webgl: 'DEMO0002',
    webglRenderer: 'ANGLE (NVIDIA, Generic NVIDIA GPU Direct3D11 vs_5_0 ps_5_0, D3D11)',
    audio: '124.04347776',
    visitorId: 'DEMO00FF',
    cookiesEnabled: true,
    fonts: ['Arial', 'Calibri', 'Consolas', 'Georgia', 'Microsoft YaHei', 'Segoe UI', 'SimHei', 'SimSun', 'Tahoma', 'Verdana']
  }
}

const IPPURE: NormalizedIPResult = {
  ...base({ id: 'ippure', name: 'IPPure', url: 'https://ippure.com/' }),
  ip: MAIN_IP,
  ipv4: MAIN_IP,
  isp: 'Example Broadband Pte Ltd',
  asn: 'AS64512',
  organization: 'example.net',
  country: 'Singapore',
  region: 'Central Singapore',
  city: 'Singapore',
  location: { lat: 1.29, lon: 103.85 },
  flags: { residential: false, datacenter: true, hosting: true },
  riskScore: 61,
  riskLabel: '61% 偏高风险（IPPure 系数 · 越高越危险）',
  nativeLabel: '广播 IP'
}

const RESULTS: NormalizedIPResult[] = [PING0, NETCOFFEE, GPT, IPPURE]

const SPEED: NormalizedIPResult = {
  ...base({ id: 'local_speedtest', name: '本机测速 · Cloudflare', url: 'https://speed.cloudflare.com/' }),
  ip: MAIN_IP,
  downloadMbps: 327.4,
  uploadMbps: 89.2,
  raw: {
    phase: 'finished',
    summary: {
      download: 327400000,
      upload: 89200000,
      latency: 23.4,
      jitter: 3.1,
      downLoadedLatency: 31.2,
      downLoadedJitter: 5.4,
      upLoadedLatency: 58.9,
      upLoadedJitter: 12.7,
      totalDurationMs: 74210
    },
    scores: {
      streaming: { points: 92, classificationName: 'good' },
      gaming: { points: 71, classificationName: 'medium' },
      rtc: { points: 84, classificationName: 'good' }
    },
    trace: { ip: MAIN_IP, colo: 'SIN', loc: 'SG' }
  }
}

const FEED: ServiceStatusFeed = {
  sourceUrl: 'https://ip.net.coffee/status/',
  fetchedAt: nowIso(),
  fetchedLocalAt: nowIso(),
  count: 6,
  failing: 1,
  services: [
    { key: 'openai', name: 'OpenAI / ChatGPT', group: 'AI', indicator: 'minor', indicator_cn: '轻微故障', description: '轻微故障', ok: true, incidents: [{ name: '示例：部分 Work Mode 错误增多', status: 'investigating', impact: 'minor' }], last_check_at: nowIso() },
    { key: 'claude', name: 'Claude (Anthropic)', group: 'AI', indicator: 'none', indicator_cn: '正常运行', description: '全部正常', ok: true, incidents: [], last_check_at: nowIso() },
    { key: 'cloudflare', name: 'Cloudflare', group: '云服务', indicator: 'none', indicator_cn: '正常运行', description: '全部正常', ok: true, incidents: [], last_check_at: nowIso() },
    { key: 'github', name: 'GitHub', group: '开发', indicator: 'none', indicator_cn: '正常运行', description: '全部正常', ok: true, incidents: [], last_check_at: nowIso() },
    { key: 'vercel', name: 'Vercel', group: '云服务', indicator: 'none', indicator_cn: '正常运行', description: '全部正常', ok: true, incidents: [], last_check_at: nowIso() },
    { key: 'discord', name: 'Discord', group: '社区', indicator: 'none', indicator_cn: '正常运行', description: '全部正常', ok: true, incidents: [], last_check_at: nowIso() }
  ]
}

const REACH: ReachProbeResult[] = [
  { name: 'ChatGPT', host: 'chatgpt.com', ok: true, ms: 214 },
  { name: 'OpenAI API', host: 'api.openai.com', ok: true, ms: 236 },
  { name: 'Claude', host: 'claude.ai', ok: true, ms: 198 },
  { name: 'Google', host: 'www.google.com', ok: true, ms: 42 },
  { name: 'YouTube', host: 'www.youtube.com', ok: true, ms: 61 },
  { name: 'GitHub', host: 'github.com', ok: true, ms: 143 },
  { name: 'Cloudflare', host: 'www.cloudflare.com', ok: true, ms: 38 },
  { name: '抖音', host: 'www.douyin.com', ok: true, ms: 26 },
  { name: '百度', host: 'www.baidu.com', ok: true, ms: 22 },
  { name: 'Bilibili', host: 'www.bilibili.com', ok: true, ms: 31 }
]

const DEMO_AI = `## 结论速览
- 出口概况：主出口 203.0.113.7（示例数据中心，AS64512）；另有 3 个不同出口见诊断明细
- IP 综合评分：62 / 100（数据中心广播段 + 黑名单少量命中；ChatGPT 分流出口很干净）
- IP 原生性：★★☆☆☆（来源数据库口径，不代表好坏）
- 风险等级：中风险（程序把各源不同量表归一后取中位数的计算值，非机构实测）
- VPN / Tor：未见来源标记；Proxy：来源判断不一致（Ping0 命中 / Net.Coffee 未命中），当前无法确认
- 住宅：主出口否（数据中心）；ChatGPT 分流出口为住宅
- 出口诊断要点：测得 3 个 HTTP 出口（主出口 / ChatGPT IPv6 / Claude IPv6）；CDN 命中节点 6 个（如 CloudFront HKG61-P1）；DNS 递归出口 3 个（AliDNS、114DNS、Google），与 HTTP 出口不同属常见现象，不判泄露

## 【当前能够确认的情况】
- 主出口为数据中心广播段，三源口径一致
- ChatGPT / Claude 访问走了不同的 IPv6 出口（目标各自回显）
- DNSBL 命中 2/12（Spamhaus ZEN、GBUdb Truncate）

## 【值得注意的项目】
- Proxy 判定存在来源分歧，无法确认
- WebRTC 观察到的出口与主出口不同（检测源报告口径）
- 浏览器时区（Asia/Singapore）与 ChatGPT 出口地区（日本）不一致

## 【还不能确认的内容】
- 是否真的「未被标记代理」：IPPure 未提供该字段
- DNS 出口差异是否造成位置暴露：需要结合你自己的分流配置判断，本工具不替你下结论

## 【多源一致性与口径】
- 一致：数据中心 / VPN / Tor / 位置
- 分歧：Proxy（逐源判断见上）；Net.Coffee 与 IPPure 后端部分同源，二者一致不等于独立互证
- 各源分数：Ping0 风控值越高越危险；Net.Coffee 信任分越高越安全

## 【建议下一步】
- 需要高信誉场景（电商、支付）：换住宅 ISP 原生出口
- 只关心 AI 服务：现有分流已足够，无需动主出口
- 想确认 DNS 路径：在「网络出口诊断 → DNS 出口查询」按解析器逐个复测
`

function demoHistory(): HistoryRecord[] {
  const d = (daysAgo: number, h: number, m: number): string => {
    const t = new Date()
    t.setDate(t.getDate() - daysAgo)
    t.setHours(h, m, 0, 0)
    return t.toISOString()
  }
  const mk = (id: string, days: number, ip: string, risk: string, net: string, withDiag?: boolean): HistoryRecord => ({
    id,
    startedAt: d(days, 14, 5),
    finishedAt: d(days, 14, 6),
    currentIp: ip,
    successCount: 4,
    totalCount: 4,
    riskLevel: risk,
    riskValue: risk === '低风险' ? 18 : risk === '中风险' ? 52 : 78,
    netType: net,
    sources: [
      { key: 'ping0', name: 'Ping0', ok: true, durationMs: 8200 },
      { key: 'netcoffee', name: 'Net.Coffee', ok: true, durationMs: 6100 },
      { key: 'netcoffee_gpt', name: 'Net.Coffee GPT', ok: true, durationMs: 13400 },
      { key: 'ippure', name: 'IPPure', ok: true, durationMs: 5200 }
    ],
    results: RESULTS.map((r) => ({ ...r, ip: r.provider.id === 'netcoffee_gpt' ? GPT_IP : ip })),
    diag: withDiag ? demoDiagSummary({ ...DEMO_DIAG_RUN, runId: `diag-${id}` }) : undefined
  })
  return [
    mk('demo-1', 0, MAIN_IP, '中风险', '数据中心', true),
    mk('demo-2', 1, '203.0.113.42', '低风险', '住宅'),
    mk('demo-3', 3, '198.51.100.88', '高风险', '数据中心')
  ]
}

let settings: AppSettings = {
  appearance: { theme: 'light', sidebarCollapsedByDefault: false, fontSize: 'standard', language: 'zh' },
  ai: {
    current: 'qwen',
    providers: {
      openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
      doubao: { apiKey: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-pro-32k-250115' },
      qwen: { apiKey: 'demo-key', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
      ollama: { apiKey: '', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
      zhipu: { apiKey: '', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-air' },
      moonshot: { apiKey: '', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
      siliconflow: { apiKey: '', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
      custom: { apiKey: '', baseUrl: '', model: '' }
    },
    customProviders: {},
    hiddenProviders: [],
    extraPrompt: '',
    temperature: 0.4,
    maxTokens: 8192
  },
  detection: { timeoutSec: 40, autoRunOnStart: false, parallel: false, lightExitProbe: true },
  privacy: { historyEnabled: true, historyRetentionDays: 30, clearHistoryOnExit: false },
  updates: { autoCheck: true }
}

const logListeners = new Set<(m: string) => void>()
const updateListeners = new Set<(s: UpdateStatus) => void>()
const chunkListeners = new Set<(d: string) => void>()
const stageListeners = new Set<(s: string) => void>()
const askListeners = new Set<(d: string) => void>()
const diagListeners = new Set<(e: DiagEvent) => void>()

// =============================================================
// Demo 出口诊断：覆盖 正常 / 多出口 / IPv6 未测得 / 部分失败 四种形态。
// 全部使用文档保留地址，显著标注样例；不回退到 Demo 于真实失败场景。
// =============================================================

const geo = (country: string, city: string, isp: string, asn: string): DiagGeo => ({
  country, city, isp, asn, source: 'ip-api.com（Demo）', fetchedAt: nowIso()
})
const evHttp = (snippet: string, note: string): DiagEvidence[] => [
  { kind: 'http', status: 200, durationMs: 240, snippet, note }
]

const DEMO_DIAG_RUN: DiagRun = {
  runId: 'diag-demo-0001',
  startedAt: nowIso(),
  status: 'partial',
  finishedReason: 'completed',
  origin: 'network',
  modules: [
    {
      id: 'publicIp',
      status: 'partial',
      probes: [
        {
          id: 'trace-www.cloudflare.com', source: 'cloudflare', sourceUrl: 'https://www.cloudflare.com/',
          target: 'www.cloudflare.com', targetHost: 'www.cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace',
          method: 'HTTP GET /cdn-cgi/trace（主进程 HTTP，跟随系统代理）', mechKey: 'http-proxy', via: 'main-http',
          status: 'success', ip: MAIN_IP, family: 'ipv4', geo: geo('新加坡（Demo）', 'Singapore', 'Example Broadband', 'AS64512'),
          httpStatus: 200, durationMs: 210,
          evidence: evHttp('ip=203.0.113.7\ncolo=SIN\nloc=SG', '（Demo 样例）Cloudflare trace 原文')
        },
        {
          id: 'trace-speed.cloudflare.com', source: 'cloudflare', sourceUrl: 'https://speed.cloudflare.com/',
          target: 'speed.cloudflare.com', targetHost: 'speed.cloudflare.com', url: 'https://speed.cloudflare.com/cdn-cgi/trace',
          method: 'HTTP GET /cdn-cgi/trace（主进程 HTTP，跟随系统代理）', mechKey: 'http-proxy', via: 'main-http',
          status: 'success', ip: MAIN_IP, family: 'ipv4',
          geo: geo('新加坡（Demo）', 'Singapore', 'Example Broadband', 'AS64512'),
          httpStatus: 200, durationMs: 230
        },
        {
          id: 'trace-v6-www.cloudflare.com', source: 'cloudflare', sourceUrl: 'https://www.cloudflare.com/',
          target: 'www.cloudflare.com（IPv6）', targetHost: 'www.cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace',
          method: 'HTTP GET /cdn-cgi/trace（Node https 强制 IPv6 直连，不经应用层代理）', mechKey: 'node-direct', via: 'node-direct',
          status: 'unsupported', error: '（Demo 样例）未取得 IPv6 出口（本机无 IPv6 连接或网络策略阻止）',
          durationMs: 120,
          evidence: [{ kind: 'http', durationMs: 120, note: '（Demo 样例）ENETUNREACH：Node https family=6 直连' }]
        },
        {
          id: 'sukka-page', source: 'sukka-page', sourceUrl: 'https://ip.skk.moe/',
          target: 'ip.skk.moe', targetHost: 'ip.skk.moe', url: 'https://ip.skk.moe/',
          method: '页面流程提取（ip.skk.moe 自身检测完成后读取其展示结果）', mechKey: 'page', via: 'browser-page',
          status: 'failed', error: '（Demo 样例）站点返回人机验证页（Cloudflare 挑战）。按合规约束不绕过验证。',
          durationMs: 4100
        }
      ]
    },
    {
      id: 'splitTunnel',
      status: 'partial',
      probes: [
        { id: 'split-Cloudflare', source: 'cloudflare', sourceUrl: 'https://www.cloudflare.com/', target: 'Cloudflare', targetHost: 'www.cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', category: 'intl', status: 'success', ip: MAIN_IP, family: 'ipv4', geo: geo('新加坡（Demo）', 'Singapore', 'Example Broadband', 'AS64512'), httpStatus: 200, durationMs: 240, evidence: evHttp('ip=203.0.113.7', '（Demo）trace') },
        { id: 'split-ChatGPT', source: 'cloudflare', sourceUrl: 'https://chatgpt.com/', target: 'ChatGPT', targetHost: 'chatgpt.com', url: 'https://chatgpt.com/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', category: 'ai', status: 'success', ip: GPT_IP, family: 'ipv6', geo: geo('日本（Demo）', 'Tokyo', 'Example Residential KK', 'AS64513'), node: 'NRT', httpStatus: 200, durationMs: 320, evidence: evHttp('ip=2001:db8:2686::1\ncolo=NRT', '（Demo）trace：IPv6 出口样例') },
        { id: 'split-Claude', source: 'cloudflare', sourceUrl: 'https://claude.ai/', target: 'Claude', targetHost: 'claude.ai', url: 'https://claude.ai/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', category: 'ai', status: 'success', ip: GPT_IP, family: 'ipv6', geo: geo('日本（Demo）', 'Tokyo', 'Example Residential KK', 'AS64513'), node: 'NRT', httpStatus: 200, durationMs: 300 },
        { id: 'split-OpenAI API', source: 'cloudflare', sourceUrl: 'https://api.openai.com/', target: 'OpenAI API', targetHost: 'api.openai.com', url: 'https://api.openai.com/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', category: 'ai', status: 'success', ip: '198.51.100.131', family: 'ipv4', geo: geo('日本（Demo）', 'Tokyo', 'Example Cloud', 'AS64514'), node: 'NRT', httpStatus: 200, durationMs: 556 },
        { id: 'split-Anthropic', source: 'cloudflare', sourceUrl: 'https://www.anthropic.com/', target: 'Anthropic', targetHost: 'www.anthropic.com', url: 'https://www.anthropic.com/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', category: 'ai', status: 'success', ip: '198.51.100.131', family: 'ipv4', geo: geo('日本（Demo）', 'Tokyo', 'Example Cloud', 'AS64514'), node: 'NRT', httpStatus: 200, durationMs: 540 },
        { id: 'split-Discord', source: 'cloudflare', sourceUrl: 'https://discord.com/', target: 'Discord', targetHost: 'discord.com', url: 'https://discord.com/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', category: 'intl', status: 'failed', error: '（Demo 样例）响应中无 ip 字段（目标返回异常页）', httpStatus: 403, durationMs: 552 },
        { id: 'split-GitLab', source: 'cloudflare', sourceUrl: 'https://gitlab.com/', target: 'GitLab', targetHost: 'gitlab.com', url: 'https://gitlab.com/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', category: 'dev', status: 'success', ip: MAIN_IP, family: 'ipv4', geo: geo('新加坡（Demo）', 'Singapore', 'Example Broadband', 'AS64512'), node: 'SIN', httpStatus: 200, durationMs: 260 },
        { id: 'split-Stack Overflow', source: 'cloudflare', sourceUrl: 'https://stackoverflow.com/', target: 'Stack Overflow', targetHost: 'stackoverflow.com', url: 'https://stackoverflow.com/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', category: 'dev', status: 'success', ip: MAIN_IP, family: 'ipv4', node: 'LAX', httpStatus: 200, durationMs: 420 },
        { id: 'split-ipinfo.io', source: 'target-api', sourceUrl: 'https://ipinfo.io/', target: 'ipinfo.io', targetHost: 'ipinfo.io', url: 'https://ipinfo.io/ip', method: 'HTTP GET（目标公开回显接口）', mechKey: 'http-proxy', via: 'main-http', category: 'intl', status: 'success', ip: MAIN_IP, family: 'ipv4', httpStatus: 200, durationMs: 180 },
        { id: 'split-IP.SB', source: 'target-api', sourceUrl: 'https://ip.sb/', target: 'IP.SB', targetHost: 'api.ip.sb', url: 'https://api.ip.sb/ip', method: 'HTTP GET（目标公开回显接口）', mechKey: 'http-proxy', via: 'main-http', category: 'intl', status: 'success', ip: MAIN_IP, family: 'ipv4', httpStatus: 200, durationMs: 220 },
        { id: 'split-哔哩哔哩', source: 'target-api', sourceUrl: 'https://www.bilibili.com/', target: '哔哩哔哩', targetHost: 'api.bilibili.com', url: 'https://api.bilibili.com/x/web-interface/zone', method: 'HTTP GET（目标公开回显接口）', mechKey: 'http-proxy', via: 'main-http', category: 'cn', status: 'success', ip: '198.51.100.36', family: 'ipv4', geo: { country: '中国（Demo）', region: '示例省（Demo）', city: '示例市（Demo）', isp: '移动（Demo）', source: '目标自身提供', fetchedAt: nowIso() }, httpStatus: 200, durationMs: 60 },
        { id: 'split-IPIP.net', source: 'target-api', sourceUrl: 'https://www.ipip.net/', target: 'IPIP.net', targetHost: 'myip.ipip.net', url: 'https://myip.ipip.net/', method: 'HTTP GET（目标公开回显接口）', mechKey: 'http-proxy', via: 'main-http', category: 'cn', status: 'success', ip: '198.51.100.36', family: 'ipv4', geo: { country: '中国（Demo）', region: '示例省（Demo）', city: '示例市（Demo）', isp: 'example-isp.test（Demo）', source: '目标自身提供', fetchedAt: nowIso() }, httpStatus: 200, durationMs: 45 },
        { id: 'split-GitHub', source: 'target-site', sourceUrl: 'https://github.com/', target: 'GitHub', targetHost: 'github.com', url: 'https://github.com/', method: 'HTTP GET（不回显出口）', mechKey: 'http-proxy', via: 'main-http', category: 'dev', status: 'success', httpStatus: 200, durationMs: 1397 },
        { id: 'split-百度', source: 'target-site', sourceUrl: 'https://www.baidu.com/', target: '百度', targetHost: 'www.baidu.com', url: 'https://www.baidu.com/', method: 'HTTP GET（不回显出口）', mechKey: 'http-proxy', via: 'main-http', category: 'cn', status: 'success', httpStatus: 200, durationMs: 40 },
        { id: 'split-网易云音乐', source: 'target-site', sourceUrl: 'https://music.163.com/', target: '网易云音乐', targetHost: 'music.163.com', url: 'https://music.163.com/', method: 'HTTP GET（不回显出口）', mechKey: 'http-proxy', via: 'main-http', category: 'cn', status: 'timeout', error: '（Demo 样例）请求超时（9000ms）', durationMs: 9000 }
      ]
    },
    {
      id: 'cdnNode',
      status: 'success',
      probes: [
        { id: 'cdn-Cloudflare', source: 'cdn-target', sourceUrl: 'https://www.cloudflare.com/', target: 'Cloudflare', targetHost: 'www.cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', status: 'success', node: 'SIN', cdn: 'Cloudflare', httpStatus: 200, durationMs: 142, cacheSignals: undefined },
        { id: 'cdn-Cloudflare Speed', source: 'cdn-target', sourceUrl: 'https://speed.cloudflare.com/', target: 'Cloudflare Speed', targetHost: 'speed.cloudflare.com', url: 'https://speed.cloudflare.com/cdn-cgi/trace', method: 'HTTP GET /cdn-cgi/trace', mechKey: 'http-proxy', via: 'main-http', status: 'success', node: 'SIN', cdn: 'Cloudflare Speed', httpStatus: 200, durationMs: 148 },
        { id: 'cdn-Fastly', source: 'cdn-target', sourceUrl: 'https://www.fastly.com/status', target: 'Fastly', targetHost: 'any.pops.fastly-analytics.com', url: 'https://any.pops.fastly-analytics.com', method: 'HTTP GET（响应头信号）', mechKey: 'http-proxy', via: 'main-http', status: 'success', node: 'cache-sin-wsss1830044-SIN', cdn: 'Fastly', httpStatus: 200, durationMs: 598, cacheSignals: ['HIT', '0'] },
        { id: 'cdn-AWS CloudFront', source: 'cdn-target', sourceUrl: 'https://aws.amazon.com/cloudfront/', target: 'AWS CloudFront', targetHost: 'djlzvy5xcvhxt.cloudfront.net', url: 'https://djlzvy5xcvhxt.cloudfront.net/500b-bench.jpg', method: 'HTTP GET（响应头信号）', mechKey: 'http-proxy', via: 'main-http', status: 'success', node: 'HKG61-P1', cdn: 'AWS CloudFront', httpStatus: 200, durationMs: 430, cacheSignals: ['Miss from cloudfront', 'Hit from cloudfront'] },
        { id: 'cdn-Bunny Standard', source: 'cdn-target', sourceUrl: 'https://bunny.net/', target: 'Bunny Standard', targetHost: 'test.b-cdn.net', url: 'https://test.b-cdn.net', method: 'HTTP GET（响应头信号）', mechKey: 'http-proxy', via: 'main-http', status: 'success', node: 'BunnyCDNE-JP1-1171', cdn: 'Bunny Standard', httpStatus: 200, durationMs: 449 },
        { id: 'cdn-Bunny Volume', source: 'cdn-target', sourceUrl: 'https://bunny.net/', target: 'Bunny Volume', targetHost: 'testvideo.b-cdn.net', url: 'https://testvideo.b-cdn.net', method: 'HTTP GET（响应头信号）', mechKey: 'http-proxy', via: 'main-http', status: 'success', node: 'BunnyCDN-LA1-1108', cdn: 'Bunny Volume', httpStatus: 200, durationMs: 600 },
        { id: 'cdn-CDN77', source: 'cdn-target', sourceUrl: 'https://www.cdn77.com/', target: 'CDN77', targetHost: '1596384882.rsc.cdn77.org', url: 'https://1596384882.rsc.cdn77.org/500b-bench.jpg', method: 'HTTP GET（响应头信号）', mechKey: 'http-proxy', via: 'main-http', status: 'success', node: 'hongkongHK', cdn: 'CDN77', httpStatus: 200, durationMs: 520, cacheSignals: ['HIT'] },
        { id: 'cdn-CacheFly', source: 'cdn-target', sourceUrl: 'https://cachefly.com/', target: 'CacheFly', targetHost: 'cdnperf.cachefly.net', url: 'https://cdnperf.cachefly.net/500b-bench.jpg', method: 'HTTP GET（响应头信号）', mechKey: 'http-proxy', via: 'main-http', status: 'success', node: '28637:fA.hkg3:co:1610982815:cacheN.hkg3-01:H', cdn: 'CacheFly', httpStatus: 200, durationMs: 507, cacheSignals: ['H'] },
        { id: 'cdn-OVH CDN', source: 'cdn-target', sourceUrl: 'https://www.ovhcloud.com/', target: 'OVH CDN', targetHost: 'ovh-cdn.perfops.io', url: 'https://ovh-cdn.perfops.io/500b-bench.jpg', method: 'HTTP GET（响应头信号）', mechKey: 'http-proxy', via: 'main-http', status: 'success', node: 'sbg', cdn: 'OVH CDN', httpStatus: 200, durationMs: 1760 },
        { id: 'cdn-Zenlayer', source: 'cdn-target', sourceUrl: 'https://zenlayer.com/', target: 'Zenlayer', targetHost: 'test-perfops.ecn.zenlayer.net', url: 'https://test-perfops.ecn.zenlayer.net/500b-bench.jpg', method: 'HTTP GET（响应头信号）', mechKey: 'http-proxy', via: 'main-http', status: 'success', cdn: 'Zenlayer', httpStatus: 200, durationMs: 1008 },
        { id: 'cdn-jsDelivr', source: 'cdn-target', sourceUrl: 'https://www.jsdelivr.com/', target: 'jsDelivr', targetHost: 'cdn.jsdelivr.net', url: 'https://cdn.jsdelivr.net/npm/latency-test@1.0.0/generate_200', method: 'HTTP GET（响应头信号）', mechKey: 'http-proxy', via: 'main-http', status: 'success', cdn: 'jsDelivr', httpStatus: 200, durationMs: 576 }
      ]
    },
    {
      id: 'dnsExit',
      status: 'partial',
      probes: [
        { id: 'dns-system-google-authoritative', source: 'google-authoritative', sourceUrl: 'https://developers.google.com/speed/public-dns/docs/ecs', target: '系统配置解析器', targetHost: 'o-o.myaddr.l.google.com', method: 'DNS TXT（UDP 直连 系统配置解析器）', mechKey: 'dns-udp', via: 'dns-udp', status: 'success', ip: '198.51.100.10', family: 'ipv4', exitSource: 'txt', serverAddr: '223.5.5.5（Demo）', resolverKind: 'system', durationMs: 30, dnsRecords: ['198.51.100.10'], evidence: [{ kind: 'dns', durationMs: 30, snippet: '198.51.100.10', note: '（Demo）TXT 原文' }] },
        { id: 'dns-system-akamai-authoritative', source: 'akamai-authoritative', sourceUrl: 'https://www.akamai.com/blog/developers/introducing-new-whoami-tool-dns-resolver-information', target: '系统配置解析器', targetHost: 'whoami.ds.akahelp.net', method: 'DNS TXT（UDP 直连 系统配置解析器）', mechKey: 'dns-udp', via: 'dns-udp', status: 'success', ip: '198.51.100.10', family: 'ipv4', exitSource: 'ns', serverAddr: '223.5.5.5（Demo）', resolverKind: 'system', durationMs: 25, dnsRecords: ['ns 198.51.100.10', 'ecs 198.51.100.36/24', 'ip 198.51.100.36'], ecsSubnet: '198.51.100.36/24', ecsRep: '198.51.100.36' },
        { id: 'dns-alidns-google-authoritative', source: 'google-authoritative', sourceUrl: 'https://developers.google.com/speed/public-dns/docs/ecs', target: 'AliDNS (223.5.5.5)', targetHost: 'o-o.myaddr.l.google.com', method: 'DNS TXT（UDP 直连 223.5.5.5）', mechKey: 'dns-udp', via: 'dns-udp', status: 'success', ip: '198.51.100.10', family: 'ipv4', exitSource: 'txt', serverAddr: '223.5.5.5', resolverKind: 'public', durationMs: 23, dnsRecords: ['198.51.100.10'] },
        { id: 'dns-dnspod-google-authoritative', source: 'google-authoritative', sourceUrl: 'https://developers.google.com/speed/public-dns/docs/ecs', target: 'DNSPod (119.29.29.29)', targetHost: 'o-o.myaddr.l.google.com', method: 'DNS TXT（UDP 直连 119.29.29.29）', mechKey: 'dns-udp', via: 'dns-udp', status: 'success', dnsRecords: ['edns0-client-subnet 198.51.100.0/24', '·f····203.0.113.25'], ecsSubnet: '198.51.100.0/24', serverAddr: '119.29.29.29', resolverKind: 'public', durationMs: 281, evidence: [{ kind: 'dns', durationMs: 281, snippet: 'edns0-client-subnet 198.51.100.0/24 ·f····203.0.113.25', note: '（Demo）仅取得 ECS 网段，网段内地址被二进制截断 → 不输出猜测的解析器出口' }] },
        { id: 'dns-114dns-akamai-authoritative', source: 'akamai-authoritative', sourceUrl: 'https://www.akamai.com/blog/developers/introducing-new-whoami-tool-dns-resolver-information', target: '114DNS (114.114.114.114)', targetHost: 'whoami.ds.akahelp.net', method: 'DNS TXT（UDP 直连 114.114.114.114）', mechKey: 'dns-udp', via: 'dns-udp', status: 'success', ip: '2001:db8:8765:4321::1', family: 'ipv6', exitSource: 'ns', serverAddr: '114.114.114.114', resolverKind: 'public', durationMs: 42, dnsRecords: ['ns 2001:db8:8765:4321::1'] },
        { id: 'dns-google-akamai-authoritative', source: 'akamai-authoritative', sourceUrl: 'https://www.akamai.com/blog/developers/introducing-new-whoami-tool-dns-resolver-information', target: 'Google DNS (8.8.8.8)', targetHost: 'whoami.ds.akahelp.net', method: 'DNS TXT（UDP 直连 8.8.8.8）', mechKey: 'dns-udp', via: 'dns-udp', status: 'success', ip: '192.0.2.25', family: 'ipv4', exitSource: 'ns', serverAddr: '8.8.8.8', resolverKind: 'public', durationMs: 173, dnsRecords: ['ns 192.0.2.25'] },
        { id: 'dns-cloudflare-akamai-authoritative', source: 'akamai-authoritative', sourceUrl: 'https://www.akamai.com/blog/developers/introducing-new-whoami-tool-dns-resolver-information', target: 'Cloudflare DNS (1.1.1.1)', targetHost: 'whoami.ds.akahelp.net', method: 'DNS TXT（UDP 直连 1.1.1.1）', mechKey: 'dns-udp', via: 'dns-udp', status: 'timeout', error: '（Demo 样例）DNS 查询超时（9000ms）', durationMs: 9000, serverAddr: '1.1.1.1', resolverKind: 'public' },
        { id: 'dns-cloudflare-google-authoritative', source: 'google-authoritative', sourceUrl: 'https://developers.google.com/speed/public-dns/docs/ecs', target: 'Cloudflare DNS (1.1.1.1)', targetHost: 'o-o.myaddr.l.google.com', method: 'DNS TXT（UDP 直连 1.1.1.1）', mechKey: 'dns-udp', via: 'dns-udp', status: 'success', ip: '192.0.2.11', family: 'ipv4', exitSource: 'txt', serverAddr: '1.1.1.1', resolverKind: 'public', durationMs: 76, dnsRecords: ['192.0.2.11'] }
      ]
    }
  ]
}

function demoDiagSummary(run: DiagRun): DiagRunSummary {
  const probes: DiagRunSummary['probes'] = { publicIp: [], splitTunnel: [], cdnNode: [], dnsExit: [] }
  const sources = new Set<string>()
  let ok = 0
  let total = 0
  for (const m of run.modules) {
    for (const p of m.probes) {
      total += 1
      if (p.status === 'success') ok += 1
      sources.add(p.source)
      probes[m.id].push({
        id: p.id, source: p.source, sourceUrl: p.sourceUrl, target: p.target, targetHost: p.targetHost,
        method: p.method, mechKey: p.mechKey, via: p.via, category: p.category,
        status: p.status, ip: p.ip, family: p.family, geo: p.geo, node: p.node, cdn: p.cdn,
        cacheSignals: p.cacheSignals, httpStatus: p.httpStatus, durationMs: p.durationMs,
        dnsRecords: p.dnsRecords, exitSource: p.exitSource, ecsSubnet: p.ecsSubnet, ecsRep: p.ecsRep,
        serverAddr: p.serverAddr, resolverKind: p.resolverKind, error: p.error, attempts: p.attempts
      })
    }
  }
  return {
    runId: run.runId, startedAt: run.startedAt, finishedAt: run.finishedAt,
    status: run.status, finishedReason: run.finishedReason, origin: run.origin,
    moduleStatus: Object.fromEntries(run.modules.map((m) => [m.id, m.status])),
    probes,
    stats: { sources: sources.size, probes: total, ok }
  }
}

let history: HistoryRecord[] = demoHistory()
let diagRun: DiagRun | null = null
let diagStopped = false

function deepMerge(base: AppSettings, patch: Record<string, unknown>): AppSettings {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object') {
      out[k] = deepMerge(out[k] as AppSettings, v as Record<string, unknown>)
    } else if (v !== undefined) {
      out[k] = v
    }
  }
  return out as unknown as AppSettings
}

export function install(): void {
  ;(window as unknown as { __IPI_DEMO__?: boolean }).__IPI_DEMO__ = true
  const api = {
    detectPing0: async () => {
      logListeners.forEach((l) => l('加载页面：https://ping0.cc/（demo）'))
      await sleep(700)
      return PING0
    },
    detectNetcoffee: async () => {
      await sleep(900)
      return NETCOFFEE
    },
    detectNetcoffeeGpt: async () => {
      await sleep(1100)
      return GPT
    },
    detectIppure: async () => {
      await sleep(600)
      return IPPURE
    },
    detectSpeedtest: async () => {
      await sleep(1500)
      return SPEED
    },
    fetchServiceStatus: async () => ({ ok: true, feed: { ...FEED, fetchedLocalAt: nowIso() } }),
    probeReachability: async () => {
      await sleep(900)
      return { ok: true, results: REACH }
    },
    // Demo 出口诊断：立即返回骨架（全部 queued），随后逐项流式更新为新事件形态
    startDiag: async (req: { modules: string[]; origin: string }) => {
      diagStopped = false
      const full = JSON.parse(JSON.stringify(DEMO_DIAG_RUN)) as DiagRun
      const mods = full.modules.filter((m) => req.modules.includes(m.id))
      const run: DiagRun = {
        ...full,
        runId: `diag-demo-${Date.now().toString(36)}`,
        startedAt: nowIso(),
        status: 'running',
        finishedReason: undefined,
        finishedAt: undefined,
        modules: mods.map((m) => ({
          ...m,
          status: 'running' as const,
          probes: m.probes.map((p) => ({ ...p, status: 'queued' as const, ip: undefined, node: undefined, error: undefined, durationMs: undefined, httpStatus: undefined }))
        }))
      }
      diagRun = run
      ;(async () => {
        const finalById = new Map<string, DiagProbe>()
        for (const m of full.modules) for (const p of m.probes) finalById.set(p.id, p)
        for (const m of run.modules) {
          for (const skeleton of m.probes) {
            if (diagStopped) return
            const final = finalById.get(skeleton.id)
            const done = final ? { ...final, startedAt: nowIso(), finishedAt: nowIso(), attempts: [{ startedAt: nowIso(), finishedAt: nowIso(), status: final.status, error: final.error }] } : skeleton
            const idx = m.probes.findIndex((p) => p.id === skeleton.id)
            m.probes[idx] = done
            diagListeners.forEach((l) => l({ kind: 'probe', runId: run.runId, moduleId: m.id, probe: done }))
            await sleep(230)
          }
          if (diagStopped) return
          m.status = finalById.get(m.probes[0]?.id ?? '') ? (m.probes.some((p) => p.status !== 'success') ? 'partial' : 'success') : 'partial'
          diagListeners.forEach((l) => l({ kind: 'module', runId: run.runId, moduleId: m.id, status: m.status }))
        }
        if (diagStopped) return
        diagRun.status = 'partial'
        diagRun.finishedReason = 'completed'
        diagRun.finishedAt = nowIso()
        diagListeners.forEach((l) => l({ kind: 'run', runId: run.runId, status: 'partial', finishedReason: 'completed' }))
      })()
      return { ok: true, runId: run.runId, run }
    },
    stopDiag: async () => {
      diagStopped = true
      if (diagRun && diagRun.status === 'running') {
        diagRun.status = 'canceled'
        diagRun.finishedReason = 'canceled'
        diagRun.finishedAt = nowIso()
        diagListeners.forEach((l) => l({ kind: 'run', runId: diagRun!.runId, status: 'canceled', finishedReason: 'canceled' }))
      }
      return { ok: true }
    },
    latestDiag: async () => ({ ok: true, run: diagRun, summary: diagRun ? demoDiagSummary(diagRun) : null }),
    getDiag: async (runId: string) => ({
      ok: true,
      run: diagRun && diagRun.runId === runId ? diagRun : null,
      summary: diagRun && diagRun.runId === runId ? demoDiagSummary(diagRun) : null
    }),
    retryDiag: async (req: { runId: string; probeIds: string[] }) => {
      if (!diagRun || diagRun.runId !== req.runId) return { ok: false }
      void req.probeIds // Demo：单项重试直接沿用主进程事件流模拟（页面仍会轮询校准）
      return { ok: true }
    },
    onDiagEvent: (cb: (e: DiagEvent) => void) => {
      diagListeners.add(cb)
      return () => diagListeners.delete(cb)
    },
    getSettings: async () => ({ ok: true, settings }),
    setSettings: async (patch: Partial<AppSettings>) => {
      settings = deepMerge(settings, patch as Record<string, unknown>)
      return { ok: true, settings }
    },
    resetSettings: async () => ({ ok: true, settings }),
    appVersion: async () => '0.2.3-demo',
    testAi: async () => {
      await sleep(600)
      return { ok: true, ms: 612, reply: '收到' }
    },
    analyzeAi: async (_p: AiAnalyzeRequest) => {
      stageListeners.forEach((l) => l('connected'))
      await sleep(900)
      stageListeners.forEach((l) => l('streaming'))
      const chunks = DEMO_AI.match(/.{1,24}/gs) ?? []
      for (const c of chunks) {
        await sleep(18)
        chunkListeners.forEach((l) => l(c))
      }
      return { ok: true, text: DEMO_AI, provider: '通义千问（阿里云）', model: 'qwen-plus（demo）', ms: 4200 }
    },
    onAiChunk: (cb: (d: string) => void) => {
      chunkListeners.add(cb)
      return () => chunkListeners.delete(cb)
    },
    onAiStage: (cb: (s: string) => void) => {
      stageListeners.add(cb)
      return () => stageListeners.delete(cb)
    },
    askAi: async (_p: AiAskRequest) => {
      const sample =
        '## 结论：有条件可行\n\n- 该 IP 为数据中心广播段，原生性较低，流媒体解锁可能受限。\n- 建议：更换住宅 ISP 的原生 IP，或选择流媒体解锁率高的地区住宅出口。\n\n（Demo 样例回答）'
      for (const c of sample.match(/.{1,24}/gs) ?? []) {
        await sleep(18)
        askListeners.forEach((l) => l(c))
      }
      return { ok: true, text: sample, provider: 'Demo', model: 'demo', ms: 1200 }
    },
    onAskChunk: (cb: (d: string) => void) => {
      askListeners.add(cb)
      return () => askListeners.delete(cb)
    },
    listHistory: async () => ({ ok: true, enabled: settings.privacy.historyEnabled, records: history }),
    getHistory: async (id: string) => ({ ok: true, record: history.find((h) => h.id === id) }),
    saveHistory: async (rec: HistoryRecord) => {
      history = [rec, ...history].slice(0, 20)
      return { ok: true, id: rec.id }
    },
    updateHistoryAi: async (id: string, ai: string) => {
      const r = history.find((h) => h.id === id)
      if (r) r.aiReport = ai
      return { ok: true }
    },
    deleteHistory: async (id: string) => {
      history = history.filter((h) => h.id !== id)
      return { ok: true }
    },
    clearHistory: async () => {
      history = []
      return { ok: true }
    },
    exportReport: async (payload: { model: unknown; format: string }) => {
      const blob = new Blob([JSON.stringify(payload.model, null, 2)], { type: 'text/plain' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `demo-report.${payload.format === 'pdf' ? 'html' : payload.format}`
      a.click()
      return { ok: true, path: '(demo) 浏览器下载' }
    },
    revealFile: async () => ({ ok: true }),
    openSource: async (url: string) => {
      window.open(url, '_blank')
      return true
    },
    onDetectLog: (cb: (m: string) => void) => {
      logListeners.add(cb)
      return () => logListeners.delete(cb)
    },
    // Demo 模式无真实更新通道：给出明确状态，不转圈
    checkForUpdates: async () => {
      updateListeners.forEach((l) => l({ state: 'up-to-date', version: '0.2.3-demo' }))
      return { ok: true }
    },
    quitAndInstall: async () => ({ ok: true }),
    onUpdateStatus: (cb: (s: UpdateStatus) => void) => {
      updateListeners.add(cb)
      return () => updateListeners.delete(cb)
    }
  }
  ;(window as unknown as { ipInsight: typeof api }).ipInsight = api
}
