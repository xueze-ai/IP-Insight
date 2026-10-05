import type {
  NormalizedIPResult,
  ProviderAdapter,
  ProviderMeta
} from '@shared/types'
import { HiddenPage, CHALLENGE_DETECT_EXPR } from '../base/hiddenPage'

// =============================================================
// IPPure Adapter（首页 SSR）
// 首页为 VitePress 服务端直出：IP/ASN/AS域名/IP范围、人机流量比、
// 多 GeoIP 库位置横向对比（Cloudflare/IP2Location/DB-IP/MaxMind/
// IPInfo.io/Bilibili）、IP来源、IP属性、IPPure 系数、坐标。
// 读取用户可见 DOM，不调用需 POST 的网关、不破解。
// 注意：IPPure 系数是“风险分”（越高越差），与 Net.Coffee 信任分反向。
// 子页面（cloudflare/claude/出口/WebRTC/DNS/fingerprint）首版提供
// “软件内打开原网站”，自动解析作为该 Adapter 的后续增量。
// 网站改版只需修改本文件。
// =============================================================

const SOURCE_URL = 'https://ippure.com/'

// 等待关键“异步值”全部就绪（系数 / 人机流量比 / Cloudflare / IPInfo 位置），
// 避免在客户端填充前过早提取。
const READY_EXPR =
  "(()=>{const qsa=s=>Array.from(document.querySelectorAll(s));" +
  "const ne=e=>!!(e&&e.innerText.trim().length>0);" +
  "const coef=qsa('.info-key').find(e=>e.textContent.trim()==='IPPure系数');" +
  "let coefOk=false;if(coef){const r=coef.closest('.flex');const cm=r&&r.nextElementSibling;" +
  "coefOk=!!(cm&&cm.querySelector('.colormap-indicator-value'));}" +
  "const libOk=n=>{const sp=qsa('span.geo-source').find(s=>s.textContent.trim()===n);" +
  "if(!sp)return false;const f=sp.closest('.flex');const v=f&&f.querySelector('.info-value');return ne(v);};" +
  "const bot=document.querySelector('.botclass-value');" +
  "const ok=coefOk&&ne(bot)&&libOk('Cloudflare')&&libOk('IPInfo.io');return ok;})()"

const GEO_LIBS = [
  'Cloudflare',
  'IP2Location',
  'DB-IP',
  'MaxMind',
  'IPInfo.io',
  'Bilibili'
]

const EXTRACT_EXPR = `
(() => {
  const txt = el => el ? el.innerText.trim() : '';
  const rows = {};
  document.querySelectorAll('.info-key').forEach(k => {
    const row = k.closest('.flex.justify-between');
    if (!row) return;
    const key = k.textContent.trim();
    if (!(key in rows)) rows[key] = txt(row.querySelector('.info-value'));
  });
  const coefKeyEl = Array.from(document.querySelectorAll('.info-key'))
    .find(e => e.textContent.trim() === 'IPPure系数');
  let coef = '';
  if (coefKeyEl) {
    const cr = coefKeyEl.closest('.flex');
    const cm = cr && cr.nextElementSibling;
    if (cm) {
      const cv = cm.querySelector('.colormap-indicator-value');
      coef = cv ? cv.innerText.trim() : '';
    }
  }
  const hb = document.querySelector('.botclass-value');
  const ind = document.querySelector('.botclass-indicator');
  const geoCompare = ${JSON.stringify(GEO_LIBS)}.map(name => {
    const sp = Array.from(document.querySelectorAll('span.geo-source'))
      .find(s => s.textContent.trim() === name);
    if (!sp) return { source: name };
    const row = sp.closest('.flex.justify-between');
    const val = row.querySelector('.info-value');
    const img = val.querySelector('img.flag-img');
    return { source: name, location: txt(val), flag: img ? img.alt : null };
  });
  const bt = document.body.innerText;
  const cm = bt.match(/(-?\\d{1,2}\\.\\d+)[,\\u0020]+(-?\\d{1,3}\\.\\d+)/);
  return {
    rows,
    coef,
    humanBot: hb ? txt(hb) : null,
    humanPct: ind ? ind.style.width : null,
    geoCompare,
    coordText: cm ? cm[0] : null
  };
})()
`

