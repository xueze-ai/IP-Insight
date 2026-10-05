// =============================================================
// IP Insight - 统一数据模型 / Provider Adapter 契约
// 规则：所有字段必须来自真实网页 / 真实 JS 执行 / 真实 API / 真实本机检测。
//      拿不到就保持 undefined / null，禁止任何形式的伪造或随机填充。
// =============================================================

export type ProviderId =
  | 'ping0'
  | 'netcoffee'
  | 'netcoffee_gpt'
  | 'ippure'
  | 'local_speedtest'

export interface ProviderMeta {
  id: ProviderId
  name: string
  sourceUrl: string
}

export interface GeoPoint {
  lat: number | null
  lon: number | null
}

// 网络属性布尔标签：true=命中 false=明确未命中 null=该源未提供/无法判断
export interface NetworkFlags {
  residential: boolean | null
  datacenter: boolean | null
  hosting: boolean | null
  vpn: boolean | null
  proxy: boolean | null
  tor: boolean | null
  crawler: boolean | null
  mobile: boolean | null
  abuser: boolean | null
}

export interface BlacklistEntry {
  engine: string
  zone?: string
  category?: string
  listed: boolean
  codes?: string[]
  ms?: number
  status?: string
}

export interface LeakInfo {
  status: string // 例如：可能泄露 / 未泄露 / 未检测 / 未知
  exitIp?: string
  provider?: string
  detail?: string
}

export interface Fingerprint {
  visitorId?: string
  userAgent?: string
  browser?: string
  browserVersion?: string
  os?: string
  platform?: string
  timezone?: string
  timezoneConsistent?: boolean | null
  language?: string
  languages?: string[]
  languageConsistent?: boolean | null
  screen?: string
  colorDepth?: number
  hardwareConcurrency?: number
  deviceMemory?: number
  canvas?: string
  webgl?: string
  webglRenderer?: string
  audio?: string
  fonts?: string[]
  cookiesEnabled?: boolean
}

export interface GlobalPingNode {
  node: string
  latencyMs: number | null // 兼容旧口径：平均延迟
  minMs?: number | null
  avgMs?: number | null
  maxMs?: number | null
  reachable?: boolean | null // null=该节点无数据 false=测过但不可达
  name?: string // 站点节点名（如 中国上海）
  city?: string
  continent?: string // 亚洲 / 美洲 / 欧洲
  cc?: string
}

export interface ScenarioRating {
  name: string
  stars: number // 0-5
  recommended: boolean | null
  raw: string
}

// 单个数据源标准化结果
export interface NormalizedIPResult {
  provider: ProviderMeta
  fetchedAt: string // ISO 时间
  ok: boolean
  error?: string // 失败/不可用原因（真实原因，不用假数据替代）

  ip?: string
  ipv4?: string
  ipv6?: string | null
  rdns?: string

  isp?: string
  asn?: string | null // 形如 "AS401776"
  organization?: string

  country?: string
  region?: string
  city?: string
  location?: GeoPoint
  timezone?: string

  flags?: Partial<NetworkFlags>

  riskScore?: number | null // 0-100，保留该源原始口径
  riskLabel?: string
  nativeLabel?: string // 原生 IP / 广播 IP 等
  sharedUsers?: string

  blacklist?: BlacklistEntry[]
  blacklistSummary?: { listed: number; checked: number }

  dnsLeak?: LeakInfo
  webRTCLeak?: LeakInfo

  fingerprint?: Fingerprint
  globalPing?: GlobalPingNode[]

  downloadMbps?: number | null
  uploadMbps?: number | null

  scenarios?: ScenarioRating[]

  raw?: unknown // 该数据源原始结果（DOM 文本 / JSON），用于审计与展开
}

// Adapter 统一接口：open/detect/extract/normalize/close 生命周期
export interface AdapterContext {
  targetIp?: string
  timeoutMs?: number
  onLog?: (message: string) => void
}

export interface ProviderAdapter {
  readonly meta: ProviderMeta
  detect(ctx?: AdapterContext): Promise<NormalizedIPResult>
}

// 一次综合检测的聚合结果
export interface AggregatedReport {
  startedAt: string
  finishedAt: string
  results: NormalizedIPResult[]
  currentIp?: string
}

// ------------ 服务状态聚合（Net.Coffee /status/ 公开 data.json） ------------
export interface ServiceIncident {
  name: string
  status?: string
  impact?: string
  created_at?: string
  updated_at?: string
}

export interface ServiceStatusItem {
  key: string
  name: string
  group: string // AI / 云服务 / 开发 / 社区
  indicator: string // none | minor | major | critical | maintenance | unknown
  indicator_cn: string
  description: string
  ok: boolean
  error?: string
  page_url?: string
  detail_url?: string
  last_failure_at?: string
  last_check_at?: string
  incidents: ServiceIncident[]
}

