import { getServers } from 'dns'
import type {
  DiagEvent,
  DiagModule,
  DiagModuleId,
  DiagProbe,
  DiagProbeSummary,
  DiagRun,
  DiagRunSummary,
  DiagStatus
} from '@shared/diag'
import {
  CDN_TARGETS,
  DNS_PROBE_NAMES,
  DNS_RESOLVERS,
  PUBLIC_IP_TARGETS,
  SPLIT_TARGETS
} from './targets'
import {
  aggregateStatus,
  cdnHeaderParse,
  dnsProbe,
  httpProbe,
  ipv6Probe,
  reachabilityParse,
  traceParse
} from './probes'

// =============================================================
// 出口诊断编排器
// · 每轮 runId 隔离：取消/重跑后，旧轮结果不得覆盖当前轮。
// · 有限并发（默认 4）、整轮超时、单探测项超时、有限重试。
// · 单项失败不丢弃其他成功数据；各来源/探测项/成功率分别统计。
// · Sukka 站点页面流程（publicIp 模块附带）遇到挑战页时如实上报。
// =============================================================

const MAX_CONCURRENCY = 4
const RUN_TIMEOUT_MS = 90_000
const RETRY_LIMIT = 1 // 仅网络层瞬时失败重试一次

class RunHandle {
  canceled = false
  constructor(public runId: string) {}
}

const active = new Map<string, RunHandle>()
let lastRun: DiagRun | null = null
let lastHandle: RunHandle | null = null
let seq = 0

export type DiagEventListener = (e: DiagEvent) => void
const listeners = new Set<DiagEventListener>()

export function onDiagEvent(l: DiagEventListener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

function emit(e: DiagEvent): void {
  for (const l of listeners) {
    try {
      l(e)
    } catch {
      /* 单个监听器异常不影响其他 */
    }
  }
}

function newRunId(): string {
  seq += 1
  return `diag-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 6)}`
}

/** 当前/最近一轮（供渲染层拉取） */
export function latestRun(): DiagRun | null {
  return lastRun
}

export function stopRun(runId?: string): boolean {
  const h = runId ? active.get(runId) : lastHandle
  if (!h) return false
  h.canceled = true
  return true
}

function summarizeRun(run: DiagRun): DiagRunSummary {
  const probes: DiagRunSummary['probes'] = {
    publicIp: [],
    splitTunnel: [],
    cdnNode: [],
    dnsExit: []
  }
  const sources = new Set<string>()
  let total = 0
  let ok = 0
  for (const m of run.modules) {
    for (const p of m.probes) {
      total += 1
      if (p.status === 'success') ok += 1
      sources.add(p.source)
      probes[m.id].push({
        id: p.id,
        source: p.source,
        target: p.target ?? p.targetHost,
        method: p.method,
        via: p.via,
        status: p.status,
        ip: p.ip,
        family: p.family,
        node: p.node,
        cdn: p.cdn,
        httpStatus: p.httpStatus,
        durationMs: p.durationMs,
        error: p.error
      })
    }
  }
  const moduleStatus: DiagRunSummary['moduleStatus'] = {}
  for (const m of run.modules) moduleStatus[m.id] = m.status
  return {
    runId: run.runId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    status: run.status,
    origin: run.origin,
    moduleStatus,
    probes,
    stats: { sources: sources.size, probes: total, ok }
  }
}

/** 有界 AI 摘要：事实行 + 状态，不含证据全文 */
export function diagAiSummary(run: DiagRun): string[] {
  const lines: string[] = []
  for (const m of run.modules) {
    for (const p of m.probes) {
      if (p.status === 'success') {
        const what = p.ip
          ? `${p.target ?? p.targetHost ?? p.id} 出口 ${p.ip}${p.family ? `(${p.family})` : ''}${p.node ? `，节点 ${p.node}` : ''}`
          : p.node
            ? `${p.cdn ?? p.target ?? p.id} 节点 ${p.node}`
            : `${p.target ?? p.targetHost ?? p.id} 可达${p.httpStatus ? `（HTTP ${p.httpStatus}）` : ''}`
        lines.push(`[${m.id}] ${what}`)
      } else if (p.status !== 'skipped' && p.status !== 'pending') {
        lines.push(`[${m.id}] ${p.target ?? p.targetHost ?? p.id} ${statusTextCn(p.status)}${p.error ? `：${p.error.slice(0, 80)}` : ''}`)
      }
    }
  }
  return lines
}

function statusTextCn(s: DiagStatus): string {
  switch (s) {
    case 'timeout': return '超时'
    case 'canceled': return '已取消'
    case 'skipped': return '跳过'
    case 'unsupported': return '不支持'
    case 'partial': return '部分成功'
    case 'failed': return '失败'
    default: return s
  }
}

/** 有限并发执行 */
async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const idx = i++
      if (idx >= items.length) return
      await fn(items[idx])
    }
  })
  await Promise.all(workers)
}

