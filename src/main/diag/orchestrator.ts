import { getServers } from 'dns'
import type {
  DiagEvent,
  DiagModule,
  DiagModuleId,
  DiagProbe,
  DiagProbeSummary,
  DiagRun,
  DiagRunSummary,
  DiagStatus,
  DiagStartRequest
} from '@shared/diag'
import {
  CDN_TARGETS,
  DNS_PROBE_NAMES,
  DNS_RESOLVERS,
  SPLIT_TARGETS,
  SUKKA_PAGE_URL,
  TARGETS_VERIFIED_AT
} from './targets'
import {
  aggregateStatus,
  cdnProbeSpecs,
  execCdnProbe,
  execDnsProbe,
  execHttpProbe,
  execIpv6Probe,
  execSplitProbe,
  makeProbe,
  publicIpProbeSpecs,
  splitProbeSpecs,
  type DnsJobSpec,
  type ProbeSpec
} from './probes'
import { lookupGeo } from './geo'
import { getSettings } from '../settings'

// =============================================================
// 出口诊断编排器
// · 启动即创建目标骨架（全部探测项 queued），逐项事件携带完整探测项。
// · runId 注册表：按 runId 关联（综合检测轻量查询传入 detectionId），
//   取消 / 重跑 / 载入历史后旧轮结果不覆盖当前轮。
// · 有限并发（模块间 2、探测项间 4）、整轮超时、单项超时 + 硬超时兜底。
// · 停止 / 超时立即终结全部未完成状态；关闭隐藏窗口；保留成功结果，可立即重跑。
// · 单项重试不清空其他结果；尝试历史记录在 probe.attempts。
// · 出口 IP 归属由主进程统一查询（去重 / 限并发 / TTL 缓存）并随探测项保存。
// =============================================================

const MAX_MODULE_CONCURRENCY = 2
const MAX_PROBE_CONCURRENCY = 4
const RUN_TIMEOUT_MS = 120_000
const KEEP_RUNS = 5

interface RunHandle {
  canceled: boolean
  finished: boolean
  deadline: number
  /** 运行中需要清理的外部资源（隐藏窗口等） */
  resources: { close: () => Promise<void> | void }[]
}

const runs = new Map<string, DiagRun>()
const handles = new Map<string, RunHandle>()
let lastRunId: string | null = null
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

function getRun(runId: string): DiagRun | null {
  return runs.get(runId) ?? null
}

/** 当前/最近一轮 */
export function latestRun(): DiagRun | null {
  return lastRunId ? (runs.get(lastRunId) ?? null) : null
}

function rememberRun(run: DiagRun): void {
  runs.set(run.runId, run)
  lastRunId = run.runId
  // 只保留最近若干轮，避免内存增长
  if (runs.size > KEEP_RUNS) {
    const oldest = runs.keys().next().value
    if (oldest && oldest !== run.runId) {
      runs.delete(oldest)
      handles.delete(oldest)
    }
  }
}

function emitProbe(run: DiagRun, moduleId: DiagModuleId, probe: DiagProbe): void {
  emit({ kind: 'probe', runId: run.runId, moduleId, probe })
}

function emitModule(run: DiagRun, moduleId: DiagModuleId): void {
  const m = run.modules.find((x) => x.id === moduleId)
  if (m) emit({ kind: 'module', runId: run.runId, moduleId, status: m.status })
}

/** 整轮状态 = 模块状态聚合（仅读取状态字段） */
function aggregateTop(getStatus: () => DiagStatus[], runTimedOut = false): DiagStatus {
  const st = getStatus()
  if (!st.length) return 'pending'
  if (st.includes('running')) return 'running'
  const ok = st.filter((x) => x === 'success').length
  const bad = st.filter((x) => x === 'failed' || x === 'timeout').length
  const canceled = st.filter((x) => x === 'canceled').length
  const partial = st.filter((x) => x === 'partial').length
  if (ok > 0 || partial > 0) return bad + canceled + partial > 0 ? 'partial' : 'success'
  if (canceled > 0 && bad === 0) return 'canceled'
  if (runTimedOut && bad > 0) return 'timeout'
  return 'failed'
}

