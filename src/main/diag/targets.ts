import type { DiagEvidence, SplitCategory } from '@shared/diag'

// =============================================================
// 出口诊断 - 集中目标配置
// 原则：只收录「已实际核验」的公开诊断端点；每个目标注明真实信号来源
//      与核验日期；不根据 URL 猜测 API，不把任何站点的内部接口当作公共 API。
// 目标清单集中维护：站点改版 / 目标失效只改本文件。
// =============================================================

export const TARGETS_VERIFIED_AT = '2026-10-24'

/** 证据 / 原始响应限制：避免历史与内存膨胀 */
export const EVIDENCE_MAX = 2000

export function makeEvidence(e: DiagEvidence): DiagEvidence {
  const out: DiagEvidence = { ...e }
  if (out.snippet && out.snippet.length > EVIDENCE_MAX) {
    out.snippet = out.snippet.slice(0, EVIDENCE_MAX) + '…[截断]'
  }
  return out
}

// ---------------- CDN 命中节点 ----------------

export interface CdnTarget {
  cdn: string
  /** 真正发起请求的测试域名 */
  host: string
  url: string
  /** PoP 信号：来自哪个响应头/字段（trace-colo = Cloudflare trace 的 colo） */
  signal: 'trace-colo' | 'x-served-by' | 'x-amz-cf-pop' | 'x-77-pop' | 'server-bunny' | 'x-cf1' | 'x-cdn-pop' | 'none'
  /** 该端点由谁提供（官方公开诊断路径 / 公开性能测试网络） */
  originNote: string
  /** 来源说明 / 官方状态页链接 */
  sourceUrl?: string
}

/** CDN 命中节点测试目标（全部端点已于 2026-10-24 用真实请求核验信号头） */
export const CDN_TARGETS: CdnTarget[] = [
  {
    cdn: 'Cloudflare',
    host: 'www.cloudflare.com',
    url: 'https://www.cloudflare.com/cdn-cgi/trace',
    signal: 'trace-colo',
    originNote: 'Cloudflare 官方公开诊断路径（每台边缘节点提供 /cdn-cgi/trace）',
    sourceUrl: 'https://www.cloudflare.com/'
  },
  {
    cdn: 'Cloudflare Speed',
    host: 'speed.cloudflare.com',
    url: 'https://speed.cloudflare.com/cdn-cgi/trace',
    signal: 'trace-colo',
    originNote: 'Cloudflare 官方测速站点，同上',
    sourceUrl: 'https://speed.cloudflare.com/'
  },
  {
    cdn: 'Fastly',
    host: 'any.pops.fastly-analytics.com',
    url: 'https://any.pops.fastly-analytics.com',
    signal: 'x-served-by',
    originNote: 'Fastly 官方 RUM 性能收集端点（响应头声明 Access-Control-Expose-Headers: X-Served-By；X-Cache 为缓存信号）',
    sourceUrl: 'https://www.fastly.com/status'
  },
  {
    cdn: 'AWS CloudFront',
    host: 'djlzvy5xcvhxt.cloudfront.net',
    url: 'https://djlzvy5xcvhxt.cloudfront.net/500b-bench.jpg',
    signal: 'x-amz-cf-pop',
    originNote: 'CloudFront 公开性能基准资源（PerfOps/CDNPerf 公开测试网络使用；X-Amz-Cf-Pop 为 PoP，X-Cache 为缓存信号）',
    sourceUrl: 'https://aws.amazon.com/cloudfront/'
  },
  {
    cdn: 'Bunny Standard',
    host: 'test.b-cdn.net',
    url: 'https://test.b-cdn.net',
    signal: 'server-bunny',
    originNote: 'Bunny CDN 官方公开测试域（Server 头含 PoP）',
    sourceUrl: 'https://bunny.net/'
  },
  {
    cdn: 'Bunny Volume',
    host: 'testvideo.b-cdn.net',
    url: 'https://testvideo.b-cdn.net',
    signal: 'server-bunny',
    originNote: 'Bunny CDN 官方公开测试域（Server 头含 PoP）',
    sourceUrl: 'https://bunny.net/'
  },
  {
    cdn: 'CDN77',
    host: '1596384882.rsc.cdn77.org',
    url: 'https://1596384882.rsc.cdn77.org/500b-bench.jpg',
    signal: 'x-77-pop',
    originNote: 'CDN77 公开性能基准资源（X-77-POP 为 PoP，X-77-Cache 为缓存信号）',
    sourceUrl: 'https://www.cdn77.com/'
  },
  {
    cdn: 'CacheFly',
    host: 'cdnperf.cachefly.net',
    url: 'https://cdnperf.cachefly.net/500b-bench.jpg',
    signal: 'x-cf1',
    originNote: 'CacheFly 官方公开测试域（X-CF1 头含缓存节点标识，X-CF2 为缓存信号）',
    sourceUrl: 'https://cachefly.com/'
  },
  {
    cdn: 'OVH CDN',
    host: 'ovh-cdn.perfops.io',
    url: 'https://ovh-cdn.perfops.io/500b-bench.jpg',
    signal: 'x-cdn-pop',
    originNote: 'OVH 公开性能基准资源（X-CDN-Pop 头）',
    sourceUrl: 'https://www.ovhcloud.com/'
  },
  {
    cdn: 'Zenlayer',
    host: 'test-perfops.ecn.zenlayer.net',
    url: 'https://test-perfops.ecn.zenlayer.net/500b-bench.jpg',
    signal: 'none',
    originNote: 'Zenlayer 公开性能基准资源（响应不回显 PoP，仅记录可达性与耗时）',
    sourceUrl: 'https://zenlayer.com/'
  },
  {
    cdn: 'jsDelivr',
    host: 'cdn.jsdelivr.net',
    url: 'https://cdn.jsdelivr.net/npm/latency-test@1.0.0/generate_200',
    signal: 'none',
    originNote: 'jsDelivr 公开 200 基准资源（响应不回显 PoP，仅记录可达性与耗时）',
    sourceUrl: 'https://www.jsdelivr.com/'
  }
]