export interface ServiceStatusFeed {
  sourceUrl: string
  fetchedAt: string // 站点聚合时间
  fetchedLocalAt: string // 本机拉取时间
  count: number
  failing: number
  services: ServiceStatusItem[]
}

export interface ServiceStatusResponse {
  ok: boolean
  error?: string
  feed?: ServiceStatusFeed
}

// ------------ 本机可达性实测（第 5 类本机检测） ------------
export interface ReachProbeResult {
  name: string
  host: string
  ok: boolean
  status?: number
  ms?: number
  error?: string
}

export interface ReachabilityResponse {
  ok: boolean
  error?: string
  results?: ReachProbeResult[]
}

// ------------ 设置（持久化于 userData/settings.json） ------------
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type ThemeMode = 'light' | 'dark' | 'system'

export type AiProviderId =
  | 'openai'
  | 'deepseek'
  | 'doubao'
  | 'qwen'
  | 'ollama'
  | 'zhipu'
  | 'moonshot'
  | 'siliconflow'
  | 'custom'

export interface AiProviderConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface CustomAiProvider extends AiProviderConfig {
  name: string
}

export interface AppSettings {
  appearance: {
    theme: ThemeMode
    sidebarCollapsedByDefault: boolean
    fontSize: 'standard' | 'large'
  }
  ai: {
    current: string
    providers: Record<AiProviderId, AiProviderConfig>
    customProviders: Record<string, CustomAiProvider>
    hiddenProviders: string[]
    extraPrompt: string
    temperature: number
    maxTokens: number
  }
  detection: {
    timeoutSec: number
    autoRunOnStart: boolean
    parallel: boolean
  }
  privacy: {
    historyEnabled: boolean
    historyRetentionDays: number
    clearHistoryOnExit: boolean
  }
}

export interface SettingsResponse {
  ok: boolean
  settings: AppSettings
}

export interface AiTestResponse {
  ok: boolean
  error?: string
  ms?: number
  reply?: string
}

export interface AiAnalyzeRequest {
  results: NormalizedIPResult[]
  consistency: string
}

export interface AiAnalyzeResponse {
  ok: boolean
  error?: string
  text?: string
  partial?: string
  provider?: string
  model?: string
  ms?: number
}

// ------------ 历史记录（userData/history.json） ------------
export interface HistorySourceSummary {
  key: string
  name: string
  ok: boolean
  durationMs?: number
  error?: string
}

export interface HistoryRecord {
  id: string
  startedAt: string
  finishedAt: string
  currentIp?: string
  successCount: number
  totalCount: number
  riskLevel?: string | null // 归一风险等级快照（低风险/中风险/高风险/严重）
  riskValue?: number | null
  netType?: string | null // 住宅 / 数据中心 / 托管
  sources: HistorySourceSummary[]
  results: NormalizedIPResult[]
  aiReport?: string
}

export interface HistoryListResponse {
  ok: boolean
  enabled: boolean // settings.privacy.historyEnabled
  records: HistoryRecord[]
}

export interface HistoryRecordResponse {
  ok: boolean
  record?: HistoryRecord
  error?: string
}

export interface HistorySaveResponse {
  ok: boolean
  id?: string
  skipped?: boolean // 历史记录被设置关闭
  error?: string
}

// ------------ 报告导出（HTML / PDF / JSON / TXT） ------------
export type ExportFormat = 'html' | 'pdf' | 'json' | 'txt'

export interface ReportSource {
  name: string
  ok: boolean
  error?: string
  ip?: string
  riskLabel?: string
  netType?: string
  durationMs?: number
}

export interface ReportModel {
  generatedAt: string
  startedAt: string
  finishedAt: string
  currentIp?: string
  successCount: number
  totalCount: number
  sources: ReportSource[]
  // 逐源人类可读明细（标签-值行），供 HTML/PDF/TXT 展示
  sourceDetails: {
    name: string
    ok: boolean
    error?: string
    durationMs?: number
    rows: { label: string; value: string }[]
  }[]
  // 多源对比矩阵：字段 × 各源取值
  matrix: { field: string; perSource: { source: string; value: string }[] }[]
  consistency: string // 多源对比文本
  fields: { label: string; value: string }[] // 聚合关键字段
  raw: { source: string; raw: unknown }[] // 各源原始结果（仅 JSON 导出使用）
  ai?: string
}

export interface ExportRequest {
  model: ReportModel
  format: ExportFormat
}

export interface ExportResponse {
  ok: boolean
  canceled?: boolean
  path?: string
  error?: string
}
