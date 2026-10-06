import { enCommon } from './dict/en/common'
import { enSettings } from './dict/en/settings'
import { enDashboard } from './dict/en/dashboard'
import { enIpinfo } from './dict/en/ipinfo'
import { enNetwork } from './dict/en/network'
import { enRisk } from './dict/en/risk'
import { enFingerprint } from './dict/en/fingerprint'
import { enAi } from './dict/en/ai'
import { enHistory } from './dict/en/history'
import { enComponents } from './dict/en/components'
import { enMisc } from './dict/en/misc'
import type { Dict } from './zh'

// 英文字典必须与中文典完全同构，缺 key 在这里编译报错。
export const en: Dict = {
  common: enCommon,
  settings: enSettings,
  dashboard: enDashboard,
  ipinfo: enIpinfo,
  network: enNetwork,
  risk: enRisk,
  fingerprint: enFingerprint,
  ai: enAi,
  history: enHistory,
  components: enComponents,
  misc: enMisc
}
