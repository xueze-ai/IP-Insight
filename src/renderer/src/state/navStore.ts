import type { PageId } from '../navigation'

// =============================================================
// 跨页导航请求：子页面请求切换顶层页面（可附带设置页分区）。
// App 订阅后调用 setPage / 设置分区。
// =============================================================

export type SettingsSection = 'appearance' | 'ai' | 'detection' | 'privacy' | 'about'

type NavListener = (page: PageId, section?: SettingsSection) => void

const listeners = new Set<NavListener>()

export function requestNav(page: PageId, section?: SettingsSection): void {
  listeners.forEach((l) => l(page, section))
}

export function subscribeNav(l: NavListener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
