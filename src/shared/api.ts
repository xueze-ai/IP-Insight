import type { DiagEvent, DiagRun, DiagRunSummary, DiagStartRequest, DiagStartResponse, DiagStopResponse } from './diag'
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
  onDiagEvent: (cb: (e: DiagEvent) => void) => () => void

  // 设置
  getSettings: () => Promise<SettingsResponse>
  setSettings: (patch: DeepPartial<AppSettings>) => Promise<SettingsResponse>
  resetSettings: () => Promise<SettingsResponse>
  appVersion: () => Promise<string>

  // AI
  testAi: (providerId: AiProviderId | string) => Promise<AiTestResponse>
  analyzeAi: (payload: AiAnalyzeRequest) => Promise<AiAnalyzeResponse>
  onAiChunk: (cb: (delta: string) => void) => () => void
  onAiStage: (cb: (stage: string) => void) => () => void
  askAi: (payload: AiAskRequest) => Promise<AiAnalyzeResponse>
  onAskChunk: (cb: (delta: string) => void) => () => void

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
