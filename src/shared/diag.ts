// =============================================================
// IP Insight - 结构化出口诊断模型（0.2.2 新增）
// 规则（与 types.ts 一致）：所有字段必须来自真实测量 / 真实页面流程 /
// 真实公开接口响应。拿不到就保持 undefined / null，禁止伪造或补默认值。
//
// 设计要点：
// - runId 标识一轮诊断；迟到/取消轮次的结果不得覆盖当前轮。
// - 单项失败只影响该探测项，不丢弃其他成功数据。
// - 状态机区分：未开始/运行中/成功/部分成功/失败/超时/取消/跳过/不支持。
// - 不同目标、不同地址族的出口差异不是冲突；不据此自动判异常。
// - raw 证据限制大小并脱敏；不保存 Cookie / 授权头 / API Key / 会话令牌。
// =============================================================

/** 探测项 / 模块 / 轮次共用的状态机 */
export type DiagStatus =
  | 'pending' // 未开始
  | 'running' // 运行中
  | 'success' // 成功（全部探测项完成且有效）
  | 'partial' // 部分成功（有成功也有失败）
  | 'failed' // 失败（无有效结果，保留真实原因）
  | 'timeout' // 超时
  | 'canceled' // 用户取消
  | 'skipped' // 跳过（设置关闭 / 上游依赖失败）
  | 'unsupported' // 当前环境不支持（如无 IPv6 连通性）

/** 四类出口诊断模块 */
export type DiagModuleId = 'publicIp' | 'splitTunnel' | 'cdnNode' | 'dnsExit'

/** 网络路径：主进程 net.fetch（走系统代理）/ 隐藏页浏览器请求 / 本机 UDP 53 直接查询权威，行为可能不同，必须如实记录 */
export type DiagVia = 'main-http' | 'browser-page' | 'dns-udp'

/** 有限原始证据：截断、脱敏，仅用于审计展开 */
export interface DiagEvidence {
  kind: 'http' | 'dns' | 'page'
  url?: string
  status?: number
  durationMs?: number
  /** 响应/记录片段（≤2000 字符；不含任何凭据头） */
  snippet?: string
  /** 口径备注，例如“opaque 响应不可读，仅证明请求已发出” */
  note?: string
}

/** 单个探测项：一次真实测量 */
export interface DiagProbe {
  /** 模块内唯一，如 cloudflare-trace / chatgpt-trace / whoami-cloudflare@1.1.1.1 */
  id: string
  /** 数据来源标识（真实来源，不冒充）：cloudflare / sukkapage / perfops / ip.sb / dns-authoritative */
  source: string
  /** 来源说明页 */
  sourceUrl?: string
  /** 目标服务名（splitTunnel/cdn 模块）或被查询的权威区（dnsExit） */
  target?: string
  /** 真正发起请求的域名 / 被查询记录 */
  targetHost?: string
  /** 测量方式：HTTP GET / DNS TXT / 页面提取 … */
  method: string
  /** 实际网络路径 */
  via: DiagVia
  status: DiagStatus
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  /** 观察到的出口 IP（仅当来源明确回显时才有值） */
  ip?: string
  family?: 'ipv4' | 'ipv6' | 'unknown'
  /** 来源提供的归属信息（原样保留，不代表精确物理位置） */
  country?: string
  city?: string
  isp?: string
  asn?: string
  /** CDN 节点原始代码 / 标识（不推断城市） */
  node?: string
  /** CDN 名称（cdnNode 模块） */
  cdn?: string
  httpStatus?: number
  /** 真实错误原因 */
  error?: string
  evidence?: DiagEvidence[]
}

/** 一个诊断模块（由若干探测项聚合） */
export interface DiagModule {
  id: DiagModuleId
  status: DiagStatus
  startedAt?: string
  finishedAt?: string
  probes: DiagProbe[]
  /** 模块级口径说明键（渲染层翻译）：如 “DNS 出口与 HTTP 出口不同” */
  noteKeys?: string[]
  error?: string
}

/** 一轮诊断 */
export interface DiagRun {
  runId: string
  startedAt: string
  finishedAt?: string
  status: DiagStatus
  /** 触发来源：dashboard（综合检测附带轻量查询）/ network（网络质量页手动） */
  origin: 'dashboard' | 'network'
  modules: DiagModule[]
}

export interface DiagStartRequest {
  modules: DiagModuleId[]
  origin: 'dashboard' | 'network'
}

export interface DiagStartResponse {
  ok: boolean
  runId?: string
  error?: string
}

export interface DiagStopResponse {
  ok: boolean
  error?: string
}

/** 诊断过程事件（进度推送） */
export interface DiagEvent {
  runId: string
  moduleId: DiagModuleId
  probeId?: string
  status: DiagStatus
  message?: string
}

/** 探测项摘要（历史记录 / 报告用） */
export interface DiagProbeSummary {
  id: string
  source: string
  target?: string
  method: string
  via: DiagVia
  status: DiagStatus
  ip?: string
  family?: DiagProbe['family']
  node?: string
  cdn?: string
  httpStatus?: number
  durationMs?: number
  error?: string
}

export interface DiagRunSummary {
  runId: string
  startedAt: string
  finishedAt?: string
  status: DiagStatus
  origin: DiagRun['origin']
  /** 各模块状态 */
  moduleStatus: Partial<Record<DiagModuleId, DiagStatus>>
  /** 模块 → 探测项摘要 */
  probes: Record<DiagModuleId, DiagProbeSummary[]>
  /** 探测项计数统计（来源数 / 探测项数 / 成功率分别统计） */
  stats: { sources: number; probes: number; ok: number }
}

/** 轻量摘要（AI / 导出 / 历史列表用）：有界，不含 raw 证据全文 */
export interface DiagAiSummary {
  runId: string
  startedAt: string
  finishedAt?: string
  status: DiagStatus
  /** 各模块一句话状态 */
  modules: {
    id: DiagModuleId
    status: DiagStatus
    /** 简明事实行，如 “ChatGPT 出口 1.2.3.4；GitHub 不可达（超时）” */
    lines: string[]
  }[]
}
