import { zhCommon } from './dict/zh/common'
import { zhSettings } from './dict/zh/settings'
import { zhDashboard } from './dict/zh/dashboard'
import { zhIpinfo } from './dict/zh/ipinfo'
import { zhNetwork } from './dict/zh/network'
import { zhRisk } from './dict/zh/risk'
import { zhFingerprint } from './dict/zh/fingerprint'
import { zhAi } from './dict/zh/ai'
import { zhHistory } from './dict/zh/history'
import { zhComponents } from './dict/zh/components'
import { zhMisc } from './dict/zh/misc'
import type { LeafKeys } from './types'

// 中文字典为唯一事实来源：en.ts 用 `en: Dict` 约束，缺 key 编译报错。
export const zh = {
  common: zhCommon,
  settings: zhSettings,
  dashboard: zhDashboard,
  ipinfo: zhIpinfo,
  network: zhNetwork,
  risk: zhRisk,
  fingerprint: zhFingerprint,
  ai: zhAi,
  history: zhHistory,
  components: zhComponents,
  misc: zhMisc
} as const

export type Dict = typeof zh
export type TKey = LeafKeys<Dict>