// ---------------- 网站分流测试 ----------------

export type SplitEcho = 'cdn-cgi-trace' | 'bili-zone' | 'ipip-text' | 'plain-ip' | 'none'

export interface SplitTarget {
  name: string
  host: string
  url: string
  category: SplitCategory
  /** 回显机制：目标如何让请求方得知观察到的出口 IP */
  echo: SplitEcho
  /** 说明（来源口径） */
  note: string
  sourceUrl?: string
}

/**
 * 网站分流测试目标（2026-10-24 逐个真实请求核验）：
 * - cdn-cgi-trace：目标官方站点前置 Cloudflare，/cdn-cgi/trace 为官方公开诊断路径，回显 ip=
 * - bili-zone：哔哩哔哩官方播放器自用公开接口（api.bilibili.com/x/web-interface/zone），回显 addr 与归属
 * - ipip-text：IPIP.net 官方 myip.ipip.net 文本接口，回显「当前 IP」与归属
 * - plain-ip：公开 IP 回显服务（ipinfo.io / IP.SB），纯文本回显
 * - none：不回显出口 IP，仅记录可达性 / HTTP 状态 / 耗时
 */
export const SPLIT_TARGETS: SplitTarget[] = [
  {
    name: 'Cloudflare',
    host: 'www.cloudflare.com',
    url: 'https://www.cloudflare.com/cdn-cgi/trace',
    category: 'intl',
    echo: 'cdn-cgi-trace',
    note: '基线目标：Cloudflare 官方诊断路径',
    sourceUrl: 'https://www.cloudflare.com/'
  },
  {
    name: 'ChatGPT',
    host: 'chatgpt.com',
    url: 'https://chatgpt.com/cdn-cgi/trace',
    category: 'ai',
    echo: 'cdn-cgi-trace',
    note: 'OpenAI 官方站点前置 Cloudflare；诊断路径回显出口。结果仅代表 chatgpt.com 该路径',
    sourceUrl: 'https://chatgpt.com/'
  },
  {
    name: 'Claude',
    host: 'claude.ai',
    url: 'https://claude.ai/cdn-cgi/trace',
    category: 'ai',
    echo: 'cdn-cgi-trace',
    note: 'Anthropic 官方站点前置 Cloudflare；诊断路径回显出口。结果仅代表 claude.ai 该路径',
    sourceUrl: 'https://claude.ai/'
  },
  {
    name: 'Anthropic',
    host: 'www.anthropic.com',
    url: 'https://www.anthropic.com/cdn-cgi/trace',
    category: 'ai',
    echo: 'cdn-cgi-trace',
    note: 'Anthropic 官网前置 Cloudflare；诊断路径回显出口',
    sourceUrl: 'https://www.anthropic.com/'
  },
  {
    name: 'OpenAI API',
    host: 'api.openai.com',
    url: 'https://api.openai.com/cdn-cgi/trace',
    category: 'ai',
    echo: 'cdn-cgi-trace',
    note: 'api.openai.com 前置 Cloudflare；结果仅代表 api 域名，不代表 ChatGPT 站点',
    sourceUrl: 'https://api.openai.com/'
  },
  {
    name: 'Discord',
    host: 'discord.com',
    url: 'https://discord.com/cdn-cgi/trace',
    category: 'intl',
    echo: 'cdn-cgi-trace',
    note: 'Discord 官方站点前置 Cloudflare',
    sourceUrl: 'https://discord.com/'
  },
  {
    name: 'GitLab',
    host: 'gitlab.com',
    url: 'https://gitlab.com/cdn-cgi/trace',
    category: 'dev',
    echo: 'cdn-cgi-trace',
    note: 'GitLab 官方站点前置 Cloudflare',
    sourceUrl: 'https://gitlab.com/'
  },
  {
    name: 'Stack Overflow',
    host: 'stackoverflow.com',
    url: 'https://stackoverflow.com/cdn-cgi/trace',
    category: 'dev',
    echo: 'cdn-cgi-trace',
    note: 'Stack Overflow 官方站点前置 Cloudflare',
    sourceUrl: 'https://stackoverflow.com/'
  },
  {
    name: 'ipinfo.io',
    host: 'ipinfo.io',
    url: 'https://ipinfo.io/ip',
    category: 'intl',
    echo: 'plain-ip',
    note: '公开 IP 回显服务（官方公开端点，纯文本）',
    sourceUrl: 'https://ipinfo.io/'
  },
  {
    name: 'IP.SB',
    host: 'api.ip.sb',
    url: 'https://api.ip.sb/ip',
    category: 'intl',
    echo: 'plain-ip',
    note: '公开 IP 回显服务（官方公开端点，纯文本）',
    sourceUrl: 'https://ip.sb/'
  },
  {
    name: '哔哩哔哩',
    host: 'api.bilibili.com',
    url: 'https://api.bilibili.com/x/web-interface/zone',
    category: 'cn',
    echo: 'bili-zone',
    note: '哔哩哔哩官方播放器自用公开接口，回显观察到的出口与归属（addr/country/isp）',
    sourceUrl: 'https://www.bilibili.com/'
  },
  {
    name: 'IPIP.net',
    host: 'myip.ipip.net',
    url: 'https://myip.ipip.net/',
    category: 'cn',
    echo: 'ipip-text',
    note: 'IPIP.net 官方文本接口，回显「当前 IP」与归属',
    sourceUrl: 'https://www.ipip.net/'
  },
  {
    name: 'GitHub',
    host: 'github.com',
    url: 'https://github.com/',
    category: 'dev',
    echo: 'none',
    note: '不回显出口 IP：仅记录可达性 / HTTP 状态 / 耗时',
    sourceUrl: 'https://github.com/'
  },
  {
    name: '百度',
    host: 'www.baidu.com',
    url: 'https://www.baidu.com/',
    category: 'cn',
    echo: 'none',
    note: '不回显出口 IP：仅记录可达性 / HTTP 状态 / 耗时',
    sourceUrl: 'https://www.baidu.com/'
  },
  {
    name: '网易云音乐',
    host: 'music.163.com',
    url: 'https://music.163.com/',
    category: 'cn',
    echo: 'none',
    note: '不回显出口 IP：仅记录可达性 / HTTP 状态 / 耗时',
    sourceUrl: 'https://music.163.com/'
  }
]

