import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'
import { getSettings } from './settings'
import { mt } from './i18n'

// =============================================================
// 自动更新：electron-updater + GitHub Releases。
// - 仅在打包后的生产环境运行；开发模式（npm run dev）跳过。
// - 启动约 8 秒后在后台检查一次（尊重 设置→关于→自动检查更新 开关）。
// - 发现新版本自动在后台下载；下载完成后通知渲染层，
//   由用户决定「立即重启更新」还是下次退出时自动安装。
// - publish 配置在 package.json → build.publish（GitHub provider）。
//   打包（npm run dist）会自动生成 latest.yml 并随安装包上传 Release。
// =============================================================

let initialized = false
let getMainWindow: (() => BrowserWindow | null) | null = null

function send(status: UpdateStatus): void {
  try {
    getMainWindow?.()?.webContents.send('update:status', status)
  } catch {
    /* 窗口已关闭时忽略 */
  }
}

/**
 * 把 electron-updater 的原始报错（常含完整 URL、HTTP 头、堆栈，不宜直接展示）
 * 翻译成面向用户的友好文案；原始信息只打到控制台方便排查。
 */
export function friendlyUpdateError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  console.log('[update] raw error:', raw)
  if (/latest\.yml/i.test(raw) || /\b404\b/.test(raw)) {
    return mt('updateNoRelease')
  }
  if (
    /ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|fetch failed|getaddrinfo|network|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_/i.test(
      raw
    )
  ) {
    return mt('updateNetworkError')
  }
  return mt('updateCheckFailed')
}

export function initAutoUpdate(getWindow: () => BrowserWindow | null): void {
  if (initialized) return
  initialized = true
  getMainWindow = getWindow

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[update] checking-for-update')
    send({ state: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    console.log('[update] update-available', info.version)
    send({ state: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', (info) => {
    console.log('[update] update-not-available', info.version)
    send({ state: 'up-to-date', version: info.version })
  })
  autoUpdater.on('download-progress', (p) => {
    send({ state: 'downloading', percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[update] update-downloaded', info.version)
    send({ state: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    // 原始报错只记日志；推给界面的是友好文案
    send({ state: 'error', message: friendlyUpdateError(err) })
  })

  if (!app.isPackaged) {
    console.log('[update] 开发模式：跳过自动更新检查（打包后生效）')
    return
  }

  // 启动后延迟检查，避免和「启动时自动检测」抢网速
  setTimeout(() => {
    try {
      if (getSettings().updates.autoCheck) {
        void checkForUpdates()
      }
    } catch (e) {
      console.log('[update] auto check failed', String(e))
    }
  }, 8000)
}

/** 手动触发检查更新（渲染层「检查更新」按钮）。 */
export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    send({ state: 'error', message: mt('updateDevMode') })
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    send({ state: 'error', message: friendlyUpdateError(e) })
  }
}

/** 下载完成后：立即退出并安装新版本。 */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
