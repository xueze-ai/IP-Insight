import { net } from 'electron'
import { execFile } from 'child_process'
import dns from 'dns'
import netSock from 'net'
import os from 'os'
import type {
  CdnRadarEntry,
  CdnRadarReport,
  CheckStatus,
  DiagnosticCheck,
  DiagnosticReport,
  TraceHop,
  TracerouteResult
} from '@shared/whoami'
import { CDN_TARGETS } from '../diag/targets'
import { extractCdnSignals } from '../diag/textparse'

// =============================================================
// 网络工具箱（全部为真实测量）
// · 路由追踪：调用系统 tracert（Windows 自带），-d 不做反解，逐跳记录 RTT
// · 网络诊断：本机地址 / DNS 服务器 / 域名解析 / TCP 443 / HTTP 延迟 / 网卡 MTU
// · CDN 雷达：对公开性能端点并发请求，读取节点标识与缓存信号 + 耗时
// 不支持的环境（如非 Windows 缺少 tracert）如实返回错误，不伪造结果。
// =============================================================

const HOST_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251})[a-zA-Z0-9]$/

/** 诊断项 id 白名单（渲染层据此取中英文案） */
export const DIAGNOSTIC_CHECK_IDS = [
  'local-ip',
  'dns-servers',
  'dns-resolve',
  'tcp-cloudflare',
  'tcp-github',
  'tcp-baidu',
  'http-latency',
  'mtu'
] as const

function runExe(file: string, args: string[], timeout: number): Promise<{ out: string; err?: string }> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout, maxBuffer: 2 * 1024 * 1024, windowsHide: true, encoding: 'buffer' },
      (err, stdout, stderr) => {
        const out = Buffer.isBuffer(stdout) ? stdout.toString('latin1') : String(stdout ?? '')
        const e = Buffer.isBuffer(stderr) ? stderr.toString('latin1') : String(stderr ?? '')
        if (err && !out) resolve({ out: '', err: e || err.message })
        else resolve({ out, err: e || undefined })
      }
    )
  })
}

/** 解析 tracert 输出：跳数 / RTT / 该跳地址；三组探测全超时记 timeout */
export function parseTracert(text: string): TraceHop[] {
  const hops: TraceHop[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s+([\s\S]*)$/)
    if (!m) continue
    const hop = Number(m[1])
    if (!Number.isFinite(hop) || hop <= 0) continue
    const rest = m[2]
    const rtt: number[] = []
    for (const t of rest.matchAll(/(\d+)\s*ms/g)) rtt.push(Number(t[1]))
    const v4 = rest.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
    const v6 = rest.match(/\b([0-9a-fA-F]{0,4}:[0-9a-fA-F:]{2,})\b/)
    const ip = v4?.[1] ?? v6?.[1]
    hops.push({ hop, rtt, ip, timeout: rtt.length === 0 })
  }
  const seen = new Set<number>()
  return hops.filter((h) => (seen.has(h.hop) ? false : (seen.add(h.hop), true)))
}

export async function traceroute(targetRaw: string): Promise<TracerouteResult> {
  const target = String(targetRaw ?? '').trim()
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  if (!HOST_RE.test(target)) {
    return {
      ok: false,
      target,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      hops: [],
      error: '目标格式不合法：只接受域名或 IP（字母、数字、点、连字符）'
    }
  }
  const { out, err } = await runExe('tracert', ['-d', '-w', '700', '-h', '22', target], 90_000)
  const hops = parseTracert(out)
  return {
    ok: hops.length > 0,
    target,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    hops,
    error: hops.length ? undefined : err ?? (out.trim() ? '未能解析 tracert 输出' : '未收到 tracert 输出（系统未提供 tracert？）')
  }
}

// ---------------- 网络诊断 ----------------

