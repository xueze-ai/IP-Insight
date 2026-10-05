import { BrowserWindow } from 'electron'

// =============================================================
// HiddenPage - 所有 Provider Adapter 共用的隐藏浏览器底座
// 职责：在后台创建不可见的真实 Chromium 窗口，加载目标网址，
//      轮询等待 JS 执行出真实结果，再运行提取脚本，最后清理。
// 不做任何验证码绕过 / 反爬规避；遇到挑战页由各 Adapter 判定并上报。
// =============================================================

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

export interface HiddenPageOptions {
  url: string
  width?: number
  height?: number
  timeoutMs?: number
  // 在页面上下文轮询的 JS 表达式：返回 truthy 表示结果已出现
  readyExpr?: string
  // 每轮轮询额外求值的表达式，结果经 onTick 回传（用于把测速阶段等中间状态推给上层）
  tickExpr?: string
  onTick?: (value: string) => void
  pollIntervalMs?: number
  onLog?: (message: string) => void
}

export class HiddenPage {
  private win: BrowserWindow | null = null

  get webContents() {
    return this.win?.webContents ?? null
  }

  async open(opts: HiddenPageOptions): Promise<BrowserWindow> {
    const {
      url,
      width = 1280,
      height = 800,
      timeoutMs = 30000,
      readyExpr,
      tickExpr,
      onTick,
      pollIntervalMs = 600,
      onLog
    } = opts

    const win = new BrowserWindow({
      show: false,
      width,
      height,
      webPreferences: {
        // 提取脚本只读取页面自身内容；保持与正常浏览器一致的环境
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: true,
        images: true
      }
    })
    this.win = win

    // 隐藏窗口后台加载，不抢占前台、不弹窗打扰用户
    win.setMenuBarVisibility(false)
    onLog?.(`加载页面：${url}`)

    // 不依赖 did-finish-load（部分站点持续加载），直接发起导航后轮询
    void win.loadURL(url).catch((e) => onLog?.(`loadURL 提示：${String(e)}`))

    if (readyExpr) {
      const deadline = Date.now() + timeoutMs
      let ready = false
      while (Date.now() < deadline) {
        try {
          ready = !!(await win.webContents.executeJavaScript(readyExpr, true))
        } catch {
          /* 页面上下文尚未就绪，继续轮询 */
        }
        if (tickExpr && onTick) {
          try {
            const tick = await win.webContents.executeJavaScript(tickExpr, true)
            onTick(String(tick ?? ''))
          } catch {
            /* 页面上下文尚未就绪，忽略本轮 tick */
          }
        }
        if (ready) break
        await sleep(pollIntervalMs)
      }
      onLog?.(ready ? '检测结果已出现' : '等待结果超时，尝试提取现有内容')
    } else {
      await sleep(Math.min(timeoutMs, 4000))
    }
    return win
  }

  async eval<T>(expression: string): Promise<T | null> {
    if (!this.win) return null
    try {
      return (await this.win.webContents.executeJavaScript(expression, true)) as T
    } catch (e) {
      return null
    }
  }

  async close(): Promise<void> {
    if (!this.win) return
    try {
      this.win.destroy()
    } catch {
      /* ignore */
    }
    this.win = null
  }
}

// 探测是否处于 Cloudflare / 人机验证挑战页（不绕过，仅识别）
export const CHALLENGE_DETECT_EXPR = `
(() => {
  const t = (document.title || '') + ' ' + (document.body ? document.body.innerText.slice(0, 500) : '');
  return /Just a moment|Checking your browser|验证中|人机验证|Please wait while|cf-challenge|challenge-platform/i.test(t);
})()
`
