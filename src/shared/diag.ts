// =============================================================
// IP Insight - 结构化出口诊断模型
// 规则（与 types.ts 一致）：所有字段必须来自真实测量 / 真实页面流程 /
// 真实公开接口响应。拿不到就保持 undefined / null，禁止伪造或补默认值。
//
// 0.2.3 要点：
// - 状态机新增 queued（排队）；启动即创建目标骨架，逐项事件携带完整探测项。
// - runId / detectionId（综合检测）/ 历史记录 kind 三级关联。
// - 出口 IP 归属（geo）由主进程查询公共归属 API 并随探测项保存（含来源与时间）。
// - DNS 解析区分「递归解析器出口」（ns/TXT）与「ECS 客户端网段」（ecs/ip），
//   依据 Google / Akamai 官方诊断区字段语义。
// - CDN 缓存信号按出现顺序保留（多段不合并）；节点标识保留原始完整值。
// - 单项重试以 attempts 记录历史，保留首次测量时间与重试归属。
// =============================================================

/** 探测项 / 模块 / 轮次共用的状态机 */
export type DiagStatus =
  | 'queued' // 排队（已创建骨架，等待执行）
  | 'running' // 运行中
  | 'success' // 成功
  | 'partial' // 部分成功（有成功也有失败）
  | 'failed' // 失败（无有效结果，保留真实原因）
  | 'timeout' // 超时
  | 'canceled' // 取消
  | 'skipped' // 跳过（设置关闭 / 上游依赖失败）
  | 'unsupported' // 当前环境不支持（如无 IPv6 连通性）
  | 'pending' // 未开始（模块未在本轮运行）

/** 四类出口诊断模块 */
export type DiagModuleId = 'publicIp' | 'splitTunnel' | 'cdnNode' | 'dnsExit'

/** 网络路径：主进程 net.fetch（跟随系统代理）/ Node https 强制地址族直连（不经应用层代理）/ 本机 UDP DNS / 隐藏浏览器页面 */
export type DiagVia = 'main-http' | 'node-direct' | 'dns-udp' | 'browser-page'

/** 分流目标分类 */
export type SplitCategory = 'cn' | 'intl' | 'ai' | 'dev'

/** 出口 IP 归属信息（按测得的出口 IP 查询公共归属 API；含来源与时间） */
export interface DiagGeo {
  country?: string
  region?: string
  city?: string
  isp?: string
  org?: string
  asn?: string // 形如 "AS15169"
  /** 归属数据来源（如 ip-api.com），与测量来源区分 */
  source: string
  fetchedAt: string
}

/** 有限原始证据：截断、脱敏，仅用于审计展开 */
export interface DiagEvidence {
  kind: 'http' | 'dns' | 'page'
  url?: string
  status?: number
  durationMs?: number
  /** 响应/记录片段（≤2000 字符；不含任何凭据头） */
  snippet?: string
  /** 口径备注 */
  note?: string
}

/** 一次尝试（首次测量或重试） */
export interface DiagAttempt {
  startedAt: string
  finishedAt?: string
  status: DiagStatus
  error?: string
}

/** 单个探测项：一次真实测量 */
export interface DiagProbe {
  /** 模块内唯一 */
  id: string
  /** 数据来源标识：cloudflare / google-authoritative / akamai-authoritative / cdn-target / target-site / sukka-page … */
  source: string
  /** 来源说明页 */
  sourceUrl?: string
  /** 目标服务名（splitTunnel/cdn）或解析器名（dnsExit） */
  target?: string
  /** 真正发起请求的域名 / 被查询记录 */
  targetHost?: string
  /** 实际请求 URL（详情用） */
  url?: string
  /** 测量方式（人类可读，含请求机制说明） */
  method: string
  /** 请求机制标签（i18n）：跟随系统代理的 HTTP / Node 直连 / UDP DNS / 页面流程 */
  mechKey: 'http-proxy' | 'node-direct' | 'dns-udp' | 'page'
  via: DiagVia
  /** 分流目标分类 */
  category?: SplitCategory
  status: DiagStatus
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  /** 观察到的出口 IP（仅当来源明确回显时才有值；DNS 模块为递归解析器出口） */
  ip?: string
  family?: 'ipv4' | 'ipv6' | 'unknown'
  /** 按测得出口 IP 查询的归属（与测量来源区分） */
  geo?: DiagGeo
  httpStatus?: number
  /** CDN 节点原始完整标识（如 HKG61-P1 / cache-hkg1234567-HKG，保留原文不裁剪） */
  node?: string
  /** CDN 名称 */
  cdn?: string
  /** 缓存信号（按响应中出现顺序保留全部段落，如 ["Miss from cloudfront","Hit from cloudfront"]） */
  cacheSignals?: string[]
  /** DNS：应答中的全部 TXT 记录（保留记录与字符段边界） */
  dnsRecords?: string[]
  /** DNS：递归出口来源字段（ns= Akamai ns 段；txt= Google 裸 IP 记录） */
  exitSource?: 'ns' | 'txt'
  /** DNS：EDNS Client Subnet 网段（客户端网段，不是解析器出口） */
  ecsSubnet?: string
  /** DNS：ECS 网段中的代表地址（Akamai ip 段；不计作解析器出口） */
  ecsRep?: string
  /** DNS：实际连接的解析器服务器地址（udp4/udp6 依据此地址选择） */
  serverAddr?: string
  /** DNS：系统配置解析器 / 指定公共 DNS */
  resolverKind?: 'system' | 'public'
  /** 真实错误原因 */
  error?: string
  /** 首次尝试与重试历史（最新一次的结果为当前展示值） */
  attempts?: DiagAttempt[]
  evidence?: DiagEvidence[]
}

