import type { NormalizedIPResult } from '@shared/types'
import type { SourceStep } from '../hooks/useDetection'
import { tt } from '../i18n'

// 多源字段聚合工具：诚实口径，一致才给单一值，分歧则保留每源值，不替用户拍板。

export function successfulResults(steps: SourceStep[]): NormalizedIPResult[] {
  return steps
    .map((s) => s.result)
    .filter((r): r is NormalizedIPResult => !!r && r.ok)
}

export function groupByIp(
  results: NormalizedIPResult[]
): Map<string, NormalizedIPResult[]> {
  const m = new Map<string, NormalizedIPResult[]>()
  for (const r of results) {
    if (!r.ip) continue
    const arr = m.get(r.ip) ?? []
    arr.push(r)
    m.set(r.ip, arr)
  }
  return m
}

export interface ExitGroups {
  main?: { ip: string; rs: NormalizedIPResult[] }
  others: { ip: string; rs: NormalizedIPResult[] }[]
}

// 主出口 = 覆盖源最多的 IP（并列时按传入顺序，含 Ping0 的优先）
export function exitGroups(results: NormalizedIPResult[]): ExitGroups {
  const groups = [...groupByIp(results).entries()].map(([ip, rs]) => ({
    ip,
    rs
  }))
  groups.sort((a, b) => b.rs.length - a.rs.length)
  return { main: groups[0], others: groups.slice(1) }
}

export interface FieldAggregate<T = string> {
  state: 'agree' | 'conflict' | 'nodata'
  value?: T
  perSource: { source: string; value: T | null | undefined }[]
}

// ------------ 多源布尔标签共识（VPN / Proxy / Tor / Crawler …） ------------
export type Tri = 'found' | 'clear' | 'conflict' | 'unknown' | 'nodata'

export interface TriConsensus {
  state: Tri
  // clear/found 结论下仍有源缺该字段（结论来自有数据的源）
  mixed: boolean
  perSource: { source: string; value: boolean | null }[]
}

// 诚实口径：true=命中 false=明确未命中 null=该源提供但无法判断。
// 有明确结论即显示结论（mixed 时在说明中注明缺字段的源）；
// 同时存在 true/false → 冲突（不替用户拍板）；
// 全部 null → 无法判断；无源提供该字段 → 无数据。
export function flagConsensus(
  results: NormalizedIPResult[],
  field: string
): TriConsensus {
  const perSource: { source: string; value: boolean | null }[] = []
  for (const r of results) {
    const f = r.flags as Record<string, boolean | null | undefined> | undefined
    if (!f || !(field in f)) continue
    perSource.push({ source: r.provider.name, value: f[field] ?? null })
  }
  const vals = perSource
    .map((p) => p.value)
    .filter((v): v is boolean | null => v !== undefined)
  if (!vals.length) return { state: 'nodata', mixed: false, perSource }
  const hasTrue = vals.includes(true)
  const hasFalse = vals.includes(false)
  const mixed = vals.includes(null)
  if (hasTrue && hasFalse) return { state: 'conflict', mixed, perSource }
  if (hasTrue) return { state: 'found', mixed, perSource }
  if (hasFalse) return { state: 'clear', mixed, perSource }
  return { state: 'unknown', mixed: false, perSource }
}

// text 用 getter 延迟求值：tt 读取调用时的当前语言，
// 保持 TRI_VIEW[state].text / .cls 的访问方式不变（Dashboard / RiskAnalysis 照常使用）。
export const TRI_VIEW: Record<Tri, { text: string; cls: string }> = {
  found: { get text() { return tt('misc.tri.found') }, cls: 'badge-bad' },
  clear: { get text() { return tt('misc.tri.clear') }, cls: 'badge-good' },
  conflict: { get text() { return tt('misc.tri.conflict') }, cls: 'badge-warn' },
  unknown: { get text() { return tt('misc.tri.unknown') }, cls: 'badge-neutral' },
  nodata: { get text() { return tt('misc.tri.nodata') }, cls: 'badge-neutral' }
}

// ------------ 风险等级归一（各源口径 → 0-100 风险值，越高越危险） ------------
export interface LevelInfo {
  cn: string
  en: string
  color: string
}

