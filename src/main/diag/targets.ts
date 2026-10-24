import type { DiagEvidence } from '@shared/diag'

// =============================================================
// 出口诊断 - 集中目标配置
// 原则：只收录「已在 2026-10 实际核验」的公开诊断端点；
//      每个目标注明真实信号来源；不根据 URL 猜测 API，
//      不把任何站点的内部接口当作公共 API。
// 目标清单集中维护：站点改版 / 目标失效只改本文件。
// =============================================================

/** 一次 HTTP 探测的信号解析说明（写入 evidence.note，如实说明口径） */
export interface CdnTarget {
  cdn: string
  /** 真正发起请求的测试域名 */
  host: string
  url: string
  /** PoP 信号说明：来自哪个响应头/字段 */
  signal: 'trace-colo' | 'x-served-by' | 'x-amz-cf-pop' | 'x-77-pop' | 'server-bunny' | 'x-cf1' | 'x-cdn-pop' | 'none'
  /** 缓存状态信号（有才解析，没有不显示 HIT/MISS） */
  cacheSignal?: 'x-cache' | 'x-77-cache' | 'x-cf2' | 'none'
  /** 该端点由 CDN 官方 / 公开性能测试网络提供 */
  originNote: string
}

/** CDN 命中节点测试目标（全部端点已于 2026-10 用真实请求核验信号头） */
export const CDN_TARGETS: CdnTarget[] = [
  {
    cdn: 'Cloudflare',
    host: 'www.cloudflare.com',
    url: 'https://www.cloudflare.com/cdn-cgi/trace',
    signal: 'trace-colo',
    originNote: 'Cloudflare 官方公开诊断路径（每台边缘节点提供 /cdn-cgi/trace）'
  },
  {
    cdn: 'Cloudflare Speed',
    host: 'speed.cloudflare.com',
    url: 'https://speed.cloudflare.com/cdn-cgi/trace',
    signal: 'trace-colo',
    originNote: 'Cloudflare 官方测速站点，同上'
  },
  {
    cdn: 'Fastly',
    host: 'any.pops.fastly-analytics.com',
    url: 'https://any.pops.fastly-analytics.com',
    signal: 'x-served-by',
    cacheSignal: 'x-cache',
    originNote: 'Fastly 官方 RUM 性能收集端点（响应头声明 Access-Control-Expose-Headers: X-Served-By）'
  },
  {
    cdn: 'AWS CloudFront',
    host: 'djlzvy5xcvhxt.cloudfront.net',
    url: 'https://djlzvy5xcvhxt.cloudfront.net/500b-bench.jpg',
    signal: 'x-amz-cf-pop',
    cacheSignal: 'x-cache',
    originNote: 'CloudFront 公开性能基准资源（PerfOps/CDNPerf 公开测试网络使用）'
  },
  {
    cdn: 'Bunny Standard',
    host: 'test.b-cdn.net',
    url: 'https://test.b-cdn.net',
    signal: 'server-bunny',
    originNote: 'Bunny CDN 官方公开测试域（Server 头含 PoP）'
  },
  {
    cdn: 'Bunny Volume',
    host: 'testvideo.b-cdn.net',
    url: 'https://testvideo.b-cdn.net',
    signal: 'server-bunny',
    originNote: 'Bunny CDN 官方公开测试域（Server 头含 PoP）'
  },
  {
    cdn: 'CDN77',
    host: '1596384882.rsc.cdn77.org',
    url: 'https://1596384882.rsc.cdn77.org/500b-bench.jpg',
    signal: 'x-77-pop',
    cacheSignal: 'x-77-cache',
    originNote: 'CDN77 公开性能基准资源（X-77-POP 头）'
  },
  {
    cdn: 'CacheFly',
    host: 'cdnperf.cachefly.net',
    url: 'https://cdnperf.cachefly.net/500b-bench.jpg',
    signal: 'x-cf1',
    cacheSignal: 'x-cf2',
    originNote: 'CacheFly 官方公开测试域（X-CF1 头含缓存节点标识）'
  },
  {
    cdn: 'OVH CDN',
    host: 'ovh-cdn.perfops.io',
    url: 'https://ovh-cdn.perfops.io/500b-bench.jpg',
    signal: 'x-cdn-pop',
    originNote: 'OVH 公开性能基准资源（X-CDN-Pop 头）'
  },
  {
    cdn: 'Zenlayer',
    host: 'test-perfops.ecn.zenlayer.net',
    url: 'https://test-perfops.ecn.zenlayer.net/500b-bench.jpg',
    signal: 'none',
    originNote: 'Zenlayer 公开性能基准资源（响应不回显 PoP，仅记录可达性与耗时）'
  },
  {
    cdn: 'jsDelivr',
    host: 'cdn.jsdelivr.net',
    url: 'https://cdn.jsdelivr.net/npm/latency-test@1.0.0/generate_200',
    signal: 'none',
    originNote: 'jsDelivr 公开 200 基准资源（响应不回显 PoP，仅记录可达性与耗时）'
  }
]

/** 网站分流测试目标 */
export interface SplitTarget {
  name: string
  url: string
  group: 'intl' | 'cn' | 'ai' | 'dev'
  /** 是否回显出口 IP（Cloudflare 前置站点 /cdn-cgi/trace 有 ip= 字段） */
  echo: boolean
  note: string
}