/** 是否应该中止（取消 / 整轮超时） */
function shouldAbort(h: RunHandle, deadline: number): boolean {
  return h.canceled || Date.now() > deadline
}

function failProbe(id: string, source: string, status: DiagStatus, error: string, via: DiagProbe['via'] = 'main-http'): DiagProbe {
  return {
    id,
    source,
    method: '—',
    via,
    status,
    error,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString()
  }
}

// ---------------- 模块实现 ----------------

async function probePublicIp(h: RunHandle, deadline: number, light: boolean): Promise<DiagModule> {
  const probes: DiagProbe[] = []
  // 1) 多主机 Cloudflare trace（真实回显；不同主机可观察不同出口，全部保留）
  await runLimited(PUBLIC_IP_TARGETS, 2, async (t) => {
    if (shouldAbort(h, deadline)) {
      probes.push(failProbe(`trace-${t.host}`, 'cloudflare', 'canceled', '已取消'))
      return
    }
    const p = await httpProbe({
      id: `trace-${t.host}`,
      source: 'cloudflare',
      sourceUrl: 'https://www.cloudflare.com/zh-cn/privacy/',
      target: t.host,
      targetHost: t.host,
      url: t.url,
      parse: traceParse()
    })
    // 瞬时失败重试一次（网络抖动/代理切换）
    const final = p.status === 'timeout' || p.status === 'failed'
      ? { ...(await httpProbe({ id: `trace-${t.host}`, source: 'cloudflare', sourceUrl: 'https://www.cloudflare.com/zh-cn/privacy/', target: t.host, targetHost: t.host, url: t.url, parse: traceParse() })), id: `trace-${t.host}` }
      : p
    probes.push(final)
    emit({ runId: h.runId, moduleId: 'publicIp', probeId: final.id, status: final.status })
  })
  // 2) IPv6 出口（强制 IPv6 直连；无 IPv6 连通性 → unsupported 中性显示）
  if (!shouldAbort(h, deadline)) {
    const v6 = await ipv6Probe()
    probes.push(v6)
    emit({ runId: h.runId, moduleId: 'publicIp', probeId: v6.id, status: v6.status })
  }
  // 2) Sukka 页面流程（完整模式才跑；挑战页如实上报，不绕过）
  if (!light) {
    const sp = await probeSukkaPage(h, deadline)
    if (sp) probes.push(sp)
  }
  const status = shouldAbort(h, deadline) ? 'canceled' : aggregateStatus(probes)
  return {
    id: 'publicIp',
    status,
    startedAt: probes[0]?.startedAt,
    finishedAt: new Date().toISOString(),
    probes,
    noteKeys: ['diag.publicIp.note']
  }
}

/** Sukka 页面：隐藏窗口加载 ip.skk.moe，等待其自身检测完成，提取页面展示结果 */
async function probeSukkaPage(h: RunHandle, deadline: number): Promise<DiagProbe | null> {
  if (shouldAbort(h, deadline)) return null
  const { HiddenPage, CHALLENGE_DETECT_EXPR } = await import('../providers/base/hiddenPage')
  const page = new HiddenPage()
  const probe: DiagProbe = {
    id: 'sukka-page',
    source: 'sukka-page',
    sourceUrl: 'https://ip.skk.moe/',
    target: 'ip.skk.moe',
    targetHost: 'ip.skk.moe',
    method: '页面流程提取（页面自身检测完成后读取其展示结果）',
    via: 'browser-page',
    status: 'running',
    startedAt: new Date().toISOString()
  }
  try {
    await page.open({
      url: 'https://ip.skk.moe/',
      timeoutMs: 30000,
      readyExpr:
        "(() => { const t = document.body ? document.body.innerText : ''; return /DNS 出口查询|DNS Exit/.test(t) && !/获取中|正在获取/.test(t.slice(-400)) })()",
      pollIntervalMs: 800
    })
    const challenge = await page.eval<boolean>(CHALLENGE_DETECT_EXPR)
    if (challenge) {
      probe.status = 'failed'
      probe.error = '站点返回人机验证页（Cloudflare 挑战）。按合规约束本应用不绕过验证：请在浏览器中手动访问一次 ip.skk.moe 通过验证后重试，或稍后再测。'
      return probe
    }
    // 提取页面主出口展示结果（IPv4/IPv6 卡片）——页面自身的检测结果
    const extract = await page.eval<string>(`
      (() => {
        const t = document.body ? document.body.innerText : '';
        const grab = (re) => { const m = t.match(re); return m ? m[1] : null };
        return JSON.stringify({
          ipv4: grab(/IPv4[\\s\\S]{0,120}?(\\d{1,3}(?:\\.\\d{1,3}){3})/),
          ipv6: grab(/IPv6[\\s\\S]{0,160}?((?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4})/),
          asn: grab(/AS\\s?(\\d{1,10})/),
          snippet: t.slice(0, 1600)
        });
      })()
    `)
    const data = typeof extract === 'string' ? JSON.parse(extract) : null
    probe.finishedAt = new Date().toISOString()
    if (!data || (!data.ipv4 && !data.ipv6)) {
      probe.status = 'failed'
      probe.error = '页面已加载但未能提取到出口结果（页面结构可能已改版）'
      probe.evidence = data ? [{ kind: 'page', snippet: String(data.snippet).slice(0, 800), note: '页面文本摘录' }] : undefined
      return probe
    }
    probe.status = 'success'
    probe.ip = data.ipv4 ?? undefined
    probe.family = data.ipv4 ? 'ipv4' : data.ipv6 ? 'ipv6' : 'unknown'
    probe.asn = data.asn ?? undefined
    probe.evidence = [{ kind: 'page', snippet: String(data.snippet).slice(0, 800), note: '页面文本摘录（ip.skk.moe 自身检测结果）' }]
    return probe
  } catch (e) {
    probe.status = 'failed'
    probe.error = `页面流程失败：${String(e instanceof Error ? e.message : e).slice(0, 160)}`
    probe.finishedAt = new Date().toISOString()
    return probe
  } finally {
    await page.close()
  }
}