function tcpProbe(host: string, port: number, timeout = 5000): Promise<number | string> {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const sock = netSock.connect({ host, port })
    let done = false
    const finish = (v: number | string): void => {
      if (done) return
      done = true
      sock.destroy()
      resolve(v)
    }
    sock.setTimeout(timeout)
    sock.once('connect', () => finish(Date.now() - t0))
    sock.once('timeout', () => finish('超时'))
    sock.once('error', (e) => finish(e.message))
  })
}

function resolveProbe(host: string): Promise<{ ms: number; addr?: string; error?: string }> {
  const t0 = Date.now()
  return new Promise((resolve) => {
    dns.lookup(host, { all: false }, (err, address) => {
      if (err) resolve({ ms: Date.now() - t0, error: err.code ?? err.message })
      else resolve({ ms: Date.now() - t0, addr: address })
    })
  })
}

async function httpLatency(): Promise<number[]> {
  const out: number[] = []
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    try {
      const r = await net.fetch('https://www.cloudflare.com/cdn-cgi/trace', {
        signal: AbortSignal.timeout(6000),
        credentials: 'omit',
        headers: { 'cache-control': 'no-cache' }
      })
      await r.text()
      out.push(Date.now() - t0)
    } catch {
      /* 单次失败不阻断 */
    }
  }
  return out
}

async function mtuCheck(): Promise<{ values: number[]; error?: string }> {
  const { out, err } = await runExe('netsh', ['interface', 'ipv4', 'show', 'subinterfaces'], 12_000)
  if (!out.trim()) {
    const raw = err ?? ''
    if (/ENOENT/.test(raw)) return { values: [], error: '这台机器没有 netsh（网卡 MTU 仅 Windows 支持）' }
    if (/EACCES|EPERM/.test(raw)) return { values: [], error: '没有权限调用 netsh' }
    return { values: [], error: raw ? `netsh：${raw}` : 'netsh 没有返回内容' }
  }
  const values: number[] = []
  for (const line of out.split(/\r?\n/)) {
    const nums = line.match(/\b\d{3,5}\b/g)
    if (!nums) continue
    const mtu = nums.map(Number).find((n) => n >= 576 && n <= 9200)
    if (mtu) values.push(mtu)
  }
  return { values }
}

function mk(id: string, status: CheckStatus, value?: string, ms?: number, note?: string): DiagnosticCheck {
  return { id, status, value, ms, note }
}

export async function diagnose(): Promise<DiagnosticReport> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()

  const ifaces = os.networkInterfaces()
  const v4: string[] = []
  for (const list of Object.values(ifaces)) {
    for (const i of list ?? []) {
      if (!i.internal && i.family === 'IPv4') v4.push(i.address)
    }
  }
  let dnsServers: string[] = []
  try {
    dnsServers = dns.getServers()
  } catch {
    dnsServers = []
  }

  const [resolves, tcp, http, mtu] = await Promise.all([
    Promise.all([resolveProbe('www.cloudflare.com'), resolveProbe('github.com'), resolveProbe('www.baidu.com')]),
    Promise.all([tcpProbe('www.cloudflare.com', 443), tcpProbe('github.com', 443), tcpProbe('www.baidu.com', 443)]) as Promise<
      (number | string)[]
    >,
    httpLatency(),
    mtuCheck()
  ])

  const checks: DiagnosticCheck[] = [
    mk('local-ip', v4.length ? 'ok' : 'warn', v4.join(', ') || '未读取到本机 IPv4 地址', undefined, '来自系统网卡列表（不含回环地址）'),
    mk('dns-servers', dnsServers.length ? 'ok' : 'warn', dnsServers.join(', ') || '未读取到', undefined, '系统配置，不代表浏览器实际使用哪台')
  ]

  const resolveFails = resolves.filter((r) => r.error).length
  checks.push(
    mk(
      'dns-resolve',
      resolveFails === 0 ? 'ok' : resolveFails === resolves.length ? 'fail' : 'warn',
      resolves.map((r) => (r.error ? `失败(${r.error})` : `${r.ms} ms`)).join(' · '),
      Math.max(...resolves.map((r) => r.ms)),
      '本机 DNS 解析 3 个域名'
    )
  )

  const tcpMeta = [
    { id: 'tcp-cloudflare', label: 'Cloudflare 443' },
    { id: 'tcp-github', label: 'GitHub 443' },
    { id: 'tcp-baidu', label: '百度 443' }
  ]
  tcp.forEach((v, i) => {
    const m = tcpMeta[i]
    checks.push(
      mk(
        m.id,
        typeof v === 'number' ? (v < 300 ? 'ok' : 'warn') : 'fail',
        typeof v === 'number' ? `${v} ms` : v,
        typeof v === 'number' ? v : undefined,
        `${m.label} TCP 连接`
      )
    )
  })

  const minHttp = http.length ? Math.min(...http) : undefined
  checks.push(
    mk(
      'http-latency',
      http.length === 0 ? 'fail' : minHttp! < 150 ? 'ok' : 'warn',
      http.length ? `${http.join(' / ')} ms（最小 ${minHttp}）` : '全部失败',
      minHttp,
      '3 次 HTTP 请求耗时（含 TLS 与服务器处理，不是 ICMP Ping）'
    )
  )

  const mtuMin = mtu.values.length ? Math.min(...mtu.values) : undefined
  checks.push(
    mk(
      'mtu',
      mtu.values.length === 0 ? 'warn' : mtuMin! >= 1400 ? 'ok' : 'warn',
      mtu.values.length ? `网卡 MTU ${mtu.values.join(' / ')}` : mtu.error ?? '未读取到',
      undefined,
      mtu.values.length ? '来自 netsh 网卡配置；小于 1400 可能引起分片或部分站点异常' : mtu.error
    )
  )

  return {
    ok: checks.some((c) => c.status !== 'fail'),
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    checks
  }
}

