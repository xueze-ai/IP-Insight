import { useCallback, useEffect, useState } from 'react'
import type { ThemeMode } from '@shared/types'

// =============================================================
// 主题：light / dark / system（跟随系统）
// 首帧用 localStorage 缓存避免闪烁；挂载后与设置（settings.json）对齐；
// 设置页修改后经 IPC 持久化并广播给所有 useTheme 实例。
// =============================================================

const KEY = 'ipi-theme'
const listeners = new Set<(t: ThemeMode) => void>()

function readCache(): ThemeMode {
  const v = localStorage.getItem(KEY)
  return v === 'dark' || v === 'system' ? v : 'light'
}

function effectiveOf(t: ThemeMode): 'light' | 'dark' {
  if (t !== 'system') return t
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(readCache)
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => effectiveOf(readCache()))

  // 应用主题 + 监听系统偏好变化（system 模式）
  useEffect(() => {
    const apply = (): void => setResolved(effectiveOf(theme))
    apply()
    document.documentElement.setAttribute('data-theme', effectiveOf(theme))
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  // 其他实例（设置页）变更时同步
  useEffect(() => {
    const l = (t: ThemeMode): void => setThemeState(t)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  // 挂载后与持久化设置对齐（设置为准）
  useEffect(() => {
    let on = true
    window.ipInsight
      .getSettings()
      .then((r) => {
        const t = r.settings?.appearance?.theme
        if (on && t && t !== localStorage.getItem(KEY)) setTheme(t)
      })
      .catch(() => undefined)
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = useCallback((t: ThemeMode) => {
    localStorage.setItem(KEY, t)
    setThemeState(t)
    listeners.forEach((l) => l(t))
    void window.ipInsight
      .setSettings({ appearance: { theme: t } })
      .catch(() => undefined)
  }, [])

  const toggle = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme]
  )

  return { theme, resolved, setTheme, toggle }
}
