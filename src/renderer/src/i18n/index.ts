import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { zh } from './zh'
import { en } from './en'
import type { Dict, TKey } from './zh'
import type { Lang, Params } from './types'

export type { Lang, Params, TKey }

// =============================================================
// i18n：字典式中英双语。
// - 组件内：const { t } = useLang()，然后 t('network.title') / t('ai.askHint', { n: 3 })
// - 非组件（utils/stores）：import { tt } from '../i18n'，tt('misc.xxx')
// - 字典在 ./dict/zh|en/<模块>.ts，英文必须与中文同构（类型约束）
// - 占位符写法：字典里写 '发现 {n} 个问题'，调用 t('k', { n: 3 })
// =============================================================

const dicts: Record<Lang, Dict> = { zh, en }

let currentLang: Lang = 'zh'

function lookup(lang: Lang, key: string): string | undefined {
  const parts = key.split('.')
  let node: unknown = dicts[lang]
  for (const p of parts) {
    if (node == null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[p]
  }
  return typeof node === 'string' ? node : undefined
}

function applyParams(s: string, params?: Params): string {
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (_, k: string) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  )
}

export function translate(lang: Lang, key: TKey, params?: Params): string {
  const s = lookup(lang, key) ?? lookup('zh', key)
  if (s === undefined) return key
  return applyParams(s, params)
}

/** 非组件环境用的翻译函数（语言由 LangProvider 同步进来）。 */
export function tt(key: TKey, params?: Params): string {
  return translate(currentLang, key, params)
}

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey, params?: Params) => string
}

const Ctx = createContext<LangCtx>({
  lang: 'zh',
  setLang: () => undefined,
  t: (k, p) => translate('zh', k, p)
})

export function LangProvider({ children }: { children: ReactNode }): JSX.Element {
  const [lang, setLangState] = useState<Lang>('zh')

  useEffect(() => {
    window.ipInsight
      .getSettings()
      .then((r) => {
        const l = r.settings?.appearance?.language
        if (l === 'zh' || l === 'en') {
          setLangState(l)
          currentLang = l
          document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
        }
      })
      .catch(() => undefined)
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    currentLang = l
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
    void window.ipInsight
      .setSettings({ appearance: { language: l } })
      .catch(() => undefined)
  }, [])

  const t = useCallback(
    (key: TKey, params?: Params) => translate(lang, key, params),
    [lang]
  )

  return createElement(Ctx.Provider, { value: { lang, setLang, t } }, children)
}

export function useLang(): LangCtx {
  return useContext(Ctx)
}