function emitRun(run: DiagRun): void {
  emit({ kind: 'run', runId: run.runId, status: run.status, finishedReason: run.finishedReason })
}

function findProbe(run: DiagRun, probeId: string): { module: DiagModule; probe: DiagProbe } | null {
  for (const m of run.modules) {
    const p = m.probes.find((x) => x.id === probeId)
    if (p) return { module: m, probe: p }
  }
  return null
}

// ---------------- 摘要 ----------------

function probeToSummary(p: DiagProbe): DiagProbeSummary {
  return {
    id: p.id,
    source: p.source,
    target: p.target,
    targetHost: p.targetHost,
    method: p.method,
    mechKey: p.mechKey,
    via: p.via,
    category: p.category,
    status: p.status,
    ip: p.ip,
    family: p.family,
    geo: p.geo,
    node: p.node,
    cdn: p.cdn,
    cacheSignals: p.cacheSignals,
    httpStatus: p.httpStatus,
    durationMs: p.durationMs,
    dnsRecords: p.dnsRecords,
    exitSource: p.exitSource,
    ecsSubnet: p.ecsSubnet,
    ecsRep: p.ecsRep,
    serverAddr: p.serverAddr,
    resolverKind: p.resolverKind,
    error: p.error,
    attempts: p.attempts
  }
}

export function summarizeRun(run: DiagRun): DiagRunSummary {
  const probes: DiagRunSummary['probes'] = { publicIp: [], splitTunnel: [], cdnNode: [], dnsExit: [] }
  const sources = new Set<string>()
  let total = 0
  let ok = 0
  for (const m of run.modules) {
    for (const p of m.probes) {
      total += 1
      if (p.status === 'success') ok += 1
      sources.add(p.source)
      probes[m.id].push(probeToSummary(p))
    }
  }
  const moduleStatus: DiagRunSummary['moduleStatus'] = {}
  for (const m of run.modules) moduleStatus[m.id] = m.status
  return {
    runId: run.runId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    status: run.status,
    finishedReason: run.finishedReason,
    origin: run.origin,
    moduleStatus,
    probes,
    stats: { sources: sources.size, probes: total, ok }
  }
}

/** 有界 AI 摘要事实行 */
export function diagAiSummary(run: DiagRun, nameOf: (id: DiagModuleId) => string): string[] {
  const lines: string[] = []
  for (const m of run.modules) {
    for (const p of m.probes) {
      if (p.status === 'success') {
        if (p.ip) {
          lines.push(`[${nameOf(m.id)}] ${p.target ?? p.targetHost ?? p.id}: 出口 ${p.ip}${p.family ? `(${p.family})` : ''}${p.geo ? `，归属 ${[p.geo.country, p.geo.isp].filter(Boolean).join(' ')}（来源 ${p.geo.source}）` : ''}${p.node ? `，节点 ${p.node}` : ''}，机制 ${p.mechKey}，数据源 ${p.source}`)
        } else if (p.node) {
          lines.push(`[${nameOf(m.id)}] ${p.cdn ?? p.target ?? p.id}: 节点 ${p.node}${p.cacheSignals?.length ? `，缓存信号 ${p.cacheSignals.join(' → ')}` : ''}，数据源 ${p.source}`)
        } else if (p.dnsRecords) {
          lines.push(`[${nameOf(m.id)}] ${p.target ?? p.id}: 应答成功${p.ecsSubnet ? `，ECS 网段 ${p.ecsSubnet}` : ''}${p.ip ? '' : '，未取得递归出口（仅 ECS/TXT）'}`)
        } else {
          lines.push(`[${nameOf(m.id)}] ${p.target ?? p.targetHost ?? p.id}: 可达${p.httpStatus ? `（HTTP ${p.httpStatus}）` : ''}（不回显出口）`)
        }
      } else if (p.status !== 'skipped' && p.status !== 'pending' && p.status !== 'queued') {
        lines.push(`[${nameOf(m.id)}] ${p.target ?? p.targetHost ?? p.id}: ${p.status}${p.error ? `（${p.error.slice(0, 80)}）` : ''}`)
      }
    }
  }
  return lines.slice(0, 80)
}

