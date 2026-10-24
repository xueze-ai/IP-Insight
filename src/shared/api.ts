import type {
  DiagEvent,
  DiagRetryRequest,
  DiagRetryResponse,
  DiagRun,
  DiagRunSummary,
  DiagStartRequest,
  DiagStartResponse,
  DiagStopResponse
} from './diag'
import type {
  AiAnalyzeRequest,
  AiAnalyzeResponse,
  AiAskRequest,
  AiProviderId,
  AiTestResponse,
  AppSettings,
  DeepPartial,
  ExportRequest,
  ExportResponse,
  HistoryListResponse,
  HistoryRecord,
  HistoryRecordResponse,
  HistorySaveResponse,
  NormalizedIPResult,
  ReachabilityResponse,
  ServiceStatusResponse,
  SettingsResponse,
  UpdateStatus
} from './types'

// =============================================================
// 渲染层可用 API 的唯一类型事实来源：
// · preload/index.ts 以此类型约束暴露的对象（实现不符即编译错误）
// · renderer/env.d.ts 以此声明 window.ipInsight
// 两处引用同一份定义，避免手工同步漂移。
// =============================================================

export interface IPInsightAPI {
  // 检测
  detectPing0: () => Promise<NormalizedIPResult>
  detectNetcoffee: () => Promise<NormalizedIPResult>
  detectNetcoffeeGpt: () => Promise<NormalizedIPResult>
  detectIppure: () => Promise<NormalizedIPResult>
  detectSpeedtest: () => Promise<NormalizedIPResult>
  fetchServiceStatus: () => Promise<ServiceStatusResponse>
  probeReachability: () => Promise<ReachabilityResponse>

  // 出口诊断（Sukka 模块）
  startDiag: (req: DiagStartRequest) => Promise<DiagStartResponse>
  stopDiag: (runId?: string) => Promise<DiagStopResponse>
  latestDiag: () => Promise<{ ok: boolean; run: DiagRun | null; summary: DiagRunSummary | null }>
  /** 按 runId 获取指定轮次（综合检测关联等待 / 页面恢复） */
  getDiag: (runId: string) => Promise<{ ok: boolean; run: DiagRun | null; summary: DiagRunSummary | null }>
  /** 单项重试（不清空其他结果；保留尝试历史） */
  retryDiag: (req: DiagRetryRequest) => Promise<DiagRetryResponse>
  // 订阅诊断进度事件（probe 事件携带完整探测项）；返回取消订阅函数
  onDiagEvent: (cb: (e: DiagEvent) => void) => () => void

  // 设置
  getSettings: () => Promise<SettingsResponse>
  setSettings: (patch: DeepPartial<AppSettings>) => Promise<SettingsResponse>
  resetSettings: () => Promise<SettingsResponse>
  appVersion: () => Promise<string>

  // AI
  testAi: (providerId: AiProviderId | string) => Promise<AiTestResponse>
  analyzeAi: (payload: AiAnalyzeRequest) => Promise<AiAnalyzeResponse>
  /** 流式片段携带请求 ID：与发起请求绑定，切换视图后旧请求不污染新视图 */
  onAiChunk: (cb: (e: { reqId?: string; delta: string }) => void) => () => void
  onAiStage: (cb: (e: { reqId?: string; stage: string }) => void) => () => void
  askAi: (payload: AiAskRequest) => Promise<AiAnalyzeResponse>
  onAskChunk: (cb: (e: { reqId?: string; delta: string }) => void) => () => void

  // 历史
  listHistory: () => Promise<HistoryListResponse>
  getHistory: (id: string) => Promise<HistoryRecordResponse>
  saveHistory: (record: HistoryRecord) => Promise<HistorySaveResponse>
  updateHistoryAi: (id: string, aiReport: string) => Promise<{ ok: boolean }>
  deleteHistory: (id: string) => Promise<{ ok: boolean }>
  clearHistory: () => Promise<{ ok: boolean }>

  // 报告导出
  exportReport: (payload: ExportRequest) => Promise<ExportResponse>
  revealFile: (path: string) => Promise<{ ok: boolean }>

  // 通用
  openSource: (url: string) => Promise<boolean>
  onDetectLog: (cb: (message: string) => void) => () => void
  checkForUpdates: () => Promise<{ ok: boolean }>
  quitAndInstall: () => Promise<{ ok: boolean }>
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void
}
