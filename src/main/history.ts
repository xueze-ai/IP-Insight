import { app } from 'electron'
import fs from 'fs'
import { join } from 'path'
import type { HistoryRecord } from '@shared/types'
import { getSettings } from './settings'

// =============================================================
// 历史记录：userData/history.json
// 保存时机：综合检测完成后由渲染层提交（受 privacy.historyEnabled 控制）；
// 写入时按 privacy.historyRetentionDays 清理过期记录，并限制总条数。
// =============================================================

const MAX_RECORDS = 100

let cache: HistoryRecord[] | null = null

function historyFile(): string {
  return join(app.getPath('userData'), 'history.json')
}

export function listHistory(): HistoryRecord[] {
  if (cache) return cache
  try {
    const raw = fs.readFileSync(historyFile(), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    cache = Array.isArray(parsed) ? (parsed as HistoryRecord[]) : []
  } catch {
    cache = []
  }
  return cache
}

function persist(): void {
  try {
    fs.writeFileSync(historyFile(), JSON.stringify(cache ?? [], null, 2))
  } catch {
    /* 磁盘不可写时仅保留内存态 */
  }
}

function prune(records: HistoryRecord[]): HistoryRecord[] {
  const days = getSettings().privacy.historyRetentionDays
  const cutoff = Date.now() - days * 24 * 3600 * 1000
  return records
    .filter((r) => {
      const t = Date.parse(r.startedAt)
      return Number.isNaN(t) || t >= cutoff
    })
    .slice(0, MAX_RECORDS)
}

export function saveHistory(record: HistoryRecord): { id: string } | { skipped: true } {
  if (!getSettings().privacy.historyEnabled) return { skipped: true }
  const list = listHistory()
  const next = prune([record, ...list.filter((r) => r.id !== record.id)])
  cache = next
  persist()
  return { id: record.id }
}

export function getHistory(id: string): HistoryRecord | undefined {
  return listHistory().find((r) => r.id === id)
}

export function updateHistoryAi(id: string, aiReport: string): boolean {
  const list = listHistory()
  const rec = list.find((r) => r.id === id)
  if (!rec) return false
  rec.aiReport = aiReport
  cache = list
  persist()
  return true
}

export function deleteHistory(id: string): boolean {
  const list = listHistory()
  const next = list.filter((r) => r.id !== id)
  if (next.length === list.length) return false
  cache = next
  persist()
  return true
}

export function clearHistory(): void {
  cache = []
  persist()
}