// ---------------- 并发工具 ----------------

async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    for (;;) {
      const idx = i++
      if (idx >= items.length) return
      await fn(items[idx])
    }
  })
  await Promise.all(workers)
}

// ---------------- 骨架 ----------------

function sukkaProbeSpec(): ProbeSpec {
  return {
    id: 'sukka-page',
    source: 'sukka-page',
    sourceUrl: SUKKA_PAGE_URL,
    target: 'ip.skk.moe',
    targetHost: 'ip.skk.moe',
    url: SUKKA_PAGE_URL,
    method: '页面流程提取（ip.skk.moe 自身检测完成后读取其展示结果）',
    mechKey: 'page',
    via: 'browser-page'
  }
}

function dnsJobSpecs(systemServer: string): { spec: DnsJobSpec; }[] {
  const jobs: { spec: DnsJobSpec }[] = []
  for (const res of DNS_RESOLVERS) {
    const server = res.system ? systemServer : res.server
    for (const rec of DNS_PROBE_NAMES) {
      jobs.push({
        spec: {
          id: `dns-${res.id}-${rec.source}`,
          source: rec.source,
          sourceUrl: rec.sourceUrl,
          target: res.name,
          targetHost: rec.host,
          method: `DNS TXT（UDP 直连 ${res.system ? '系统配置解析器' : res.server}）`,
          mechKey: 'dns-udp',
          via: 'dns-udp',
          queryName: rec.host,
          server,
          zoneSource: rec.source as DnsJobSpec['zoneSource'],
          resolverKind: res.system ? 'system' : 'public',
          serverAddr: server
        }
      })
    }
  }
  return jobs
}

/** 按目标配置构建模块骨架（全部探测项 queued） */
export function buildSkeleton(modules: DiagModuleId[]): DiagModule[] {
  const out: DiagModule[] = []
  if (modules.includes('publicIp')) {
    out.push({
      id: 'publicIp',
      status: 'running',
      probes: publicIpProbeSpecs().map(makeProbe)
    })
  }
  if (modules.includes('splitTunnel')) {
    out.push({ id: 'splitTunnel', status: 'running', probes: splitProbeSpecs().map(makeProbe) })
  }
  if (modules.includes('cdnNode')) {
    out.push({ id: 'cdnNode', status: 'running', probes: cdnProbeSpecs().map(makeProbe) })
  }
  if (modules.includes('dnsExit')) {
    let systemServer = ''
    try {
      systemServer = getServers()[0] ?? ''
    } catch {
      systemServer = ''
    }
    out.push({
      id: 'dnsExit',
      status: 'running',
      probes: dnsJobSpecs(systemServer).map((j) => makeProbe(j.spec))
    })
  }
  return out
}

// ---------------- 归属富化 ----------------

/** 对已取得出口 IP 且无归属的探测项查询归属（失败保留 IP，归属显示未获取） */
async function enrichGeo(runId: string, moduleId: DiagModuleId, probeId: string): Promise<void> {
  const run = getRun(runId)
  if (!run) return
  const found = findProbe(run, probeId)
  if (!found || found.module.id !== moduleId) return
  const p = found.probe
  if (!p.ip || p.geo) return
  const lang = getSettings().appearance.language === 'en' ? 'en' : 'zh'
  const geo = await lookupGeo(p.ip, lang)
  if (!geo) return
  const run2 = getRun(runId)
  if (!run2) return
  const found2 = findProbe(run2, probeId)
  if (!found2 || found2.probe.ip !== p.ip) return
  found2.probe.geo = geo
  emitProbe(run2, moduleId, found2.probe)
}

// ---------------- 模块执行 ----------------

