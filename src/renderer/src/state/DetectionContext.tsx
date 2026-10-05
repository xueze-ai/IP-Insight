import { createContext, useContext } from 'react'
import type { JSX, ReactNode } from 'react'
import { useDetection } from '../hooks/useDetection'

// 检测状态顶层容器：让 Dashboard、IP 信息、风险、AI 等所有页面共享同一次检测结果，
// 避免切换页面时 Dashboard 卸载导致数据丢失。

interface DetectionValue extends ReturnType<typeof useDetection> {}

const DetectionContext = createContext<DetectionValue | null>(null)

export function DetectionProvider({
  children
}: {
  children: ReactNode
}): JSX.Element {
  const value = useDetection()
  return (
    <DetectionContext.Provider value={value}>
      {children}
    </DetectionContext.Provider>
  )
}

export function useDetectionContext(): DetectionValue {
  const ctx = useContext(DetectionContext)
  if (!ctx)
    throw new Error('useDetectionContext must be used within DetectionProvider')
  return ctx
}