// ---------------- 本机公网 IP ----------------

export const PUBLIC_IP_TARGETS = [
  { host: 'www.cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace', note: 'Cloudflare 官方诊断路径（主进程 HTTP，跟随系统代理）' },
  { host: 'speed.cloudflare.com', url: 'https://speed.cloudflare.com/cdn-cgi/trace', note: 'Cloudflare 官方测速站点诊断路径（主进程 HTTP，跟随系统代理）' }
]

// ---------------- DNS 出口 ----------------

export interface DnsResolverTarget {
  id: string
  /** 服务器地址（空 = 运行时读取系统配置的第一台） */
  server: string
  name: string
  system?: boolean
}

export const DNS_RESOLVERS: DnsResolverTarget[] = [
  { id: 'system', server: '', name: '系统配置解析器', system: true },
  { id: 'alidns', server: '223.5.5.5', name: 'AliDNS (223.5.5.5)' },
  { id: 'dnspod', server: '119.29.29.29', name: 'DNSPod (119.29.29.29)' },
  { id: '114dns', server: '114.114.114.114', name: '114DNS (114.114.114.114)' },
  { id: 'google', server: '8.8.8.8', name: 'Google DNS (8.8.8.8)' },
  { id: 'cloudflare', server: '1.1.1.1', name: 'Cloudflare DNS (1.1.1.1)' }
]

/** 诊断观测记录名（官方诊断 TXT 区，由权威侧回显「来查询的解析器出口」） */
export const DNS_PROBE_NAMES = [
  {
    host: 'o-o.myaddr.l.google.com',
    source: 'google-authoritative',
    sourceUrl: 'https://developers.google.com/speed/public-dns/docs/ecs',
    note: 'Google 官方诊断区：TXT 回显向其权威发起查询的递归解析器出口；含 edns0-client-subnet 时为客户端网段'
  },
  {
    host: 'whoami.ds.akahelp.net',
    source: 'akamai-authoritative',
    sourceUrl: 'https://www.akamai.com/blog/developers/introducing-new-whoami-tool-dns-resolver-information',
    note: 'Akamai 官方诊断区：ns 段 = 递归解析器出口；ip 段 = ECS 网段代表地址；ecs 段 = 客户端网段'
  }
]

// ---------------- Sukka 页面 ----------------

export const SUKKA_PAGE_URL = 'https://ip.skk.moe/'