async function execModule(run: DiagRun, h: RunHandle, m: DiagModule, light: boolean): Promise<void> {
  const aborted = (): boolean => h.canceled || Date.now() > h.deadline
  m.startedAt = new Date().toISOString()

  if (m.id === 'publicIp') {
    // Cloudflare trace（跟随系统代理）×2 + IPv6 直连 + Sukka 页面（完整模式）
    const targets = publicIpProbeSpecs()
    await runLimited(m.probes, MAX_PROBE_CONCURRENCY, async (p) => {
      if (aborted()) {
        p.status = 'canceled'
        p.error = h.canceled ? '已取消' : '整轮超时，未执行'
        emitProbe(run, m.id, p)
        return
      }
      if (p.mechKey === 'node-direct') {
        await execIpv6Probe(p, aborted)
      } else if (p.id === 'sukka-page') {
        await execSukkaPage(run, h, p)
      } else {
        await execHttpProbe(p, {
          parse: ({ status, body, durationMs }) => {
            if (body == null) return { error: '响应不可读', evidence: [{ kind: 'http', status, durationMs, note: 'Cloudflare /cdn-cgi/trace' }] }
            const t = body.split('\n').reduce<Record<string, string>>((acc, line) => {
              const i = line.indexOf('=')
              if (i > 0) acc[line.slice(0, i)] = line.slice(i + 1)
              return acc
            }, {})
            if (!t.ip) return { error: '响应中无 ip 字段' }
            return {
              patch: { ip: t.ip, family: t.ip.includes(':') ? 'ipv6' : 'ipv4', node: t.colo },
              evidence: [{ kind: 'http', status, durationMs, snippet: body.slice(0, 2000), note: 'Cloudflare /cdn-cgi/trace 原文' }]
            }
          },
          shouldAbort: aborted
        })
      }
      emitProbe(run, m.id, p)
      m.status = aggregateStatus(m.probes)
      emitModule(run, m.id)
      if (p.ip && !p.geo) void enrichGeo(run.runId, m.id, p.id)
    })
    if (!light && !aborted()) {
      const sk = makeProbe(sukkaProbeSpec())
      m.probes.push(sk)
      emitProbe(run, m.id, sk)
      await execSukkaPage(run, h, sk)
      emitProbe(run, m.id, sk)
      if (sk.ip && !sk.geo) void enrichGeo(run.runId, m.id, sk.id)
    }
  } else if (m.id === 'splitTunnel') {
    await runLimited(m.probes, MAX_PROBE_CONCURRENCY, async (p) => {
      if (aborted()) {
        p.status = 'canceled'
        p.error = h.canceled ? '已取消' : '整轮超时，未执行'
        emitProbe(run, m.id, p)
        return
      }
      const target = SPLIT_TARGETS.find((t) => `split-${t.name}` === p.id)
      if (!target) {
        p.status = 'failed'
        p.error = '目标配置缺失'
        emitProbe(run, m.id, p)
        return
      }
      await execSplitProbe(p, target, aborted)
      emitProbe(run, m.id, p)
      m.status = aggregateStatus(m.probes)
      emitModule(run, m.id)
      if (p.ip && !p.geo) void enrichGeo(run.runId, m.id, p.id)
    })
  } else if (m.id === 'cdnNode') {
    await runLimited(m.probes, MAX_PROBE_CONCURRENCY, async (p) => {
      if (aborted()) {
        p.status = 'canceled'
        p.error = h.canceled ? '已取消' : '整轮超时，未执行'
        emitProbe(run, m.id, p)
        return
      }
      const target = CDN_TARGETS.find((t) => `cdn-${t.cdn}` === p.id)
      if (!target) {
        p.status = 'failed'
        p.error = '目标配置缺失'
        emitProbe(run, m.id, p)
        return
      }
      p.cdn = target.cdn
      await execCdnProbe(p, target, aborted)
      emitProbe(run, m.id, p)
      m.status = aggregateStatus(m.probes)
      emitModule(run, m.id)
    })
  } else if (m.id === 'dnsExit') {
    let systemServer = ''
    try {
      systemServer = getServers()[0] ?? ''
    } catch {
      systemServer = ''
    }
    const specById = new Map(dnsJobSpecs(systemServer).map((j) => [j.spec.id, j.spec]))
    await runLimited(m.probes, MAX_PROBE_CONCURRENCY, async (p) => {
      if (aborted()) {
        p.status = 'canceled'
        p.error = h.canceled ? '已取消' : '整轮超时，未执行'
        emitProbe(run, m.id, p)
        return
      }
      const spec = specById.get(p.id)
      if (!spec || !spec.server) {
        p.status = 'unsupported'
        p.error = spec?.server ? '' : '未能获取系统解析器地址'
        if (!spec) p.error = '目标配置缺失'
        emitProbe(run, m.id, p)
        return
      }
      await execDnsProbe(p, spec, aborted)
      emitProbe(run, m.id, p)
      m.status = aggregateStatus(m.probes)
      emitModule(run, m.id)
    })
  }

  m.finishedAt = new Date().toISOString()
  m.status = aggregateStatus(m.probes)
  emitModule(run, m.id)
}

