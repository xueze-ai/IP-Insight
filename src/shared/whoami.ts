import type { DiagGeo } from './diag'

// =============================================================
// 「网站眼里的你」数据模型
//
// 原则（与全项目一致）：
// · 每一项都来自真实读取或真实请求；读不到就标 unavailable，不猜、不补默认值。
// · 采集拆两层：
//     主进程：服务器侧能看到的东西（出口 IP、TLS、HTTP 版本、DNS 递归出口…）
//     渲染层：浏览器 JS 能读到的本机信息（屏幕、GPU、字体、Canvas…）
//   两层各自产出 WhoRawItem，由页面按目录合并展示。
// · id 稳定：目录（标签 / 说明 / 分组）放在渲染层，主进程只回值，便于中英双语与排序。
// =============================================================

/** 单项读取状态：ok=读到；partial=读到但不完整；unavailable=本次环境读不到；error=读取出错 */
export type WhoStatus = 'ok' | 'partial' | 'unavailable' | 'error'

/** 一条原始读数（不含展示文案） */
export interface WhoRawItem {
  id: string
  value: string | null
  /** 补充说明（原始值片段 / 口径），可为空 */
  detail?: string
  /** 读取方式，如 "navigator.userAgent"、"cdn-cgi/trace / tls" */
  source: string
  status: WhoStatus
}

/** 出口 IP 归属（在 DiagGeo 基础上补充「网站用来判断你在哪」的字段） */
export interface WhoGeo extends DiagGeo {
  timezone?: string
  lat?: number
  lon?: number
  /** 归属库标记：是否被判定为代理 */
  proxy?: boolean
  /** 归属库标记：是否机房 / 数据中心 IP */
  hosting?: boolean
  /** 归属库标记：是否移动网络 */
  mobile?: boolean
  reverse?: string
  asname?: string
}

/** DNS 递归出口探测（系统解析器 / 参考公共解析器各一条） */
export interface WhoDnsProbe {
  /** 展示名（如「系统配置解析器」） */
  name: string
  /** 实际连接的服务器地址 */
  server: string
  /** 查询的诊断区 */
  zone: string
  /** 权威侧看到的递归出口 */
  exitIp?: string
  family?: 'ipv4' | 'ipv6'
  /** ECS 客户端网段（不代表解析器出口） */
  ecs?: string
  records?: string[]
  status: WhoStatus
  error?: string
  durationMs?: number
}

/** 多个站点看到的出口（用于判断是否存在分流） */
export interface WhoEgressSample {
  host: string
  url: string
  ip?: string
  family?: 'ipv4' | 'ipv6'
  colo?: string
  country?: string
  durationMs?: number
  status: WhoStatus
  error?: string
}

export interface WhoServerFacts {
  /** /cdn-cgi/trace 原始键值（保留原文，供详情展开） */
  trace?: Record<string, string>
  geo?: WhoGeo | null
  ipv6?: string | null
  ipv6Status?: WhoStatus
  dns: WhoDnsProbe[]
  /** 本机配置的 DNS 服务器（来自系统，不代表浏览器实际使用哪台） */
  dnsServers: string[]
  egress: WhoEgressSample[]
  latencyMs?: number
  latencySamples?: number[]
  /** 本机时钟与服务器 ts 的偏差（秒级精度） */
  clockSkewMs?: number
  /** 是否命中公开 Tor 出口节点列表（null = 列表未能获取） */
  torExit?: boolean | null
  /** Node 直连观测到的 TLS 密码套件（与 trace 的 tls 字段互补） */
  tlsCipher?: string
  tlsAlpn?: string
}

export interface WhoServerReport {
  ok: boolean
  error?: string
  collectedAt: string
  items: WhoRawItem[]
  facts: WhoServerFacts
}

export interface WhoServerRequest {
  lang?: 'zh' | 'en'
  /** 由页面传入当前浏览器 UA / 语言：让服务端看到的请求头与本应用内浏览器一致 */
  userAgent?: string
  acceptLanguage?: string
}

// ---------------- 网络工具箱 ----------------

/** 路由追踪的一跳 */
export interface TraceHop {
  hop: number
  /** 本次三组探测中成功的往返时延（毫秒，按出现顺序） */
  rtt: number[]
  ip?: string
  /** 该跳全部探测都超时 */
  timeout: boolean
}

export interface TracerouteResult {
  ok: boolean
  target: string
  startedAt: string
  finishedAt: string
  durationMs: number
  hops: TraceHop[]
  error?: string
}

export type CheckStatus = 'ok' | 'warn' | 'fail'

export interface DiagnosticCheck {
  id: string
  status: CheckStatus
  /** 可读结果（如 "12 ms" / "1500"） */
  value?: string
  ms?: number
  note?: string
}

export interface DiagnosticReport {
  ok: boolean
  startedAt: string
  finishedAt: string
  durationMs: number
  checks: DiagnosticCheck[]
  error?: string
}

export interface CdnRadarEntry {
  cdn: string
  host: string
  url: string
  node?: string
  cache?: string
  status: WhoStatus
  ms?: number
  httpStatus?: number
  error?: string
}

export interface CdnRadarReport {
  ok: boolean
  startedAt: string
  finishedAt: string
  durationMs: number
  entries: CdnRadarEntry[]
  error?: string
}