/** 一个诊断模块（由若干探测项聚合） */
export interface DiagModule {
  id: DiagModuleId
  status: DiagStatus
  startedAt?: string
  finishedAt?: string
  probes: DiagProbe[]
  error?: string
}

/** 一轮诊断 */
export interface DiagRun {
  runId: string
  /** 关联的综合检测 ID（综合检测附带的轻量查询时填写；手动完整诊断为空） */
  detectionId?: string
  startedAt: string
  finishedAt?: string
  status: DiagStatus
  /** 结束原因 */
  finishedReason?: 'completed' | 'canceled' | 'timeout'
  /** 触发来源：dashboard（综合检测附带轻量查询）/ network（出口诊断页手动） */
  origin: 'dashboard' | 'network'
  modules: DiagModule[]
}

export interface DiagStartRequest {
  modules: DiagModuleId[]
  origin: 'dashboard' | 'network'
  detectionId?: string
}

export interface DiagStartResponse {
  ok: boolean
  runId?: string
  /** 启动即返回的完整骨架（全部探测项 queued），供页面立即逐行渲染 */
  run?: DiagRun
  error?: string
}

export interface DiagStopResponse {
  ok: boolean
  error?: string
}

export interface DiagRetryRequest {
  runId: string
  probeIds: string[]
}

export interface DiagRetryResponse {
  ok: boolean
  error?: string
}

/** 诊断过程事件（进度推送；probe 事件携带完整探测项） */
export type DiagEvent =
  | { kind: 'run'; runId: string; status: DiagStatus; finishedReason?: DiagRun['finishedReason'] }
  | { kind: 'module'; runId: string; moduleId: DiagModuleId; status: DiagStatus }
  | { kind: 'probe'; runId: string; moduleId: DiagModuleId; probe: DiagProbe }

/** 探测项摘要（历史记录 / 报告用；归属等字段完整随摘要保存） */
export interface DiagProbeSummary {
  id: string
  source: string
  sourceUrl?: string
  url?: string
  startedAt?: string
  finishedAt?: string
  target?: string
  targetHost?: string
  method: string
  mechKey: DiagProbe['mechKey']
  via: DiagVia
  category?: SplitCategory
  status: DiagStatus
  ip?: string
  family?: DiagProbe['family']
  geo?: DiagGeo
  node?: string
  cdn?: string
  cacheSignals?: string[]
  httpStatus?: number
  durationMs?: number
  dnsRecords?: string[]
  exitSource?: DiagProbe['exitSource']
  ecsSubnet?: string
  ecsRep?: string
  serverAddr?: string
  resolverKind?: DiagProbe['resolverKind']
  error?: string
  attempts?: DiagAttempt[]
}

export interface DiagRunSummary {
  runId: string
  startedAt: string
  finishedAt?: string
  status: DiagStatus
  finishedReason?: DiagRun['finishedReason']
  origin: DiagRun['origin']
  moduleStatus: Partial<Record<DiagModuleId, DiagStatus>>
  probes: Record<DiagModuleId, DiagProbeSummary[]>
  stats: { sources: number; probes: number; ok: number }
}

/** 轻量摘要（AI / 导出 / 历史列表用）：有界，不含 raw 证据全文 */
export interface DiagAiSummary {
  runId: string
  startedAt: string
  finishedAt?: string
  status: DiagStatus
  modules: {
    id: DiagModuleId
    status: DiagStatus
    lines: string[]
  }[]
}
