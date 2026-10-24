import { net } from 'electron'
import type { DiagGeo } from '@shared/diag'

// =============================================================
// 出口诊断 - 出口 IP 归属查询（公共归属 API）
// · 按唯一 IP 去重查询；并发限制 2；10 分钟 TTL 内存缓存。
// · 主源 ip-api.com（免费公共接口，支持中文），回退 ipwho.is（公共接口）。
//   均为无 Key 公开端点，一次只查询本次测得的出口 IP。
// · 归属是 IP 数据库口径：与测量来源（回显出口的服务）区分记录。
// · 查询失败不影响探测项本身：保留 IP，归属显示「未获取」。
// =============================================================

const CACHE_TTL_MS = 10 * 60_000
const MAX_CONCURRENCY = 2
const TIMEOUT_MS = 8000

const cache = new Map<string, { geo: DiagGeo | null; at: number }>()
const inflight = new Map<string, Promise<DiagGeo | null>>()
let queue: (() => void)[] = []
let active = 0

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active++
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(resolve))
}

function release(): void {
  active--
  const next = queue.shift()
  if (next) {
    active++
    next()
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const r = await net.fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    credentials: 'omit',
    headers: { accept: 'application/json' }
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as unknown
}

async function fromIpApi(ip: string, lang: 'zh' | 'en'): Promise<DiagGeo | null> {
  const fields = 'status,message,country,regionName,city,isp,org,as,query'
  const j = (await fetchJson(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}&lang=${lang === 'en' ? 'en' : 'zh-CN'}`
  )) as {
    status?: string
    message?: string
    country?: string
    regionName?: string
    city?: string
    isp?: string
    org?: string
    as?: string
  }
  if (j.status !== 'success') throw new Error(j.message ?? 'ip-api 查询失败')
  return {
    country: j.country,
    region: j.regionName,
    city: j.city,
    isp: j.isp,
    org: j.org,
    asn: j.as,
    source: 'ip-api.com',
    fetchedAt: new Date().toISOString()
  }
}

async function fromIpWhoIs(ip: string): Promise<DiagGeo | null> {
  const j = (await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`)) as {
    success?: boolean
    message?: string
    country?: string
    region?: string
    city?: string
    connection?: { isp?: string; org?: string; asn?: number }
  }
  if (j.success === false) throw new Error(j.message ?? 'ipwho.is 查询失败')
  return {
    country: j.country,
    region: j.region,
    city: j.city,
    isp: j.connection?.isp,
    org: j.connection?.org,
    asn: j.connection?.asn != null ? `AS${j.connection.asn}` : undefined,
    source: 'ipwho.is',
    fetchedAt: new Date().toISOString()
  }
}

/** 查询出口 IP 归属（去重 + 缓存 + 限并发；失败返回 null，不抛出） */
export async function lookupGeo(ip: string, lang: 'zh' | 'en' = 'zh'): Promise<DiagGeo | null> {
  if (!ip) return null
  const hit = cache.get(ip)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.geo
  const running = inflight.get(ip)
  if (running) return running
  const p = (async (): Promise<DiagGeo | null> => {
    await acquire()
    try {
      let geo: DiagGeo | null = null
      try {
        geo = await fromIpApi(ip, lang)
      } catch {
        geo = await fromIpWhoIs(ip)
      }
      cache.set(ip, { geo, at: Date.now() })
      return geo
    } catch {
      cache.set(ip, { geo: null, at: Date.now() })
      return null
    } finally {
      inflight.delete(ip)
      release()
    }
  })()
  inflight.set(ip, p)
  return p
}

/** 归属查询速率：当前在途与缓存规模（诊断输出用） */
export function geoStats(): { inflight: number; cached: number } {
  return { inflight: inflight.size, cached: cache.size }
}
