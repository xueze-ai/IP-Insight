import type {
  BlacklistEntry,
  GlobalPingNode,
  NormalizedIPResult,
  ProviderAdapter,
  ProviderMeta
} from '@shared/types'
import { HiddenPage, CHALLENGE_DETECT_EXPR } from '../base/hiddenPage'

// =============================================================
// Net.Coffee Adapter（主页 + /ip 详情能力）
// 采集方式：隐藏浏览器导航到同源根页，在页面上下文调用站点前端
//          自身使用的公开 JSON 接口（trace 自发现 IP → lookup/geoip/
//          iprisk/dnsbl/bgp/ping 并发聚合），再标准化。
// 注意口径：
//   - lookup.trust_score 是“信任分”，越高越安全（与 Ping0 风控值反向）
//   - lookup.asn 为库归属 ASN；bgp.origins 为实际广播 ASN，可能不同
// 网站改版只需修改本文件。
// =============================================================

const SOURCE_URL = 'https://ip.net.coffee/'

// 全球 Ping 节点表：与站点前端 ping-page.js 的 NODES 保持一致（站点改版只改本文件）
const PING_NODES: {
  id: string
  name: string
  cc: string
  city: string
  continent: string
}[] = [
  { id: 'n01', name: '中国上海', cc: 'cn', city: 'Shanghai', continent: '亚洲' },
  { id: 'n02', name: '中国香港', cc: 'hk', city: 'Hong Kong', continent: '亚洲' },
  { id: 'n03', name: '日本东京', cc: 'jp', city: 'Tokyo', continent: '亚洲' },
  { id: 'n04', name: '新加坡', cc: 'sg', city: 'Singapore', continent: '亚洲' },
  { id: 'n05', name: '越南胡志明', cc: 'vn', city: 'Ho Chi Minh City', continent: '亚洲' },
  { id: 'n06', name: '印尼雅加达', cc: 'id', city: 'Jakarta', continent: '亚洲' },
  { id: 'n07', name: '印度孟买', cc: 'in', city: 'Mumbai', continent: '亚洲' },
  { id: 'n08', name: '以色列特拉维夫', cc: 'il', city: 'Tel Aviv', continent: '亚洲' },
  { id: 'n09', name: '美国洛杉矶', cc: 'us', city: 'Los Angeles', continent: '美洲' },
  { id: 'n10', name: '美国亚特兰大', cc: 'us', city: 'Atlanta', continent: '美洲' },
  { id: 'n11', name: '加拿大温哥华', cc: 'ca', city: 'Vancouver', continent: '美洲' },
  { id: 'n12', name: '巴西圣保罗', cc: 'br', city: 'Sao Paulo', continent: '美洲' },
  { id: 'n13', name: '德国法兰克福', cc: 'de', city: 'Frankfurt', continent: '欧洲' },
  { id: 'n14', name: '荷兰阿姆斯特丹', cc: 'nl', city: 'Amsterdam', continent: '欧洲' },
  { id: 'n15', name: '法国巴黎', cc: 'fr', city: 'Paris', continent: '欧洲' },
  { id: 'n16', name: '瑞典斯德哥尔摩', cc: 'se', city: 'Stockholm', continent: '欧洲' },
  { id: 'n17', name: '瑞士苏黎世', cc: 'ch', city: 'Zurich', continent: '欧洲' },
  { id: 'n18', name: '西班牙马德里', cc: 'es', city: 'Madrid', continent: '欧洲' },
  { id: 'n19', name: '俄罗斯莫斯科', cc: 'ru', city: 'Moscow', continent: '欧洲' },
  { id: 'n20', name: '土耳其伊斯坦布尔', cc: 'tr', city: 'Istanbul', continent: '欧洲' }
]
const PING_NODE_IDS = PING_NODES.map((n) => n.id)

const READY_EXPR =
  "(document.readyState === 'complete') ? true : false"