// ---------------- CDN 雷达 ----------------

async function radarOne(target: (typeof CDN_TARGETS)[number]): Promise<CdnRadarEntry> {
  const t0 = Date.now()
  try {
    const r = await net.fetch(target.url, {
      method: 'GET',
      signal: AbortSignal.timeout(9000),
      credentials: 'omit',
      headers: { 'cache-control': 'no-cache' }
    })
    const headers: Record<string, string | string[]> = {}
    for (const [k, v] of (r.headers as unknown as Map<string, string>).entries()) headers[k.toLowerCase()] = v
    await r.text().catch(() => '')
    const sig = extractCdnSignals(headers, target.signal)
    return {
      cdn: target.cdn,
      host: target.host,
      url: target.url,
      node: sig.node,
      cache: sig.cacheSignals.join(' → ') || undefined,
      status: r.ok ? 'ok' : 'partial',
      ms: Date.now() - t0,
      httpStatus: r.status,
      error: r.ok ? undefined : `HTTP ${r.status}`
    }
  } catch (e) {
    return {
      cdn: target.cdn,
      host: target.host,
      url: target.url,
      status: 'error',
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120)
    }
  }
}

export async function cdnRadar(): Promise<CdnRadarReport> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const entries: CdnRadarEntry[] = []
  const targets = CDN_TARGETS.slice(0, 10)
  for (let i = 0; i < targets.length; i += 4) {
    const batch = targets.slice(i, i + 4)
    entries.push(...(await Promise.all(batch.map((t) => radarOne(t)))))
  }
  // Cloudflare trace 的节点在响应体里（colo=），headers 信号取不到，单独补读
  const cfEntry = entries.find((e) => e.host === 'www.cloudflare.com')
  if (cfEntry) {
    try {
      const r = await net.fetch(cfEntry.url, {
        signal: AbortSignal.timeout(9000),
        credentials: 'omit',
        headers: { 'cache-control': 'no-cache' }
      })
      const colo = (await r.text()).match(/colo=([A-Z0-9]+)/)?.[1]
      if (colo) cfEntry.node = colo
    } catch {
      /* 保留原始结果 */
    }
  }
  return {
    ok: entries.some((e) => e.status === 'ok'),
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    entries
  }
}
