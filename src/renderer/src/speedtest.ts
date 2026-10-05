import SpeedTest, { type MeasurementConfig } from '@cloudflare/speedtest'

// 测量计划：沿用 Cloudflare 官方默认的 latency / download / upload 阶段，
// 但去掉 packetLoss——它依赖 WebRTC TURN，在代理环境下凭证不可达并会导致测试无法 finish。
const MEASUREMENTS: MeasurementConfig[] = [
  { type: 'latency', numPackets: 2 },
  { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 1e5, count: 9 },
  { type: 'latency', numPackets: 2 },
  { type: 'download', bytes: 1e6, count: 8 },
  { type: 'latency', numPackets: 2 },
  { type: 'upload', bytes: 1e5, count: 8 },
  { type: 'latency', numPackets: 2 },
  { type: 'upload', bytes: 1e6, count: 6 },
  { type: 'latency', numPackets: 2 },
  { type: 'download', bytes: 1e7, count: 6 },
  { type: 'latency', numPackets: 2 },
  { type: 'upload', bytes: 1e7, count: 4 },
  { type: 'latency', numPackets: 2 },
  { type: 'download', bytes: 25e6, count: 4 },
  { type: 'latency', numPackets: 2 },
  { type: 'upload', bytes: 25e6, count: 4 },
  { type: 'latency', numPackets: 2 },
  { type: 'download', bytes: 1e8, count: 3 },
  { type: 'latency', numPackets: 2 },
  { type: 'upload', bytes: 5e7, count: 3 },
  { type: 'latency', numPackets: 2 },
  { type: 'download', bytes: 25e7, count: 2 }
]

// 测速页：在隐藏 Chromium 页面内真实运行 Cloudflare 官方测速引擎。
// 所有数值来自真实测量；不生成、不估算、不回退到假数据。

interface SpeedtestState {
  phase: string // starting | running | <measurement type> | finished | error
  error?: string
  trace?: Record<string, string> // 出口参考（1.1.1.1 公开 trace）
  summary?: Record<string, number | boolean> // download/upload=bps, latency/jitter=ms, packetLoss=0-1
  scores?: Record<string, unknown> // AIM 体验评分
  log: string[]
  startedAt: number
  finishedAt?: number
}

declare global {
  interface Window {
    __SPEEDTEST__: SpeedtestState
  }
}

const state: SpeedtestState = {
  phase: 'starting',
  log: [],
  startedAt: Date.now()
}
window.__SPEEDTEST__ = state

const log = (m: string): void => {
  state.log.push(`${Date.now()}: ${m}`)
}
window.addEventListener('error', (e) => log(`window.error ${e.message}`))
window.addEventListener('unhandledrejection', (e) =>
  log(`unhandledrejection ${String(e.reason)}`)
)

function parseTrace(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1)
  }
  return out
}

async function main(): Promise<void> {
  // 出口参考：Cloudflare 公开 trace（与测速同为当前默认公网出口），仅用于关联出口 IP
  log('trace start')
  try {
    const r = await fetch('https://1.1.1.1/cdn-cgi/trace')
    state.trace = parseTrace(await r.text())
    log(`trace ok ip=${state.trace['ip']} loc=${state.trace['loc']}`)
  } catch (e) {
    state.trace = { error: String(e) }
    log(`trace fail ${String(e)}`)
  }

  state.phase = 'running'
  log('engine construct (packetLoss skipped)')
  const engine = new SpeedTest({
    autoStart: true,
    measurements: MEASUREMENTS,
    logAimApiUrl: null // 关闭汇总结果上报；测量请求本身仍打到 Cloudflare（这是测速本质）
  })

  engine.onPhaseChange = ({ measurement }) => {
    state.phase = measurement.type
    log(`phase ${measurement.type}`)
  }
  engine.onResultsChange = ({ type }) => {
    // 记录当前已得到的汇总快照，判断带宽是否已测完
    const s = engine.results.getSummary()
    log(
      `results ${type} down=${s.download != null ? Math.round(s.download / 1e6) : '-'} up=${
        s.upload != null ? Math.round(s.upload / 1e6) : '-'
      } ping=${s.latency ?? '-'} loss=${s.packetLoss ?? '-'}`
    )
  }
  engine.onError = (message, status) => {
    state.phase = 'error'
    state.error = `${status ?? ''} ${message}`.trim()
    log(`engine error ${state.error}`)
  }
  engine.onFinish = (results) => {
    state.phase = 'finished'
    state.summary = results.getSummary() as Record<string, number | boolean>
    state.scores = results.getScores()
    state.finishedAt = Date.now()
    log('finish')
  }
}

void main()
