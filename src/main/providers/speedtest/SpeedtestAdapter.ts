import type {
  AdapterContext,
  NormalizedIPResult,
  ProviderAdapter,
  ProviderMeta
} from '@shared/types'
import { HiddenPage } from '../base/hiddenPage'

// =============================================================
// SpeedtestAdapter - 第 5 类「本机检测」
// 在隐藏 Chromium 页面内运行 Cloudflare 官方测速引擎，真实测量
// Download / Upload / Ping / Jitter / PacketLoss，不自行实现、不估算。
// =============================================================

export const SPEEDTEST_META: ProviderMeta = {
  id: 'local_speedtest',
  name: '本机测速 · Cloudflare',
  sourceUrl: 'https://speed.cloudflare.com/'
}

interface SpeedtestState {
  phase: string
  error?: string
  trace?: Record<string, string>
  summary?: Record<string, number | boolean>
  scores?: Record<string, unknown>
  startedAt: number
  finishedAt?: number
}

const READY_EXPR =
  "(window.__SPEEDTEST__ && (window.__SPEEDTEST__.phase==='finished' || window.__SPEEDTEST__.phase==='error'))"

export class SpeedtestAdapter implements ProviderAdapter {
  readonly meta = SPEEDTEST_META

  async detect(ctx: AdapterContext = {}): Promise<NormalizedIPResult> {
    const onLog = ctx.onLog ?? (() => undefined)
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    // 开发：dev server 多页面；生产：安全自定义 origin（ipinsight://app），避免 file:// null origin
    const pageUrl = devUrl
      ? `${devUrl}/speedtest.html`
      : 'ipinsight://app/speedtest.html'

    const page = new HiddenPage()
    let lastPhase = ''
    await page.open({
      url: pageUrl,
      timeoutMs: ctx.timeoutMs ?? 90000,
      readyExpr: READY_EXPR,
      // 把隐藏页内测速引擎的实时阶段推给上层（UI 显示当前阶段，不伪造进度）
      tickExpr: "(window.__SPEEDTEST__ && window.__SPEEDTEST__.phase) || ''",
      onTick: (v) => {
        if (v && v !== lastPhase) {
          lastPhase = v
          onLog(`阶段: ${v}`)
        }
      },
      pollIntervalMs: 800,
      onLog
    })

    const st = await page.eval<SpeedtestState>('window.__SPEEDTEST__')
    await page.close()

    const base: NormalizedIPResult = {
      provider: SPEEDTEST_META,
      fetchedAt: new Date().toISOString(),
      ok: false,
      raw: st ?? undefined
    }
    if (!st) return { ...base, error: '测速页面无响应' }

    const downRaw = st.summary?.download
    const upRaw = st.summary?.upload
    const down = typeof downRaw === 'number' ? downRaw : null
    const up = typeof upRaw === 'number' ? upRaw : null

    // 致命错误且无带宽数据 → 如实判失败；附加项（如丢包/TURN）失败但带宽已得，仍算成功
    if (st.phase === 'error' && (down == null || up == null)) {
      return { ...base, error: st.error || '测速失败，未取得带宽数据' }
    }
    if (down == null && up == null) {
      return { ...base, error: '测速未产生 Download/Upload 数据' }
    }

    return {
      ...base,
      ok: true,
      ip: st.trace?.ip, // 关联当前出口（真实 trace），位置等其余信息不臆造
      downloadMbps: down != null ? down / 1e6 : null,
      uploadMbps: up != null ? up / 1e6 : null,
      raw: st
    }
  }
}

export const speedtestAdapter = new SpeedtestAdapter()
