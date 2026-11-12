import type { WhoRawItem } from '@shared/whoami'

// =============================================================
// OpenRTB 视图
//
// 用本页读数拼一个竞价请求字段结构的示例（字段名按 OpenRTB 常用命名）。
// 真实请求还会带平台自己的 ID 与页面广告位，兴趣标签来自用户画像而不是这些读数。
// 这个对象只在界面上展示、可复制，绝不会发往任何地方。
// =============================================================

function num(v: string | null | undefined): number | undefined {
  if (!v) return undefined
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

export interface RtbView {
  object: Record<string, unknown>
  json: string
}

export function buildBidRequest(readings: WhoRawItem[], geo?: { lat?: number; lon?: number; country?: string; region?: string; city?: string } | null): RtbView {
  const m = new Map(readings.map((r) => [r.id, r]))
  const v = (id: string): string | null => m.get(id)?.value ?? null

  const w = num(v('device.screen')?.split('×')[0])
  const h = num(v('device.screen')?.split('×')[1]?.split(' ')[0])
  const tz = v('locale.timezone')?.split(' · ')[0]
  const offset = num(v('locale.timezoneOffset')?.match(/UTC([+-]\d+)/)?.[1])
  const conn = v('device.connection')?.split(' · ')
  const os = v('device.os')
  const ua = v('headers.ua')

  const object: Record<string, unknown> = {
    id: v('fp.compositeId') ?? undefined,
    imp: [{ id: '1', banner: { w, h }, bidfloor: 0.5, bidfloorcur: 'USD' }],
    site: { page: 'app://ip-insight', publisher: { name: 'IP Insight' } },
    device: {
      ua: ua ?? undefined,
      geo: geo ? { lat: geo.lat, lon: geo.lon, country: geo.country, region: geo.region, city: geo.city } : undefined,
      utcoffset: offset != null ? offset * 60 : undefined,
      language: v('locale.browserLanguage') ?? undefined,
      devicetype: v('device.form')?.includes('移动') ? 1 : 2,
      make: os?.includes('Windows') ? 'Microsoft' : undefined,
      os,
      w,
      h,
      ppi: num(v('device.pixelRatio')),
      pxratio: num(v('device.pixelRatio')),
      dnt: v('headers.dnt')?.includes('DNT 1') ? 1 : 0,
      lmt: v('headers.dnt')?.includes('DNT 1') ? 1 : 0,
      js: 1,
      connectiontype: conn?.[0]?.includes('4g') ? 5 : conn?.[0]?.includes('3g') ? 4 : undefined,
      carrier: v('server.asn') ?? undefined,
      hw: num(v('device.cpuThreads')),
      hwmemsize: num(v('device.memory')),
      ifa: undefined
    },
    user: {
      // 真正的兴趣标签来自平台画像；这里只列出这些读数可以支撑的维度
      keywords: [os, v('locale.browserLanguage'), v('server.geo')].filter(Boolean).join(',') || undefined
    },
    tmax: 120
  }

  // 去掉空值，避免界面出现一堆 undefined
  const clean = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(clean)
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(x as Record<string, unknown>)) {
        const c = clean(val)
        if (c !== undefined && c !== null && c !== '') out[k] = c
      }
      return out
    }
    return x
  }

  const cleaned = clean(object) as Record<string, unknown>
  return { object: cleaned, json: JSON.stringify(cleaned, null, 2) }
}
