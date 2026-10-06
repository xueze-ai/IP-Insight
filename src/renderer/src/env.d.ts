import type {
  AiAnalyzeRequest,
  AiAnalyzeResponse,
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
} from '@shared/types'

// 渲染层全局声明：与 preload 暴露的 API 保持一致
export interface IPInsightAPI {
  detectPing0: () => Promise<NormalizedIPResult>
  detectNetcoffee: () => Promise<NormalizedIPResult>
  detectNetcoffeeGpt: () => Promise<NormalizedIPResult>
  detectIppure: () => Promise<NormalizedIPResult>
  detectSpeedtest: () => Promise<NormalizedIPResult>
  fetchServiceStatus: () => Promise<ServiceStatusResponse>
  probeReachability: () => Promise<ReachabilityResponse>
  getSettings: () => Promise<SettingsResponse>
  setSettings: (patch: DeepPartial<AppSettings>) => Promise<SettingsResponse>
  resetSettings: () => Promise<SettingsResponse>
  appVersion: () => Promise<string>
  testAi: (providerId: string) => Promise<AiTestResponse>
  analyzeAi: (payload: AiAnalyzeRequest) => Promise<AiAnalyzeResponse>
  onAiChunk: (cb: (delta: string) => void) => () => void
  onAiStage: (cb: (stage: string) => void) => () => void
  listHistory: () => Promise<HistoryListResponse>
  getHistory: (id: string) => Promise<HistoryRecordResponse>
  saveHistory: (record: HistoryRecord) => Promise<HistorySaveResponse>
  updateHistoryAi: (id: string, aiReport: string) => Promise<{ ok: boolean }>
  deleteHistory: (id: string) => Promise<{ ok: boolean }>
  clearHistory: () => Promise<{ ok: boolean }>
  exportReport: (payload: ExportRequest) => Promise<ExportResponse>
  revealFile: (path: string) => Promise<{ ok: boolean }>
  openSource: (url: string) => Promise<boolean>
  onDetectLog: (cb: (message: string) => void) => () => void
  checkForUpdates: () => Promise<{ ok: boolean }>
  quitAndInstall: () => Promise<{ ok: boolean }>
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void
}

declare global {
  interface Window {
    ipInsight: IPInsightAPI
  }
}

export {}
