import { net } from 'electron'
import type {
  ServiceIncident,
  ServiceStatusFeed,
  ServiceStatusItem
} from '@shared/types'

// =============================================================
// Net.Coffee 服务状态聚合（https://ip.net.coffee/status/）
// 数据源：站点公开聚合接口 /status/data.json
//        （站点每 10 分钟同步各服务官方 statuspage / 自研状态 API）。
// 本模块只拉取与标准化展示：不修改口径、不伪造状态、失败如实上报。
// 网站改版只需修改本文件。
// =============================================================

export const SERVICE_STATUS_PAGE_URL = 'https://ip.net.coffee/status/'
const DATA_URL = 'https://ip.net.coffee/status/data.json'

interface RawObj {
  [k: string]: unknown
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export async function fetchServiceStatus(): Promise<ServiceStatusFeed> {
  const r = await net.fetch(`${DATA_URL}?_=${Date.now()}`, {
    cache: 'no-store'
  })
  if (!r.ok) throw new Error(`status data.json HTTP ${r.status}`)
  const j = (await r.json()) as RawObj
  const list = Array.isArray(j['services']) ? (j['services'] as RawObj[]) : []

  const services: ServiceStatusItem[] = list.map((s) => {
    const inc = Array.isArray(s['incidents']) ? (s['incidents'] as RawObj[]) : []
    const incidents: ServiceIncident[] = inc.slice(0, 5).map((i) => ({
      name: str(i['name']),
      status: str(i['status']) || undefined,
      impact: str(i['impact']) || undefined,
      created_at: str(i['created_at']) || undefined,
      updated_at: str(i['updated_at']) || undefined
    }))
    return {
      key: str(s['key']),
      name: str(s['name_cn']) || str(s['name']),
      group: str(s['tag']) || str(s['group']),
      indicator: str(s['indicator']) || 'unknown',
      indicator_cn: str(s['indicator_cn']),
      description: str(s['description']),
      ok: s['ok'] !== false,
      error: str(s['error']) || undefined,
      page_url: str(s['page_url']) || undefined,
      detail_url: str(s['detail_url']) || undefined,
      last_failure_at: str(s['last_failure_at']) || undefined,
      last_check_at: str(s['last_check_at']) || undefined,
      incidents
    }
  })

  const failing =
    Number(j['failing']) ||
    services.filter((s) => s.indicator !== 'none' && s.indicator !== '').length

  return {
    sourceUrl: SERVICE_STATUS_PAGE_URL,
    fetchedAt: str(j['fetched_at']),
    fetchedLocalAt: new Date().toISOString(),
    count: Number(j['count']) || services.length,
    failing,
    services
  }
}