/** Sukka 页面流程：隐藏窗口加载，页面自身检测完成后提取展示结果；挑战页如实上报 */
async function execSukkaPage(run: DiagRun, h: RunHandle, p: DiagProbe): Promise<void> {
  const { HiddenPage, CHALLENGE_DETECT_EXPR } = await import('../providers/base/hiddenPage')
  const page = new HiddenPage()
  h.resources.push(page)
  p.status = 'running'
  p.startedAt = new Date().toISOString()
  const t0 = Date.now()
  try {
    await page.open({ url: SUKKA_PAGE_URL, timeoutMs: 6000 })
    const deadline = Date.now() + 30000
    // 手动轮询页面自身检测完成（同时检查取消）
    while (Date.now() < deadline && !h.canceled) {
      const ready = await page
        .eval<boolean>(
          `(() => { const t = document.body ? document.body.innerText : ''; return /DNS 出口查询|DNS Exit/.test(t) && !/获取中|正在获取/.test(t.slice(-400)) })()`
        )
        .catch(() => false)
      if (ready) break
      await new Promise((r) => setTimeout(r, 800))
    }
    if (h.canceled) {
      p.status = 'canceled'
      p.error = '已取消'
      p.finishedAt = new Date().toISOString()
      p.durationMs = Date.now() - t0
      return
    }
    const challenge = await page.eval<boolean>(CHALLENGE_DETECT_EXPR)
    if (challenge) {
      p.status = 'failed'
      p.error = '站点返回人机验证页（Cloudflare 挑战）。按合规约束不绕过验证：可在软件内浏览器手动完成验证后重试'
      p.finishedAt = new Date().toISOString()
      p.durationMs = Date.now() - t0
      return
    }
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
    const data = typeof extract === 'string' ? (JSON.parse(extract) as { ipv4?: string; ipv6?: string; asn?: string; snippet?: string }) : null
    p.finishedAt = new Date().toISOString()
    p.durationMs = Date.now() - t0
    if (!data || (!data.ipv4 && !data.ipv6)) {
      p.status = 'failed'
      p.error = '页面已加载但未能提取到出口结果（页面结构可能已改版）'
      p.evidence = data?.snippet ? [{ kind: 'page', snippet: String(data.snippet).slice(0, 800), note: '页面文本摘录' }] : undefined
      return
    }
    p.status = 'success'
    // IPv4 / IPv6 任一取得即保存实际地址（只有 IPv6 时也必须保留 IPv6）
    p.ip = data.ipv4 ?? data.ipv6
    p.family = data.ipv4 ? 'ipv4' : 'ipv6'
    p.evidence = [
      {
        kind: 'page',
        snippet: String(data.snippet ?? '').slice(0, 800),
        note: '页面文本摘录（ip.skk.moe 自身检测结果）'
      }
    ]
  } catch (e) {
    p.status = 'failed'
    p.error = `页面流程失败：${String(e instanceof Error ? e.message : e).slice(0, 160)}`
    p.finishedAt = new Date().toISOString()
    p.durationMs = Date.now() - t0
  } finally {
    await Promise.resolve(page.close()).catch(() => undefined)
  }
}

