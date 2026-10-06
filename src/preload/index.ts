import { contextBridge, ipcRenderer } from 'electron'
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

// =============================================================
// Preload - 通过 contextBridge 安全地向渲染层暴露最小 API。
// 渲染层不直接接触 Node / Electron，仅能调用此处显式暴露的方法。
// =============================================================

const api = {
  // 运行 Ping0 检测
  detectPing0: (): Promise<NormalizedIPResult> =>
    ipcRenderer.invoke('detect:ping0'),

  // 运行 Net.Coffee 检测
  detectNetcoffee: (): Promise<NormalizedIPResult> =>
    ipcRenderer.invoke('detect:netcoffee'),

  // 运行 Net.Coffee GPT 检测
  detectNetcoffeeGpt: (): Promise<NormalizedIPResult> =>
    ipcRenderer.invoke('detect:netcoffee_gpt'),

  // 运行 IPPure 检测
  detectIppure: (): Promise<NormalizedIPResult> =>
    ipcRenderer.invoke('detect:ippure'),

  // 运行本机测速（Cloudflare）
  detectSpeedtest: (): Promise<NormalizedIPResult> =>
    ipcRenderer.invoke('detect:speedtest'),

  // 拉取 Net.Coffee 服务状态聚合
  fetchServiceStatus: (): Promise<ServiceStatusResponse> =>
    ipcRenderer.invoke('fetch:serviceStatus'),

  // 本机可达性实测
  probeReachability: (): Promise<ReachabilityResponse> =>
    ipcRenderer.invoke('probe:reachability'),

  // 设置读写
  getSettings: (): Promise<SettingsResponse> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: DeepPartial<AppSettings>): Promise<SettingsResponse> =>
    ipcRenderer.invoke('settings:set', patch),
  resetSettings: (): Promise<SettingsResponse> => ipcRenderer.invoke('settings:reset'),
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  // AI
  testAi: (providerId: string): Promise<AiTestResponse> =>
    ipcRenderer.invoke('ai:test', providerId),
  analyzeAi: (payload: AiAnalyzeRequest): Promise<AiAnalyzeResponse> =>
    ipcRenderer.invoke('ai:analyze', payload),

  // 订阅 AI 流式输出片段；返回取消订阅函数
  onAiChunk: (cb: (delta: string) => void): (() => void) => {
    const listener = (_event: unknown, delta: string): void => cb(delta)
    ipcRenderer.on('ai:chunk', listener)
    return () => ipcRenderer.removeListener('ai:chunk', listener)
  },

  // 订阅 AI 阶段事件（connected=已连上提供商 / streaming=开始输出）
  onAiStage: (cb: (stage: string) => void): (() => void) => {
    const listener = (_event: unknown, stage: string): void => cb(stage)
    ipcRenderer.on('ai:stage', listener)
    return () => ipcRenderer.removeListener('ai:stage', listener)
  },

  // 历史记录
  listHistory: (): Promise<HistoryListResponse> => ipcRenderer.invoke('history:list'),
  getHistory: (id: string): Promise<HistoryRecordResponse> =>
    ipcRenderer.invoke('history:get', id),
  saveHistory: (record: HistoryRecord): Promise<HistorySaveResponse> =>
    ipcRenderer.invoke('history:save', record),
  updateHistoryAi: (id: string, aiReport: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('history:updateAi', id, aiReport),
  deleteHistory: (id: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('history:delete', id),
  clearHistory: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('history:clear'),

  // 报告导出
  exportReport: (payload: ExportRequest): Promise<ExportResponse> =>
    ipcRenderer.invoke('export:report', payload),
  revealFile: (path: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('export:reveal', path),

  // 在软件内部打开原始数据源网站
  openSource: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('open:source', url),

  // 订阅检测过程日志；返回取消订阅函数
  onDetectLog: (cb: (message: string) => void): (() => void) => {
    const listener = (_event: unknown, message: string): void => cb(message)
    ipcRenderer.on('detect:log', listener)
    return () => ipcRenderer.removeListener('detect:log', listener)
  },

  // 自动更新：手动检查 / 下载完成后重启安装 / 订阅更新状态
  checkForUpdates: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('update:check'),
  quitAndInstall: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('update:quitAndInstall'),
  onUpdateStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: unknown, status: UpdateStatus): void => cb(status)
    ipcRenderer.on('update:status', listener)
    return () => ipcRenderer.removeListener('update:status', listener)
  }
}

contextBridge.exposeInMainWorld('ipInsight', api)

export type IPInsightAPI = typeof api
