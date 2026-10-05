import type { ReachProbeResult } from '@shared/types'
import { HiddenPage } from '../base/hiddenPage'

// =============================================================
// 本机可达性实测（第 5 类「本机检测」）
// 在隐藏浏览器页（probe.html）上下文内发起 no-cors fetch：
//   · 与真实浏览器相同的网络栈、请求头（UA / sec-fetch-* 等）
//   · 遵循系统代理（与浏览器一致；仅配置在浏览器插件内的代理不在此列）
//   · 收到任何响应（opaque 亦算）记为可达；网络层失败记为不可达并保留真实错误
// 每个目标失败自动重试 1 次；不估算、不伪造。
// =============================================================

export const REACH_TARGETS: { name: string; url: string }[] = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'OpenAI API', url: 'https://api.openai.com/v1/models' },
  { name: 'Claude', url: 'https://claude.ai/' },
  { name: 'Google', url: 'https://www.google.com/generate_204' },
  { name: 'YouTube', url: 'https://www.youtube.com/' },
  { name: 'GitHub', url: 'https://github.com/' },
  { name: 'Cloudflare', url: 'https://www.cloudflare.com/cdn-cgi/trace' },
  { name: '抖音', url: 'https://www.douyin.com/' },
  { name: '百度', url: 'https://www.baidu.com/' },
  { name: 'Bilibili', url: 'https://www.bilibili.com/' }
]

const TIMEOUT_MS = 8000

const PROBE_EXPR = (targetsJson: string): string => `
(async () => {
  const targets = ${targetsJson};
  const probeOne = async (url) => {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), ${TIMEOUT_MS});
      await fetch(url, { mode: 'no-cors', cache: 'no-store', redirect: 'follow', signal: ctrl.signal });
      clearTimeout(to);
      return { ok: true, ms: Date.now() - t0 };
    } catch (e) {
      return { ok: false, ms: Date.now() - t0, error: String(e && e.message ? e.message : e) };
    }
  };
  const out = [];
  for (const t of targets) {
    let r = await probeOne(t.url);
    if (!r.ok) {
      // 失败自动重试一次，避免瞬时抖动误判
      const r2 = await probeOne(t.url);
      if (r2.ok) r = r2;
    }
    out.push({ name: t.name, host: new URL(t.url).host, ok: r.ok, ms: r.ms, error: r.error || null });
  }
  return out;
})()
`

export async function probeReachability(): Promise<ReachProbeResult[]> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const pageUrl = devUrl ? `${devUrl}/probe.html` : 'ipinsight://app/probe.html'
  const page = new HiddenPage()
  try {
    await page.open({
      url: pageUrl,
      timeoutMs: 15000,
      readyExpr: 'window.__PROBE_READY__ === true',
      pollIntervalMs: 300
    })
    const res = await page.eval<ReachProbeResult[]>(PROBE_EXPR(JSON.stringify(REACH_TARGETS)))
    if (!res || !Array.isArray(res)) {
      throw new Error('探针页无返回')
    }
    return res.map((r) => ({
      name: r.name,
      host: r.host,
      ok: !!r.ok,
      ms: r.ms,
      error: r.error ?? undefined
    }))
  } finally {
    await page.close()
  }
}