// ---------------- 终结 ----------------

/** 停止 / 超时后终结全部未完成状态；保留成功结果 */
function finalizeRun(runId: string, reason: 'canceled' | 'timeout'): void {
  const run = getRun(runId)
  const h = handles.get(runId)
  if (!run || !h || h.finished) return
  h.finished = true
  h.canceled = reason === 'canceled'
  for (const m of run.modules) {
    for (const p of m.probes) {
      if (p.status === 'queued' || p.status === 'running') {
        p.status = reason === 'canceled' ? 'canceled' : 'timeout'
        p.error = reason === 'canceled' ? '已取消（未完成）' : `整轮超时（${RUN_TIMEOUT_MS / 1000}s）`
        p.finishedAt = new Date().toISOString()
      }
    }
    m.status = aggregateStatus(m.probes, reason === 'timeout')
    if (!m.finishedAt) m.finishedAt = new Date().toISOString()
    emitModule(run, m.id)
  }
  const okCount = run.modules.flatMap((m) => m.probes).filter((p) => p.status === 'success').length
  run.status = okCount > 0 ? 'partial' : reason === 'canceled' ? 'canceled' : 'timeout'
  run.finishedReason = reason
  run.finishedAt = new Date().toISOString()
  emitRun(run)
  // 清理外部资源（隐藏窗口等）
  for (const r of h.resources.splice(0)) {
    void Promise.resolve(r.close()).catch(() => undefined)
  }
}

// ---------------- 对外接口 ----------------

/** 启动一轮诊断：立即返回 runId 与完整骨架（页面可逐行渲染） */
export async function startRun(modules: DiagModuleId[], origin: DiagStartRequest['origin'], detectionId?: string): Promise<{ runId: string; run: DiagRun }> {
  const valid = modules.filter((m) => ['publicIp', 'splitTunnel', 'cdnNode', 'dnsExit'].includes(m))
  // 若已有进行中的轮次，先按取消终结（新轮开始后旧轮迟到结果全部作废）
  if (lastRunId) {
    const prev = getRun(lastRunId)
    if (prev && prev.status === 'running') finalizeRun(lastRunId, 'canceled')
  }
  const runId = newRunId()
  const h: RunHandle = { canceled: false, finished: false, deadline: Date.now() + RUN_TIMEOUT_MS, resources: [] }
  const run: DiagRun = {
    runId,
    detectionId: detectionId || undefined,
    startedAt: new Date().toISOString(),
    status: 'running',
    origin,
    modules: buildSkeleton(valid)
  }
  rememberRun(run)
  handles.set(runId, h)
  const light = origin === 'dashboard'
  if (light && run.modules.some((m) => m.id === 'publicIp')) {
    // 轻量模式：publicIp 不跑 Sukka 页面（由 execModule 的 light 分支控制）
  }
  void (async () => {
    const hardDeadline = setTimeout(() => {
      if (!h.finished) finalizeRun(runId, 'timeout')
    }, RUN_TIMEOUT_MS + 5000)
    try {
      await runLimited(run.modules, MAX_MODULE_CONCURRENCY, async (m) => {
        if (h.finished) return
        await execModule(run, h, m, light)
      })
      if (!h.finished) {
        h.finished = true
        clearTimeout(hardDeadline)
        for (const m of run.modules) m.status = aggregateStatus(m.probes)
        run.status = aggregateTop(() => run.modules.map((m) => m.status))
        run.finishedReason = 'completed'
        run.finishedAt = new Date().toISOString()
        emitRun(run)
      }
    } catch (e) {
      if (!h.finished) {
        h.finished = true
        clearTimeout(hardDeadline)
        run.status = 'failed'
        run.modules.forEach((m) => { m.error = String(e instanceof Error ? e.message : e).slice(0, 200) })
        run.finishedAt = new Date().toISOString()
        emitRun(run)
      }
    } finally {
      clearTimeout(hardDeadline)
      for (const r of h.resources.splice(0)) {
        void Promise.resolve(r.close()).catch(() => undefined)
      }
    }
  })()
  return { runId, run }
}