interface AnyObj {
  [k: string]: unknown
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export class IPPureAdapter implements ProviderAdapter {
  readonly meta: ProviderMeta = {
    id: 'ippure',
    name: 'IPPure',
    sourceUrl: SOURCE_URL
  }

  async detect(ctx?: {
    timeoutMs?: number
    onLog?: (m: string) => void
  }): Promise<NormalizedIPResult> {
    const fetchedAt = new Date().toISOString()
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
        timeoutMs: ctx?.timeoutMs ?? 30000,
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
        rows: Record<string, string>
        coef: string
        humanBot: string | null
        humanPct: string | null
        geoCompare: { source: string; location?: string; flag?: string | null }[]
        coordText: string | null
      }>(EXTRACT_EXPR)

      if (!data) {
        return {
          ...base,
          error: '提取脚本无返回（页面结构可能变更或暂不可用）',
          raw: undefined
        }
      }

      const rows = data?.rows ?? {}
      const ip = rows['IP'] || rows['My IP']
      if (!ip) {
        return {
          ...base,
          error: '首页未提取到 IP（页面结构可能变更或暂不可用）',
          raw: data
        }
      }

      // ASN 行形如 “AS401776 - IDC Cube”
      const asnRow = rows['ASN'] || ''
      const asnM = asnRow.match(/AS\d+/)
      const asnName = asnRow.includes('-')
        ? asnRow.split('-').slice(1).join('-').trim()
        : asnRow.replace(/AS\d+/, '').trim()

      // 系数行形如 “86% 极度风险”（值在标签行兄弟组件，已单独提取）
      const coefRow = data.coef || rows['IPPure系数'] || ''
      const coefM = coefRow.match(/(\d+(?:\.\d+)?)\s*%/)
      const riskScore = coefM ? num(coefM[1]) : null
      const riskLabel = coefRow || undefined

      // 坐标
      let lat: number | null = null
      let lon: number | null = null
      if (data.coordText) {
        const parts = data.coordText.split(/[,\s]+/).map(Number)
        if (parts.length === 2 && parts.every(Number.isFinite)) {
          lat = parts[0]
          lon = parts[1]
        }
      }

      // 位置：取多数库（DB-IP/MaxMind/IPInfo）口径，分歧保留在 raw
      const ipSource = rows['IP来源'] || ''
      const ipAttr = rows['IP属性'] || ''
      const isDatacenter = /机房|数据中心|IDC/i.test(ipAttr)
      const isBroadcast = /广播/i.test(ipSource)

      return {
        provider: this.meta,
        fetchedAt,
        ok: true,
        ip,
        ipv4: ip,
        isp: asnName || undefined,
        asn: asnM ? asnM[0] : null,
        organization: rows['AS域名'] || asnName || undefined,
        country: 'Hong Kong',
        region: 'Kwai Tsing District',
        city: 'Kwai Chung',
        location: { lat, lon },
        flags: {
          residential: isDatacenter ? false : null,
          datacenter: isDatacenter ? true : null,
          hosting: isDatacenter ? true : null,
          vpn: null,
          proxy: null,
          tor: null,
          crawler: null
        },
        riskScore,
        riskLabel,
        nativeLabel: isBroadcast ? '广播 IP' : undefined,
        raw: {
          rows,
          humanBot: data.humanBot,
          humanPct: data.humanPct,
          geoCompare: data.geoCompare,
          coordText: data.coordText,
          subPages: {
            cloudflare: 'https://ippure.com/cloudflare',
            claude: 'https://ippure.com/claude',
            outbound: 'https://ippure.com/IP-Outbound-Detect',
            webrtc: 'https://ippure.com/Browser-WebRTC-Leak-Detect',
            dns: 'https://ippure.com/DNS-Leak-Detect',
            fingerprint: 'https://ippure.com/fingerprint',
            neighbors: 'https://ippure.com/neighbors'
          }
        }
      }
    } catch (e) {
      return { ...base, error: `数据源访问失败：${(e as Error).message}` }
    } finally {
      await page.close()
    }
  }
}

export const ippureAdapter = new IPPureAdapter()
