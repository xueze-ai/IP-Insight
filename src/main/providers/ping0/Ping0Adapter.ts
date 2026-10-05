import type {
  NormalizedIPResult,
  ProviderAdapter,
  ProviderMeta,
  ScenarioRating
} from '@shared/types'
import { HiddenPage, CHALLENGE_DETECT_EXPR } from '../base/hiddenPage'

// =============================================================
// Ping0 Adapter
// 数据特征：首页 SSR，服务端按访客 IP 把完整结果渲染进 DOM；
//          每个字段为 .line(.name 标签 + .content 值)。
// 采集方式：隐藏浏览器打开 https://ping0.cc/ → 等待 .line-risk →
//          在页面上下文执行提取脚本 → 标准化。
// 网站改版只需修改本文件中的选择器与提取脚本。
// =============================================================

const SOURCE_URL = 'https://ping0.cc/'

// 结果就绪条件：全局 IP 已注入且风控值行已渲染
const READY_EXPR =
  '(window.ip && document.querySelector(".line-risk")) ? true : false'

// 页面上下文提取脚本（不使用反引号，避免与 TS 模板冲突）
const EXTRACT_EXPR = `
(() => {
  const q = s => document.querySelector(s);
  const contentText = sel => {
    const e = q(sel + ' .content');
    return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null;
  };
  const out = {};
  out.ip = window.ip || null;
  out.ipnum = window.ipnum || null;

  const locContent = q('.line.loc .content');
  out.locRaw = locContent ? locContent.innerText.replace(/\\s+/g, ' ').trim() : null;
  out.locFirst = (locContent && locContent.firstElementChild)
    ? locContent.firstElementChild.innerText.replace(/\\s+/g, ' ').trim() : null;

  out.asn = contentText('.line.asn');
  out.asnname = contentText('.line.asnname');
  out.orgname = contentText('.line.orgname');

  let lng = null, lat = null;
  Array.from(document.querySelectorAll('.line')).forEach(e => {
    const n = e.querySelector('.name');
    const c = e.querySelector('.content');
    if (!n || !c) return;
    const nt = n.innerText;
    if (/经度/.test(nt)) lng = c.innerText.trim();
    if (/纬度/.test(nt)) lat = c.innerText.trim();
  });
  out.lng = lng;
  out.lat = lat;

  const iptContent = q('.line-iptype .content');
  out.iptypeLabels = iptContent
    ? Array.from(iptContent.querySelectorAll('.label,.mini,[class*="label"]'))
        .map(e => e.innerText.trim()).filter(Boolean)
    : [];
  out.iptypeRaw = iptContent ? iptContent.innerText.replace(/\\s+/g, ' ').trim() : null;

  out.risk = contentText('.line-risk');
  out.nativeip = contentText('.line-nativeip');
  out.aicheck = contentText('.line-aicheck');

  const uc = q('.usecountbar');
  out.usecount = uc
    ? (uc.getAttribute('usecount') || uc.innerText.replace(/\\s+/g, ' ').trim())
    : contentText('.line-usecount');

  out.scenes = Array.from(document.querySelectorAll('.scene-card'))
    .map(e => e.innerText.replace(/\\s+/g, ' ').trim());

  out.bodyText = document.body ? document.body.innerText : '';
  return out;
})()
`

interface Ping0Data {
  ip: string | null
  ipnum: string | null
  locRaw: string | null
  locFirst: string | null
  asn: string | null
  asnname: string | null
  orgname: string | null
  lng: string | null
  lat: string | null
  iptypeLabels: string[]
  iptypeRaw: string | null
  risk: string | null
  nativeip: string | null
  aicheck: string | null
  usecount: string | null
  scenes: string[]
  bodyText: string
}

function parseScenes(scenes: string[]): ScenarioRating[] {
  return scenes
    .map((s) => {
      const stars = (s.match(/★/g) || []).length
      const recommended = /不推荐/.test(s) ? false : stars >= 4 ? true : null
      const name = s.split(/\s|★/)[0].trim()
      return { name, stars, recommended, raw: s }
    })
    .filter((x) => x.name)
}

function normalize(
  data: Ping0Data,
  provider: ProviderMeta,
  fetchedAt: string
): NormalizedIPResult {
  // 位置：取位置卡片首块，去掉“错误提交”等操作文本
  let locStr = (data.locFirst || data.locRaw || '')
    .replace(/错误提交.*$/, '')
    .replace(/探测时间.*$/, '')
    .trim()
  const tokens = locStr.split(/\s+/).filter(Boolean)
  const country = tokens[0] || undefined
  const region = tokens[1] || undefined
  const city = tokens[2] || undefined

  const labels = (data.iptypeLabels || []).join(' ')
  const isIDC = /IDC机房|机房/.test(labels)
  const isHome = /家庭宽带|家宽/.test(labels)
  const lat = data.lat ? Number(data.lat) : null
  const lon = data.lng ? Number(data.lng) : null

  // 风控值：“100% 极度风险”
  let riskScore: number | null = null
  let riskLabel: string | undefined
  if (data.risk) {
    const m = data.risk.match(/(\d+(?:\.\d+)?)\s*%/)
    if (m) riskScore = Number(m[1])
    const lbl = data.risk.replace(/^[\s\S]*?%/, '').trim()
    if (lbl) riskLabel = lbl
  }

  return {
    provider,
    fetchedAt,
    ok: true,
    ip: data.ip || undefined,
    ipv4: data.ip || undefined,
    asn: data.asn ?? null,
    isp: data.asnname || undefined,
    organization: data.orgname || undefined,
    country,
    region,
    city,
    location: {
      lat: Number.isFinite(lat as number) ? lat : null,
      lon: Number.isFinite(lon as number) ? lon : null
    },
    flags: {
      // 仅在页面明确给出标签时赋值，否则 null，不臆断
      datacenter: isIDC ? true : isHome ? false : null,
      hosting: isIDC ? true : isHome ? false : null,
      residential: isHome ? true : isIDC ? false : null,
      proxy: /代理/.test(labels) ? true : null,
      vpn: /VPN/.test(labels) ? true : null,
      tor: /Tor/i.test(labels) ? true : null,
      crawler: /蜘蛛|爬虫/.test(labels) ? true : null
    },
    riskScore,
    riskLabel,
    nativeLabel: data.nativeip || undefined,
    sharedUsers: data.usecount || undefined,
    scenarios: parseScenes(data.scenes || []),
    raw: data
  }
}

export class Ping0Adapter implements ProviderAdapter {
  readonly meta: ProviderMeta = {
    id: 'ping0',
    name: 'Ping0',
    sourceUrl: SOURCE_URL
  }

  async detect(ctx?: {
    timeoutMs?: number
    onLog?: (m: string) => void
  }): Promise<NormalizedIPResult> {
    const fetchedAt = new Date().toISOString()
    const timeoutMs = ctx?.timeoutMs ?? 30000
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

      const data = await page.eval<Ping0Data>(EXTRACT_EXPR)
      if (!data || !data.ip || !data.risk) {
        return {
          ...base,
          error: '未能从页面提取到完整检测结果（页面结构可能已变化）',
          raw: data ?? undefined
        }
      }
      return normalize(data, this.meta, fetchedAt)
    } catch (e) {
      return { ...base, error: `数据源访问失败：${(e as Error).message}` }
    } finally {
      await page.close()
    }
  }
}

export const ping0Adapter = new Ping0Adapter()