// 页面上下文聚合脚本
const AGG_EXPR = `
(async () => {
  const out = {};
  const traceText = await fetch('/cdn-cgi/trace', { cache: 'no-store' })
    .then(r => r.text()).catch(() => null);
  out.trace = traceText;
  const m = traceText ? traceText.match(/ip=([^\\n]+)/) : null;
  const ip = m ? m[1].trim() : null;
  out.ip = ip;
  const jget = async (u) => {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
      return await r.json();
    } catch (e) { return { __error: String(e) }; }
  };
  if (ip) {
    out.geo    = await jget('/api/geoip/' + ip);
    out.lookup = await jget('/api/ip/lookup/' + ip);
    out.risk   = await jget('/api/iprisk/' + ip);
    out.dnsbl  = await jget('/api/ipv2/dnsbl/' + ip);
    out.bgp    = await jget('/api/ipv2/bgp/' + ip);
    // 全球 Ping：与站点 /ping/ 页同一接口；不加 force（优先服务端缓存，不消耗限流配额）。
    // 返回 cached 结果或 request_id（轮询 /api/ping/result/{id}，最多约 12s，取到多少算多少）。
    out.ping = await (async () => {
      const ids = ${JSON.stringify(PING_NODE_IDS)};
      const nodeParam = ids.map(n => 'node=' + n).join('&');
      let uip = 'unknown';
      try {
        const tr = await fetch('https://1.1.1.1/cdn-cgi/trace', { signal: AbortSignal.timeout(3000) });
        const tm = (await tr.text()).match(/ip=([^\\n]+)/);
        if (tm) uip = tm[1].trim();
      } catch (e) {}
      try {
        const r = await fetch('/api/ping/start?host=' + encodeURIComponent(ip) +
          '&user_ip=' + encodeURIComponent(uip) + '&' + nodeParam,
          { signal: AbortSignal.timeout(15000) });
        const d = await r.json();
        if (d && d.cached) return d;
        if (d && d.request_id) {
          let results = {};
          for (let i = 0; i < 8; i++) {
            await new Promise(res => setTimeout(res, 1500));
            try {
              const rr = await fetch('/api/ping/result/' + d.request_id,
                { signal: AbortSignal.timeout(10000) });
              const j = await rr.json();
              if (j && typeof j === 'object' && !j.error) results = j;
            } catch (e) {}
            if (ids.every(n => results[n])) break;
          }
          return { cached: false, results };
        }
        return d;
      } catch (e) { return { __error: String(e) }; }
    })();
  }
  return out;
})()
`

interface AnyObj {
  [k: string]: unknown
}

