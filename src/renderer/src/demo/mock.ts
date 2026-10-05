import type {
  AiAnalyzeRequest,
  AppSettings,
  HistoryRecord,
  NormalizedIPResult,
  ReachProbeResult,
  ServiceStatusFeed
} from '@shared/types'

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
  dnsLeak: { status: '可能泄露', exitIp: '203.0.113.99', provider: 'Example DNS', detail: 'sg' },
  webRTCLeak: { status: '未检测到泄露' },
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
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
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
- IP 综合评分：**62 / 100**（主出口为数据中心广播段，黑名单有少量命中，但 ChatGPT 分流出口极为纯净）
- IP 原生性：★★☆☆☆
- 风险等级：**中风险**
- VPN：未发现
- Proxy：**多源存在分歧（Ping0 命中 / Net.Coffee 未命中），当前无法确认**
- Tor：未发现
- 住宅 IP：主出口否；ChatGPT 分流出口为住宅
- 数据中心：是（主出口）
- 共享出口：可能（10–100 区间）

## 【AI 综合分析】
主出口 203.0.113.7 属于文档保留地址段示例（AS64512），三源一致判定为数据中心 / 托管类型，且为广播 IP；Ping0 与 Net.Coffee 在 Proxy 判定上存在分歧，按规则不下确定结论。ChatGPT 流量被分流至 198.51.100.23（示例住宅出口，信任分 96/100），但 DNS 出口与主出口不一致，存在位置暴露面。

## 【多源一致性】
- 一致项：数据中心、VPN、Tor、位置（新加坡）
- 分歧项：Proxy（Ping0 命中 / Net.Coffee 未命中 / IPPure 未提供）
- 说明：Net.Coffee 与 IPPure 后端部分同源，二者一致不等于独立互证；Ping0 相对独立。

## 【异常项目】
- DNSBL 命中 2/12（Spamhaus ZEN、GBUdb Truncate）
- DNS 泄露：可能泄露（出口 203.0.113.99 与 ChatGPT 出口不一致）
- 设备时区（Asia/Singapore）与 ChatGPT 出口时区（Asia/Tokyo）不一致

## 【风险说明】
主出口为机房广播段且共享人数区间偏大，用于高信任场景（电商店铺、支付风控敏感业务）时可能被降级对待；黑名单命中以 Spam 类为主，邮件类业务受影响概率较高。

## 【适合场景】
- 一般浏览、资讯采集、开发调试
- AI 服务访问（已分流至纯净住宅出口）

## 【不建议场景】
- 电商多店铺运营、广告账户等强风控场景（主出口为机房广播段）
- 外发邮件类业务（Spam 类黑名单命中）
`

function demoHistory(): HistoryRecord[] {
  const d = (daysAgo: number, h: number, m: number): string => {
    const t = new Date()
    t.setDate(t.getDate() - daysAgo)
    t.setHours(h, m, 0, 0)
    return t.toISOString()
  }
  const mk = (id: string, days: number, ip: string, risk: string, net: string): HistoryRecord => ({
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
    results: RESULTS.map((r) => ({ ...r, ip: r.provider.id === 'netcoffee_gpt' ? GPT_IP : ip }))
  })
  return [
    mk('demo-1', 0, MAIN_IP, '中风险', '数据中心'),
    mk('demo-2', 1, '203.0.113.42', '低风险', '住宅'),
    mk('demo-3', 3, '198.51.100.88', '高风险', '数据中心')
  ]
}

let settings: AppSettings = {
  appearance: { theme: 'light', sidebarCollapsedByDefault: false, fontSize: 'standard' },
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
  detection: { timeoutSec: 40, autoRunOnStart: false, parallel: false },
  privacy: { historyEnabled: true, historyRetentionDays: 30, clearHistoryOnExit: false }
}

let history: HistoryRecord[] = demoHistory()
const logListeners = new Set<(m: string) => void>()
const chunkListeners = new Set<(d: string) => void>()
const stageListeners = new Set<(s: string) => void>()

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
    getSettings: async () => ({ ok: true, settings }),
    setSettings: async (patch: Partial<AppSettings>) => {
      settings = deepMerge(settings, patch as Record<string, unknown>)
      return { ok: true, settings }
    },
    resetSettings: async () => ({ ok: true, settings }),
    appVersion: async () => '0.1.0-demo',
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
    }
  }
  ;(window as unknown as { ipInsight: typeof api }).ipInsight = api
}