async function probeSplitTunnel(h: RunHandle, deadline: number): Promise<DiagModule> {
  const probes: DiagProbe[] = []
  await runLimited(SPLIT_TARGETS, MAX_CONCURRENCY, async (t) => {
    if (shouldAbort(h, deadline)) {
      probes.push(failProbe(`split-${t.name}`, 'target-site', 'canceled', '已取消'))
      return
    }
    const p = await httpProbe({
      id: `split-${t.name}`,
      source: t.echo ? 'cloudflare' : 'target-site',
      target: t.name,
      targetHost: new URL(t.url).host,
      url: t.url,
      parse: t.echo ? traceParse() : reachabilityParse()
    })
    probes.push(p)
    emit({ runId: h.runId, moduleId: 'splitTunnel', probeId: p.id, status: p.status })
  })
  const status = shouldAbort(h, deadline) ? 'canceled' : aggregateStatus(probes)
  return {
    id: 'splitTunnel',
    status,
    startedAt: probes[0]?.startedAt,
    finishedAt: new Date().toISOString(),
    probes,
    noteKeys: ['diag.splitTunnel.note']
  }
}

async function probeCdnNode(h: RunHandle, deadline: number): Promise<DiagModule> {
  const probes: DiagProbe[] = []
  await runLimited(CDN_TARGETS, MAX_CONCURRENCY, async (t) => {
    if (shouldAbort(h, deadline)) {
      probes.push(failProbe(`cdn-${t.cdn}`, 'cdn-target', 'canceled', '已取消'))
      return
    }
    const p = await httpProbe({
      id: `cdn-${t.cdn}`,
      source: 'cdn-target',
      sourceUrl: 'https://www.cloudflare.com/zh-cn/privacy/',
      target: t.cdn,
      targetHost: t.host,
      url: t.url,
      parse: t.signal === 'trace-colo' ? traceParse() : cdnHeaderParse({ signal: t.signal, cacheSignal: t.cacheSignal })
    })
    p.cdn = t.cdn
    probes.push(p)
    emit({ runId: h.runId, moduleId: 'cdnNode', probeId: p.id, status: p.status })
  })
  const status = shouldAbort(h, deadline) ? 'canceled' : aggregateStatus(probes)
  return {
    id: 'cdnNode',
    status,
    startedAt: probes[0]?.startedAt,
    finishedAt: new Date().toISOString(),
    probes,
    noteKeys: ['diag.cdnNode.note']
  }
}