export const SPLIT_TARGETS: SplitTarget[] = [
  {
    name: 'Cloudflare',
    url: 'https://www.cloudflare.com/cdn-cgi/trace',
    group: 'intl',
    echo: true,
    note: '基线目标：Cloudflare 官方诊断路径'
  },
  {
    name: 'ChatGPT',
    url: 'https://chatgpt.com/cdn-cgi/trace',
    group: 'ai',
    echo: true,
    note: 'OpenAI 前置了 Cloudflare，诊断路径回显出口'
  },
  {
    name: 'Claude',
    url: 'https://claude.ai/cdn-cgi/trace',
    group: 'ai',
    echo: true,
    note: 'Anthropic 前置了 Cloudflare，诊断路径回显出口'
  },
  {
    name: 'OpenAI API',
    url: 'https://api.openai.com/cdn-cgi/trace',
    group: 'ai',
    echo: true,
    note: 'api.openai.com 前置了 Cloudflare'
  },
  {
    name: 'Discord',
    url: 'https://discord.com/cdn-cgi/trace',
    group: 'intl',
    echo: true,
    note: 'Discord 前置了 Cloudflare'
  },
  {
    name: 'GitLab',
    url: 'https://gitlab.com/cdn-cgi/trace',
    group: 'dev',
    echo: true,
    note: 'GitLab 前置了 Cloudflare'
  },
  {
    name: 'GitHub',
    url: 'https://github.com/',
    group: 'dev',
    echo: false,
    note: 'GitHub 不回显出口 IP：仅记录可达性与耗时'
  },
  {
    name: '百度',
    url: 'https://www.baidu.com/',
    group: 'cn',
    echo: false,
    note: '国内目标，不回显出口 IP：仅记录可达性与耗时'
  },
  {
    name: '网易云音乐',
    url: 'https://music.163.com/',
    group: 'cn',
    echo: false,
    note: '国内目标，不回显出口 IP：仅记录可达性与耗时'
  },
  {
    name: 'Bilibili',
    url: 'https://www.bilibili.com/',
    group: 'cn',
    echo: false,
    note: '国内目标，不回显出口 IP：仅记录可达性与耗时'
  }
]

/** DNS 出口观测：公共诊断 TXT 区（Cloudflare whoami 已停用，采用 Google / Akamai 两个来源） */
export interface DnsResolverTarget {
  id: string
  server: string
  name: string
  /** true = 用户系统当前配置的解析器（运行时通过 dns.getServers 读取） */
  system?: boolean
}

export const DNS_RESOLVERS: DnsResolverTarget[] = [
  { id: 'system', server: '', name: '系统默认解析器', system: true },
  { id: 'alidns', server: '223.5.5.5', name: 'AliDNS (223.5.5.5)' },
  { id: 'dnspod', server: '119.29.29.29', name: 'DNSPod (119.29.29.29)' },
  { id: '114dns', server: '114.114.114.114', name: '114DNS (114.114.114.114)' },
  { id: 'google', server: '8.8.8.8', name: 'Google DNS (8.8.8.8)' },
  { id: 'cloudflare', server: '1.1.1.1', name: 'Cloudflare DNS (1.1.1.1)' }
]

/** 诊断观测记录名（公开的诊断用 TXT 区，由权威侧回显「来查询的解析器出口」） */
export const DNS_PROBE_NAMES = [
  { host: 'o-o.myaddr.l.google.com', source: 'google-authoritative', sourceUrl: 'https://www.google.com/support/enterview/bin/answer.py?answer=1066653', note: 'Google 官方诊断区：TXT 回显向其权威发起查询的解析器出口（含 EDNS Client Subnet 信息）' },
  { host: 'whoami.ds.akahelp.net', source: 'akamai-authoritative', sourceUrl: 'https://whoami.ds.akahelp.net/', note: 'Akamai 官方诊断区：TXT 回显「ns/ip + 解析器出口」' }
]

/** 本机公网出口观测目标（Cloudflare 官方 trace，多主机互相印证） */
export const PUBLIC_IP_TARGETS = [
  { host: 'www.cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace', note: 'Cloudflare 官方诊断路径' },
  { host: 'speed.cloudflare.com', url: 'https://speed.cloudflare.com/cdn-cgi/trace', note: 'Cloudflare 官方测速站点诊断路径' }
]

/** Sukka 页面（复用正常网页自身的检测流程；遇到挑战页如实上报，不绕过） */
export const SUKKA_PAGE_URL = 'https://ip.skk.moe/'
export const SUKKA_SOURCE = 'sukka-page'
export const SUKKA_SOURCE_URL = 'https://ip.skk.moe/'

/** 证据 / 原始响应限制：避免历史与内存膨胀 */
export const EVIDENCE_MAX = 2000

export function makeEvidence(e: DiagEvidence): DiagEvidence {
  const out: DiagEvidence = { ...e }
  if (out.snippet && out.snippet.length > EVIDENCE_MAX) {
    out.snippet = out.snippet.slice(0, EVIDENCE_MAX) + '…[截断]'
  }
  return out
}
