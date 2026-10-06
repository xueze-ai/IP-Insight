import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Fingerprint,
  History,
  Info,
  LayoutDashboard,
  Network,
  Settings,
  ShieldAlert,
  Sparkles
} from 'lucide-react'
import type { TKey } from './i18n'

export type PageId =
  | 'dashboard'
  | 'ipInfo'
  | 'networkQuality'
  | 'risk'
  | 'fingerprint'
  | 'ai'
  | 'history'
  | 'settings'
  | 'about'

// 导航文案复用 common 命名空间（common.nav.*），渲染时由调用方 t(labelKey)。
export interface NavItem {
  id: PageId
  labelKey: TKey
  icon: LucideIcon
}

export const NAV_MAIN: NavItem[] = [
  { id: 'dashboard', labelKey: 'common.nav.dashboard', icon: LayoutDashboard },
  { id: 'ipInfo', labelKey: 'common.nav.ipInfo', icon: Network },
  { id: 'networkQuality', labelKey: 'common.nav.network', icon: Activity },
  { id: 'risk', labelKey: 'common.nav.risk', icon: ShieldAlert },
  { id: 'fingerprint', labelKey: 'common.nav.fingerprint', icon: Fingerprint },
  { id: 'ai', labelKey: 'common.nav.ai', icon: Sparkles },
  { id: 'history', labelKey: 'common.nav.history', icon: History }
]

export const NAV_BOTTOM: NavItem[] = [
  { id: 'settings', labelKey: 'common.nav.settings', icon: Settings },
  { id: 'about', labelKey: 'common.nav.about', icon: Info }
]
