import type { IPInsightAPI } from '@shared/api'

// 渲染层全局声明：与 preload 暴露的 API 保持一致
// （接口定义在 @shared/api，preload 与此处引用同一份类型事实来源）。
declare global {
  interface Window {
    ipInsight: IPInsightAPI
  }
}

export {}
