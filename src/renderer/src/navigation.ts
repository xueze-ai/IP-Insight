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

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
}

export const NAV_MAIN: NavItem[] = [
  { id: 'dashboard', label: '综合检测', icon: LayoutDashboard },
  { id: 'ipInfo', label: 'IP 信息', icon: Network },
  { id: 'networkQuality', label: '网络质量', icon: Activity },
  { id: 'risk', label: '风险分析', icon: ShieldAlert },
  { id: 'fingerprint', label: '浏览器指纹', icon: Fingerprint },
  { id: 'ai', label: 'AI 分析', icon: Sparkles },
  { id: 'history', label: '历史记录', icon: History }
]

export const NAV_BOTTOM: NavItem[] = [
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'about', label: '关于', icon: Info }
]