function asObj(v: unknown): AnyObj | null {
  return v && typeof v === 'object' && !('__error' in (v as AnyObj))
    ? (v as AnyObj)
    : null
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function boolOrNull(v: unknown): boolean | null {
  if (v === true || v === false) return v
  return null
}

export class NetCoffeeAdapter implements ProviderAdapter {
  readonly meta: ProviderMeta = {
    id: 'netcoffee',
    name: 'Net.Coffee',
    sourceUrl: SOURCE_URL
  }

  async detect(ctx?: {
    timeoutMs?: number
    onLog?: (m: string) => void
  }): Promise<NormalizedIPResult> {
    const fetchedAt = new Date().toISOString()
    const timeoutMs = ctx?.timeoutMs ?? 40000
    const base: NormalizedIPResult = {
      provider: this.meta,
      fetchedAt,
      ok: false
    }
    const page = new HiddenPage()
    try {
      await page.open({
        url: SOURCE_URL,
        readyExpr: READY_EXPR,
        timeoutMs,
        onLog: ctx?.onLog
      })

      const challenge = await page.eval<boolean>(CHALLENGE_DETECT_EXPR)
      if (challenge) {
        return {
          ...base,
          error: '该数据源需要人工验证/暂不可自动获取（出现人机验证挑战）'
        }
      }

      const data = await page.eval<{
        ip: string | null
        trace: string | null
        geo: unknown
        lookup: unknown
        risk: unknown
        dnsbl: unknown
        bgp: unknown
        ping: unknown
      }>(AGG_EXPR)

      if (!data || !data.ip) {
        return {
          ...base,
          error: '未能通过 trace 获取本机 IP（数据源可能不可用）',
          raw: data ?? undefined
        }
      }

      const lookup = asObj(data.lookup)
      const geo = asObj(data.geo)
      const risk = asObj(data.risk)
      const dnsbl = asObj(data.dnsbl)
      const bgp = asObj(data.bgp)
      const ping = asObj(data.ping)

      if (!lookup) {
        return {
          ...base,
          error: 'lookup 接口未返回有效数据（接口可能变更或暂不可用）',
          raw: data
        }
      }

      const ip = data.ip
      const trust = num(lookup['trust_score'])

      // 经纬度：取 geo_sources 中第一个含 lat/lon 的来源
      let lat: number | null = null
      let lon: number | null = null
      const geoSources = Array.isArray(lookup['geo_sources'])
        ? (lookup['geo_sources'] as AnyObj[])
        : []
      for (const g of geoSources) {
        const la = num(g['lat'])
        const lo = num(g['lon'])
        if (la != null && lo != null) {
          lat = la
          lon = lo
          break
        }
      }

      // 黑名单
      const dnsResults = Array.isArray(dnsbl?.['results'])
        ? (dnsbl!['results'] as AnyObj[])
        : []
      const blacklist: BlacklistEntry[] = dnsResults.map((e) => ({
        engine: String(e['engine'] ?? ''),
        zone: e['zone'] ? String(e['zone']) : undefined,
        category: e['category'] ? String(e['category']) : undefined,
        listed: Boolean(e['listed']),
        codes: Array.isArray(e['codes'])
          ? (e['codes'] as string[])
          : undefined,
        ms: num(e['ms']) ?? undefined,
        status: e['status'] ? String(e['status']) : undefined
      }))

      // 全球 Ping：站点格式 results[node] = [[["OK", 秒, ip?], ...]]；
      // min/avg/max 与站点前端同一算法（OK 样本、秒→ms 四舍五入）。
      // 兼容旧格式（单数值 = 平均）。
      const pingResults = (ping?.['results'] ?? {}) as Record<string, unknown>
      const globalPing: GlobalPingNode[] = PING_NODES.map((n) => {
        const rawNode = pingResults[n.id]
        const group =
          Array.isArray(rawNode) && Array.isArray(rawNode[0])
            ? (rawNode[0] as unknown[])
            : null
        let min: number | null = null
        let avg: number | null = null
        let max: number | null = null
        let reachable: boolean | null = null
        if (group) {
          const times = group
            .filter(
              (p) =>
                Array.isArray(p) &&
                p[0] === 'OK' &&
                typeof p[1] === 'number'
            )
            .map((p) => Math.round((p as number[])[1] * 1000))
          reachable = times.length > 0
          if (times.length) {
            min = Math.min(...times)
            max = Math.max(...times)
            avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
          }
        }
        const legacy = num(rawNode)
        return {
          node: n.id,
          latencyMs: avg ?? legacy,
          minMs: min,
          avgMs: avg,
          maxMs: max,
          reachable: group ? reachable : legacy != null ? true : null,
          name: n.name,
          city: n.city,
          continent: n.continent,
          cc: n.cc
        }
      })

      // 原生判定：risk.isBroadcast（true=广播 false=原生 null=未知）
      const isBroadcast = boolOrNull(risk?.['isBroadcast'])
      const nativeLabel =
        isBroadcast === true
          ? '广播 IP'
          : isBroadcast === false
            ? '原生 IP'
            : undefined

      // trust_score 是信任分（越高越安全），明确标注口径，避免当风险分误读
      const trustLabel =
        trust == null
          ? undefined
          : `信任分 ${trust}/100（越高越安全）· ` +
            (trust >= 70 ? '较可信' : trust >= 40 ? '一般' : '低可信')

      return {
        provider: this.meta,
        fetchedAt,
        ok: true,
        ip,
        ipv4: ip,
        rdns: (lookup['rdns'] as string) || undefined,
        isp:
          (geo?.['isp'] as string) ||
          (lookup['asOrganization'] as string) ||
          undefined,
        asn: lookup['asn'] != null
          ? `AS${lookup['asn']}`
          : null,
        organization:
          (lookup['company_name'] as string) ||
          (lookup['asOrganization'] as string) ||
          undefined,
        country: (lookup['country'] as string) || undefined,
        region: (lookup['region'] as string) || undefined,
        city: (lookup['city'] as string) || undefined,
        location: { lat, lon },
        timezone:
          (risk?.['timezone'] as string) ||
          (lookup['timezone'] as string) ||
          undefined,
        flags: {
          residential: boolOrNull(lookup['isResidential']),
          datacenter: boolOrNull(lookup['is_datacenter']),
          hosting: lookup['company_type'] === 'hosting' ? true : null,
          vpn: boolOrNull(lookup['is_vpn']),
          proxy: boolOrNull(lookup['is_proxy']),
          tor: boolOrNull(lookup['is_tor']),
          crawler: boolOrNull(lookup['is_crawler']),
          mobile: boolOrNull(lookup['is_mobile']),
          abuser: boolOrNull(lookup['is_abuser'])
        },
        riskScore: trust,
        riskLabel: trustLabel,
        nativeLabel,
        blacklist,
        blacklistSummary: {
          listed: num(dnsbl?.['listed']) ?? blacklist.filter((b) => b.listed).length,
          checked: num(dnsbl?.['checked']) ?? blacklist.length
        },
        globalPing,
        raw: {
          trace: data.trace,
          geo,
          lookup,
          risk,
          dnsbl,
          bgp,
          ping
        }
      }
    } catch (e) {
      return { ...base, error: `数据源访问失败：${(e as Error).message}` }
    } finally {
      await page.close()
    }
  }
}

export const netCoffeeAdapter = new NetCoffeeAdapter()