export function stopRun(runId?: string): boolean {
  const id = runId ?? lastRunId
  if (!id) return false
  const run = getRun(id)
  if (!run || run.status !== 'running') return false
  finalizeRun(id, 'canceled')
  return true
}

/** 按 runId 获取（供综合检测关联等待 / 页面恢复） */
export function getDiagRun(runId: string): DiagRun | null {
  return getRun(runId)
}

/** 单项重试：不清空其他结果；尝试历史追加；完成后重新聚合模块与整轮 */
export async function retryProbes(runId: string, probeIds: string[]): Promise<boolean> {
  const run = getRun(runId)
  if (!run) return false
  const h = handles.get(runId)
  const aborted = (): boolean => h?.canceled ?? false
  const targets = probeIds.slice(0, 20)
  await runLimited(targets, 2, async (probeId) => {
    const found = findProbe(run, probeId)
    if (!found) return
    const { module: m, probe: p } = found
    if (p.status === 'running' || p.status === 'queued') return
    p.status = 'running'
    emitProbe(run, m.id, p)
    if (m.id === 'publicIp') {
      if (p.mechKey === 'node-direct') await execIpv6Probe(p, aborted)
      else if (p.id === 'sukka-page') await execSukkaPage(run, { canceled: false, finished: false, deadline: Date.now() + 40000, resources: [] }, p)
      else
        await execHttpProbe(p, {
          parse: ({ status, body, durationMs }) => {
            if (body == null) return { error: '响应不可读' }
            const t = body.split('\n').reduce<Record<string, string>>((acc, line) => {
              const i = line.indexOf('=')
              if (i > 0) acc[line.slice(0, i)] = line.slice(i + 1)
              return acc
            }, {})
            if (!t.ip) return { error: '响应中无 ip 字段' }
            return {
              patch: { ip: t.ip, family: t.ip.includes(':') ? 'ipv6' : 'ipv4', node: t.colo },
              evidence: [{ kind: 'http', status, durationMs, snippet: body.slice(0, 2000), note: 'Cloudflare /cdn-cgi/trace 原文' }]
            }
          },
          shouldAbort: aborted
        })
    } else if (m.id === 'splitTunnel') {
      const target = SPLIT_TARGETS.find((t) => `split-${t.name}` === p.id)
      if (target) await execSplitProbe(p, target, aborted)
    } else if (m.id === 'cdnNode') {
      const target = CDN_TARGETS.find((t) => `cdn-${t.cdn}` === p.id)
      if (target) await execCdnProbe(p, target, aborted)
    } else if (m.id === 'dnsExit') {
      let systemServer = ''
      try {
        systemServer = getServers()[0] ?? ''
      } catch {
        systemServer = ''
      }
      const spec = dnsJobSpecs(systemServer).find((j) => j.spec.id === p.id)?.spec
      if (spec && spec.server) await execDnsProbe(p, spec, aborted)
      else {
        p.status = 'unsupported'
        p.error = spec ? '未能获取系统解析器地址' : '目标配置缺失'
      }
    }
    emitProbe(run, m.id, p)
    m.status = aggregateStatus(m.probes)
    emitModule(run, m.id)
    if (p.ip && !p.geo) void enrichGeo(run.runId, m.id, p.id)
  })
  // 重新聚合整轮（保留 finishedReason 语义：完成后重试 → completed）
  if (run.finishedAt) {
    run.status = aggregateTop(() => run.modules.map((m) => aggregateStatus(m.probes)))
    run.finishedReason = run.finishedReason === 'canceled' && run.status !== 'canceled' ? 'completed' : run.finishedReason
    emitRun(run)
  }
  return true
}

export { TARGETS_VERIFIED_AT }
