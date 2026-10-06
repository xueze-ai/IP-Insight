import { app } from 'electron'
import fs from 'fs'
import { join } from 'path'
import type { AppSettings } from '@shared/types'
import type { DeepPartial } from '@shared/types'
import { AI_PROVIDER_META } from '@shared/aiProviders'

// =============================================================
// 设置持久化：userData/settings.json，进程内缓存 + 深合并写入。
// 渲染层只能通过 IPC 读写（settings:get / settings:set / settings:reset）。
// =============================================================

export function defaultSettings(): AppSettings {
  const providers = {} as AppSettings['ai']['providers']
  for (const m of AI_PROVIDER_META) {
    providers[m.id] = {
      apiKey: '',
      baseUrl: m.defaultBaseUrl,
      model: m.defaultModel
    }
  }
  return {
    appearance: {
      theme: 'light',
      sidebarCollapsedByDefault: false,
      fontSize: 'standard'
    },
    ai: {
      current: 'qwen',
      providers,
      customProviders: {},
      hiddenProviders: [],
      extraPrompt: '',
      temperature: 0.4,
      maxTokens: 8192
    },
    detection: { timeoutSec: 40, autoRunOnStart: false, parallel: false },
    privacy: { historyEnabled: true, historyRetentionDays: 30, clearHistoryOnExit: false },
    updates: { autoCheck: true }
  }
}

let cache: AppSettings | null = null

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

type Obj = Record<string, unknown>

function isPlainObject(v: unknown): v is Obj {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge(base: Obj, patch: Obj): Obj {
  const out: Obj = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Obj, v)
    } else if (v !== undefined) {
      out[k] = v
    }
  }
  return out
}

export function getSettings(): AppSettings {
  if (cache) return cache
  const def = defaultSettings()
  try {
    const raw = fs.readFileSync(settingsFile(), 'utf8')
    cache = deepMerge(def as unknown as Obj, JSON.parse(raw) as Obj) as unknown as AppSettings
  } catch {
    cache = def
  }
  return cache
}

export function setSettings(patch: DeepPartial<AppSettings>): AppSettings {
  cache = deepMerge(
    getSettings() as unknown as Obj,
    patch as unknown as Obj
  ) as unknown as AppSettings
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(cache, null, 2))
  } catch {
    /* 磁盘不可写时仅保留内存态 */
  }
  return cache
}

export function resetSettings(): AppSettings {
  cache = defaultSettings()
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(cache, null, 2))
  } catch {
    /* ignore */
  }
  return cache
}