export function levelOf(risk: number): LevelInfo {
  if (risk < 25) return { cn: tt('misc.riskLevels.low'), en: 'Low Risk', color: 'var(--risk-low)' }
  if (risk < 50) return { cn: tt('misc.riskLevels.medium'), en: 'Medium Risk', color: 'var(--risk-medium)' }
  if (risk < 75) return { cn: tt('misc.riskLevels.high'), en: 'High Risk', color: 'var(--risk-high)' }
  return { cn: tt('misc.riskLevels.critical'), en: 'Critical', color: 'var(--risk-critical)' }
}

export interface SrcRisk {
  name: string
  risk: number | null
  scale: string
  rawLabel: string
}

export function sourceRisks(results: NormalizedIPResult[]): SrcRisk[] {
  return results
    .map((r) => {
      const id = r.provider.id
      if (id === 'netcoffee' || id === 'netcoffee_gpt') {
        return {
          name: r.provider.name,
          risk: r.riskScore != null ? 100 - r.riskScore : null,
          scale: tt('misc.riskScale.trust'),
          rawLabel: r.riskLabel ?? ''
        }
      }
      if (id === 'ping0') {
        return {
          name: r.provider.name,
          risk: r.riskScore ?? null,
          scale: tt('misc.riskScale.ping0'),
          rawLabel: r.riskLabel ?? ''
        }
      }
      if (id === 'ippure') {
        return {
          name: r.provider.name,
          risk: r.riskScore ?? null,
          scale: tt('misc.riskScale.ippure'),
          rawLabel: r.riskLabel ?? ''
        }
      }
      return { name: r.provider.name, risk: null, scale: '', rawLabel: '' }
    })
    .filter((s) => s.risk != null || s.rawLabel)
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// ------------ 多源交叉汇总文本（AI 提示词 / 报告共用） ------------
// label 用 getter 延迟求值，保持 { field, label } 结构不变。
export const FLAG_FIELDS: { field: string; label: string }[] = [
  { field: 'vpn', label: 'VPN' },
  { field: 'proxy', get label() { return tt('misc.report.summary.proxy') } },
  { field: 'tor', label: 'Tor' },
  { field: 'crawler', get label() { return tt('misc.report.summary.crawler') } },
  { field: 'residential', get label() { return tt('components.multiSource.dims.residential') } },
  { field: 'datacenter', get label() { return tt('components.multiSource.dims.datacenter') } }
]

export function buildConsistencyText(results: NormalizedIPResult[]): string {
  const lines: string[] = []
  const { main, others } = exitGroups(results)
  lines.push(
    tt('misc.consistency.mainExit', {
      ip: main?.ip ?? tt('misc.consistency.unknown'),
      n: main?.rs.length ?? 0
    })
  )
  for (const o of others) {
    lines.push(
      tt('misc.consistency.otherExit', {
        ip: o.ip,
        names: o.rs.map((r) => r.provider.name).join('、')
      })
    )
  }
  for (const f of FLAG_FIELDS) {
    const c = flagConsensus(results, f.field)
    const detail =
      c.state === 'conflict'
        ? tt('misc.consistency.conflictDetail', {
            items: c.perSource
              .map((p) =>
                tt('misc.consistency.sourceVerdict', {
                  source: p.source,
                  verdict:
                    p.value === true
                      ? tt('misc.flagText.hit')
                      : p.value === false
                        ? tt('misc.flagText.miss')
                        : tt('misc.tri.unknown')
                })
              )
              .join('；')
          })
        : ''
    lines.push(
      tt('misc.consistency.flagLine', { label: f.label, text: TRI_VIEW[c.state].text, detail })
    )
  }
  lines.push(tt('misc.consistency.note'))
  return lines.join('\n')
}

export function aggregateField<T>(
  results: NormalizedIPResult[],
  get: (r: NormalizedIPResult) => T | null | undefined
): FieldAggregate<T> {
  const perSource = results.map((r) => ({
    source: r.provider.name,
    value: get(r)
  }))
  const present = perSource.filter((p) => p.value != null && p.value !== '')
  if (!present.length) return { state: 'nodata', perSource }
  const uniq = [...new Set(present.map((p) => String(p.value)))]
  if (uniq.length === 1)
    return { state: 'agree', value: present[0].value ?? undefined, perSource }
  return { state: 'conflict', perSource }
}