async function probeDnsExit(h: RunHandle, deadline: number): Promise<DiagModule> {
  const probes: DiagProbe[] = []
  // 系统解析器地址（只用于标注「当前系统配置」，查询仍按目标逐个直连）
  let systemServers: string[] = []
  try {
    systemServers = getServers().map((s) => String(s))
  } catch {
    systemServers = []
  }
  interface Job {
    res: (typeof DNS_RESOLVERS)[number]
    rec: (typeof DNS_PROBE_NAMES)[number]
    server: string
  }
  const jobs: Job[] = []
  for (const res of DNS_RESOLVERS) {
    // 整轮规模控制：4 个指定解析器 + 系统 = 最多 5 × 2 条记录
    if (res.system) {
      const first = systemServers[0]
      jobs.push({ res, rec: DNS_PROBE_NAMES[0], server: first })
      jobs.push({ res, rec: DNS_PROBE_NAMES[1], server: first })
    } else {
      jobs.push({ res, rec: DNS_PROBE_NAMES[0], server: res.server })
      jobs.push({ res, rec: DNS_PROBE_NAMES[1], server: res.server })
    }
  }
  await runLimited(jobs, MAX_CONCURRENCY, async (j) => {
    if (shouldAbort(h, deadline)) {
      probes.push(failProbe(`dns-${j.res.id}-${j.rec.source}`, j.rec.source, 'canceled', '已取消', 'dns-udp'))
      return
    }
    if (!j.server) {
      probes.push({
        id: `dns-${j.res.id}-${j.rec.source}`,
        source: j.rec.source,
        sourceUrl: j.rec.sourceUrl,
        target: j.res.name,
        targetHost: j.rec.host,
        method: 'DNS TXT (UDP 53)',
        via: 'dns-udp',
        status: 'unsupported',
        error: '未能获取系统解析器地址'
      })
      return
    }
    const p = await dnsProbe({
      id: `dns-${j.res.id}-${j.rec.source}`,
      source: j.rec.source,
      sourceUrl: j.rec.sourceUrl,
      target: j.res.name,
      targetHost: j.rec.host,
      queryName: j.rec.host,
      server: j.server
    })
    probes.push(p)
    emit({ runId: h.runId, moduleId: 'dnsExit', probeId: p.id, status: p.status })
  })
  const status = shouldAbort(h, deadline) ? 'canceled' : aggregateStatus(probes)
  return {
    id: 'dnsExit',
    status,
    startedAt: probes[0]?.startedAt,
    finishedAt: new Date().toISOString(),
    probes,
    noteKeys: ['diag.dnsExit.note']
  }
}

/** 启动一轮诊断。返回 runId；进度通过 diag:event 事件推送。 */
export async function startRun(modules: DiagModuleId[], origin: 'dashboard' | 'network'): Promise<string> {
  // 若已有进行中的轮次，先标记取消（新轮开始后旧轮的迟到结果全部作废）
  if (lastHandle) lastHandle.canceled = true
  const h = new RunHandle(newRunId())
  active.set(h.runId, h)
  lastHandle = h
  const run: DiagRun = {
    runId: h.runId,
    startedAt: new Date().toISOString(),
    status: 'running',
    origin,
    modules: modules.map((id) => ({ id, status: 'running' as DiagStatus, probes: [] }))
  }
  lastRun = run
  const startedAt = Date.now()
  const deadline = startedAt + RUN_TIMEOUT_MS
  const runner: Record<DiagModuleId, () => Promise<DiagModule>> = {
    publicIp: () => probePublicIp(h, deadline, origin === 'dashboard'),
    splitTunnel: () => probeSplitTunnel(h, deadline),
    cdnNode: () => probeCdnNode(h, deadline),
    dnsExit: () => probeDnsExit(h, deadline)
  }
  void (async () => {
    try {
      // 模块间有限并发：最多两个模块同时跑，模块内部再限并发
      await runLimited(modules, 2, async (id) => {
        if (shouldAbort(h, deadline)) return
        try {
          const m = await runner[id]()
          if (h.runId !== lastRun?.runId) return // 迟到轮次隔离
          const idx = lastRun.modules.findIndex((x) => x.id === id)
          if (idx >= 0) lastRun.modules[idx] = m
          emit({ runId: h.runId, moduleId: id, status: m.status })
        } catch (e) {
          const idx = lastRun?.modules.findIndex((x) => x.id === id) ?? -1
          const m: DiagModule = {
            id,
            status: 'failed',
            probes: [failProbe(`${id}-module`, 'internal', 'failed', String(e instanceof Error ? e.message : e).slice(0, 200))],
            error: String(e instanceof Error ? e.message : e).slice(0, 200)
          }
          if (lastRun && idx >= 0) lastRun.modules[idx] = m
        }
      })
      if (h.runId === lastRun?.runId) {
        lastRun.finishedAt = new Date().toISOString()
        lastRun.status = h.canceled
          ? 'canceled'
          : Date.now() > deadline
            ? 'timeout'
            : aggregateStatus(lastRun.modules.flatMap((m) => m.probes))
      }
    } finally {
      active.delete(h.runId)
      if (lastHandle === h && h.canceled) {
        // 保留 handle 以便 latestRun 状态可查询；下一轮启动时会被替换
      }
    }
  })()
  return h.runId
}

export { summarizeRun }
