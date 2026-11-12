import type { WhoRawItem } from '@shared/whoami'

// =============================================================
// 指纹稳定性（本机历史对比）
//
// 只和「这台机器上一次的记录」比：网站想不用 Cookie 就认出你，
// 就需要这些分项保持不变。这里不声称全球稀有度（没有公共样本库），
// 也从不把读数发出去 —— 全部写在 localStorage。
// =============================================================

const KEY = 'ipinsight.whoami.lastFingerprint.v1'

export interface FpComponent {
  probeId: string
  zh: string
  en: string
}

export const FP_COMPONENTS: FpComponent[] = [
  { probeId: 'fp.canvas', zh: 'Canvas', en: 'Canvas' },
  { probeId: 'fp.webgl', zh: 'WebGL', en: 'WebGL' },
  { probeId: 'fp.audio', zh: '音频', en: 'Audio' },
  { probeId: 'fp.fontList', zh: '字体列表', en: 'Fonts' },
  { probeId: 'device.screen', zh: '屏幕', en: 'Screen' },
  { probeId: 'locale.timezone', zh: '系统时区', en: 'Timezone' },
  { probeId: 'locale.browserLanguage', zh: '浏览器语言', en: 'Language' }
]

export interface FpStability {
  total: number
  unchanged: number
  changed: FpComponent[]
  firstVisit: boolean
  previousAt?: string
  id: string
  previousId?: string
}

interface Stored {
  at: string
  id: string
  parts: Record<string, string>
}

function readStore(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as Stored
    if (!j || typeof j !== 'object' || !j.parts) return null
    return j
  } catch {
    return null
  }
}

function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** 由本次读数算出指纹 ID，并与上一次保存的分项逐一对比 */
export function fingerprintStability(
  readings: WhoRawItem[],
  persist: boolean
): FpStability {
  const map = new Map(readings.map((r) => [r.id, r]))
  const parts: Record<string, string> = {}
  for (const c of FP_COMPONENTS) {
    const v = map.get(c.probeId)?.value
    parts[c.probeId] = v == null ? '' : String(v)
  }
  const id = fnv(FP_COMPONENTS.map((c) => parts[c.probeId]).join('#'))

  const prev = readStore()
  const changed = prev
    ? FP_COMPONENTS.filter((c) => (prev.parts[c.probeId] ?? '') !== parts[c.probeId])
    : []
  const result: FpStability = {
    total: FP_COMPONENTS.length,
    unchanged: prev ? FP_COMPONENTS.length - changed.length : 0,
    changed,
    firstVisit: !prev,
    previousAt: prev?.at,
    id,
    previousId: prev?.id
  }

  if (persist) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: new Date().toISOString(), id, parts } satisfies Stored))
    } catch {
      /* 存储不可用时只影响对比，不影响本次读数 */
    }
  }
  return result
}

/** 清掉历史记录，下次重新建立基线 */
export function resetFingerprintBaseline(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}
