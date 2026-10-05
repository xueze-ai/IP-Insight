import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell } from 'electron'
import { existsSync } from 'fs'
import { join, normalize } from 'path'
import { pathToFileURL } from 'url'
import { ping0Adapter } from './providers/ping0/Ping0Adapter'
import { netCoffeeAdapter } from './providers/netcoffee/NetCoffeeAdapter'
import { netCoffeeGptAdapter } from './providers/netcoffee-gpt/NetCoffeeGptAdapter'
import { ippureAdapter } from './providers/ippure/IPPureAdapter'
import { speedtestAdapter } from './providers/speedtest/SpeedtestAdapter'
import { fetchServiceStatus } from './providers/netcoffee/serviceStatus'
import { probeReachability } from './providers/localprobe/reachability'
import { getSettings, setSettings, resetSettings } from './settings'
import {
  listHistory,
  saveHistory,
  getHistory,
  updateHistoryAi,
  deleteHistory,
  clearHistory
} from './history'
import { exportToFile, defaultReportName } from './exportReport'
import { chatStream } from './ai/client'
import { buildMessages } from './ai/prompt'
import { AI_PROVIDER_META } from '@shared/aiProviders'
import type {
  AiAnalyzeRequest,
  AiProviderConfig,
  AppSettings,
  DeepPartial,
  ExportFormat,
  HistoryRecord,
  NormalizedIPResult,
  ReportModel
} from '@shared/types'

// =============================================================
// IP Insight - Electron 主进程
// 负责：创建主窗口、注册检测 IPC、在软件内部打开原始数据源网站。
// =============================================================

// 自定义安全 origin：生产环境用 ipinsight://app 承载前端，
// 避免 file:// 的 null origin 造成跨域 fetch / 连接行为异常（Cloudflare 测速需要正常 origin）。
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ipinsight',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      allowServiceWorkers: true
    }
  }
])

let mainWindow: BrowserWindow | null = null

// 实测/回归钩子的输出目录：开发态默认项目 test-output；
// 打包态 asar 内不可写，用 IPI_TEST_OUT 环境变量指向外部目录。
async function testOutDir(): Promise<string> {
  const fs = await import('fs')
  const dir = process.env['IPI_TEST_OUT'] || join(__dirname, '../../test-output')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// 运行时窗口图标：生产环境取 extraResources（process.resourcesPath），
// 开发环境取项目根 resources/；统一使用用户提供的 Logo.png。
function appIconPath(): string | undefined {
  const candidates = [
    join(process.resourcesPath || '', 'resources', 'Logo.png'),
    join(app.getAppPath(), 'resources', 'Logo.png')
  ]
  return candidates.find((p) => p && existsSync(p))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#f7f8fa',
    show: true,
    title: '网鉴',
    icon: appIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  // 诊断：加载失败 / 渲染进程异常 / 渲染 console 输出到主进程终端
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) =>
    console.log('[FAIL_LOAD]', code, desc, url))
  mainWindow.webContents.on('render-process-gone', (_e, d) =>
    console.log('[RENDER_GONE]', JSON.stringify(d)))
  mainWindow.webContents.on('console-message', (_e, _lvl, message) =>
    console.log('[RENDER_CONSOLE]', message))

  // 开发环境由 electron-vite 注入 dev server，生产环境加载打包后的 HTML
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadURL('ipinsight://app/index.html')
  }
}

// [UI 回归钩子] IPI_UI_VERIFY=1：在真实主进程内自动跑完整 UI 流程并 capturePage。
// IPC handler 与四个 Adapter 均为真实注册，确保检测是真实的；不影响正常启动。
async function setupUiVerify(): Promise<void> {
  if (process.env['IPI_UI_VERIFY'] !== '1' || !mainWindow) return
  const wc = mainWindow.webContents
  const sleep = (ms: number): Promise<void> =>
    new Promise((r) => setTimeout(r, ms))
  const click = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(b){b.click();return true}return false})()`
    )
  const has = (text: string): Promise<boolean> =>
    wc.executeJavaScript(
      `[].slice.call(document.querySelectorAll('button')).some(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0})`
    )

  await new Promise<void>((resolve) => {
    if (!wc.isLoading()) resolve()
    else wc.once('did-finish-load', () => resolve())
  })
  await sleep(1200)

  console.log('[UI_VERIFY] start')
  await click('开始综合检测')
  const t0 = Date.now()
  while (!(await has('查看完整检测结果'))) {
    if (Date.now() - t0 > 150000) throw new Error('UI_VERIFY timeout')
    await sleep(1000)
  }
  await sleep(1200)

  const fsV = await import('fs')
  let img = await wc.capturePage()
  fsV.writeFileSync(
    join(__dirname, '../../test-output/ui-done-summary.png'),
    img.toPNG()
  )
  await click('查看完整检测结果')
  await sleep(1000)

  const shot = async (name: string): Promise<void> => {
    const i = await wc.capturePage()
    fsV.writeFileSync(join(__dirname, '../../test-output/' + name), i.toPNG())
  }
  const scrollEyebrow = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `[].slice.call(document.querySelectorAll('.card-eyebrow')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0})?.closest('.card')?.scrollIntoView({block:'start'})`
    )
  const navTo = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(el){el.click();return true}return false})()`
    )

  // 主出口一致性（ChatGPT 出口已分离，不参与主出口类型比较）
  await scrollEyebrow('多源一致性')
  await sleep(700)
  await shot('ui-consistency.png')

  // ChatGPT 出口独立画像
  await scrollEyebrow('ChatGPT 出口')
  await sleep(700)
  await shot('ui-exit-chatgpt.png')

  // 导航到 IP 信息页
  await navTo('IP 信息')
  await sleep(1600)
  await shot('ui-ipinfo.png')

  // IP 信息扩展卡片
  await scrollEyebrow('扩展网络信息')
  await sleep(700)
  await shot('ui-ipinfo-ext.png')

  console.log('[UI_VERIFY] done')
  app.quit()
}

// [UI 回归钩子] IPI_UI_VERIFY_NETWORK=1：导航到「网络质量」页，真实跑一次测速，
// 截图 idle / running / done 三个状态，验证页面渲染与测速闭环。
async function setupNetworkVerify(): Promise<void> {
  if (process.env['IPI_UI_VERIFY_NETWORK'] !== '1' || !mainWindow) return
  const wc = mainWindow.webContents
  const sleep = (ms: number): Promise<void> =>
    new Promise((r) => setTimeout(r, ms))
  const click = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(b){b.click();return true}return false})()`
    )
  const has = (text: string): Promise<boolean> =>
    wc.executeJavaScript(
      `[].slice.call(document.querySelectorAll('button,.speed-value,.badge')).some(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0})`
    )
  const navTo = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(el){el.click();return true}return false})()`
    )
  const shot = async (name: string): Promise<void> => {
    try {
      const fsV = await import('fs')
      const i = await wc.capturePage()
      fsV.writeFileSync(join(__dirname, '../../test-output/' + name), i.toPNG())
    } catch (e) {
      // 桌面会话锁定 / 窗口未合成时截图不可用，不影响流程验证
      console.log('[NET_VERIFY] shot skip', name, String(e))
    }
  }

  await new Promise<void>((resolve) => {
    if (!wc.isLoading()) resolve()
    else wc.once('did-finish-load', () => resolve())
  })
  await sleep(1200)

  try {
    console.log('[NET_VERIFY] start')
    await navTo('网络质量')
    await sleep(800)
    await shot('net-quality-idle.png')

    const bodyText = (): Promise<string> =>
      wc.executeJavaScript(
        `document.body.innerText.replace(/\\s+/g,' ').slice(0,240)`
      )
    console.log('[NET_VERIFY] clickret', await click('开始测速'))
    await sleep(6000)
    console.log('[NET_VERIFY] t6', await bodyText())
    await shot('net-quality-running.png')

    const t0 = Date.now()
    let lastLog = 0
    while (!(await has('重新测速'))) {
      if (Date.now() - t0 > 200000) throw new Error('NET_VERIFY timeout')
      await sleep(2000)
      if (Date.now() - lastLog > 20000) {
        lastLog = Date.now()
        console.log(
          '[NET_VERIFY] wait',
          Math.round((Date.now() - t0) / 1000),
          await bodyText()
        )
      }
    }
    await sleep(800)
    await shot('net-quality-done.png')

    console.log(
      '[NET_VERIFY] hasGlobalNodes',
      await wc.executeJavaScript(`document.body.innerText.includes('中国上海')`)
    )
    console.log(
      '[NET_VERIFY] hasServices',
      await wc.executeJavaScript(`document.body.innerText.includes('服务可用性')`)
    )
    console.log('[NET_VERIFY] done')
  } catch (e) {
    console.log('[NET_VERIFY] error', String(e))
  } finally {
    app.quit()
  }
}

// [UI 回归钩子] IPI_UI_VERIFY_RISK=1：真实跑一次综合检测，再导航到「风险分析」页，
// dump 页面文本验证多源风险渲染（截图在部分桌面会话下不可用，文本为准）。
async function setupRiskVerify(): Promise<void> {
  if (process.env['IPI_UI_VERIFY_RISK'] !== '1' || !mainWindow) return
  const wc = mainWindow.webContents
  const sleep = (ms: number): Promise<void> =>
    new Promise((r) => setTimeout(r, ms))
  const click = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(b){b.click();return true}return false})()`
    )
  const has = (text: string): Promise<boolean> =>
    wc.executeJavaScript(
      `[].slice.call(document.querySelectorAll('button')).some(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0})`
    )
  const navTo = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(el){el.click();return true}return false})()`
    )

  await new Promise<void>((resolve) => {
    if (!wc.isLoading()) resolve()
    else wc.once('did-finish-load', () => resolve())
  })
  await sleep(1200)

  try {
    console.log('[RISK_VERIFY] start')
    await click('开始综合检测')
    const t0 = Date.now()
    while (!(await has('查看完整检测结果'))) {
      if (Date.now() - t0 > 180000) throw new Error('RISK_VERIFY detect timeout')
      await sleep(1500)
    }
    await navTo('风险分析')
    await sleep(1200)
    const text: string = await wc.executeJavaScript(
      `document.body.innerText.replace(/\\s+/g,' ')`
    )
    console.log('[RISK_VERIFY] text', text.slice(0, 2600))
    try {
      const fsV = await import('fs')
      const img = await wc.capturePage()
      fsV.writeFileSync(
        join(__dirname, '../../test-output/risk-page.png'),
        img.toPNG()
      )
    } catch (e) {
      console.log('[RISK_VERIFY] shot skip', String(e))
    }
    console.log('[RISK_VERIFY] done')
  } catch (e) {
    console.log('[RISK_VERIFY] error', String(e))
  } finally {
    app.quit()
  }
}

// [UI 回归钩子] IPI_UI_VERIFY_SETTINGS=1：验证设置页 / AI 页渲染与设置持久化往返，
// 以及 AI 未配置 Key 时的真实报错路径（不伪造成功）。
async function setupSettingsVerify(): Promise<void> {
  if (process.env['IPI_UI_VERIFY_SETTINGS'] !== '1' || !mainWindow) return
  const wc = mainWindow.webContents
  const sleep = (ms: number): Promise<void> =>
    new Promise((r) => setTimeout(r, ms))
  const click = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(b){b.click();return true}return false})()`
    )
  const navTo = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(el){el.click();return true}return false})()`
    )
  const sectionTo = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var el=[].slice.call(document.querySelectorAll('.set-nav-item')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(el){el.click();return true}return false})()`
    )
  const bodyText = (): Promise<string> =>
    wc.executeJavaScript(`document.body.innerText.replace(/\\s+/g,' ').slice(0,1500)`)
  const shot = async (name: string): Promise<void> => {
    try {
      const fsV = await import('fs')
      const i = await wc.capturePage()
      fsV.writeFileSync(join(__dirname, '../../test-output/' + name), i.toPNG())
    } catch (e) {
      console.log('[SET_VERIFY] shot skip', name, String(e))
    }
  }

  await new Promise<void>((resolve) => {
    if (!wc.isLoading()) resolve()
    else wc.once('did-finish-load', () => resolve())
  })
  await sleep(1200)

  try {
    console.log('[SET_VERIFY] start')

    // 设置持久化往返
    setSettings({ detection: { timeoutSec: 55 } })
    const rt = getSettings().detection.timeoutSec
    console.log('[SET_VERIFY] roundtrip timeoutSec=', rt)
    setSettings({ detection: { timeoutSec: 40 } })

    // AI 未配置 Key 的真实报错路径
    const testRes = await (async () => {
      try {
        return await chatStream({
          baseUrl: 'https://invalid.example/',
          apiKey: 'x',
          model: 'm',
          temperature: 0,
          maxTokens: 1,
          idleTimeoutMs: 5000,
          messages: [{ role: 'user', content: 'hi' }],
          onChunk: () => undefined
        })
      } catch (e) {
        return 'ERR:' + (e as Error).message.slice(0, 80)
      }
    })()
    console.log('[SET_VERIFY] ai unreachable path=', String(testRes).slice(0, 100))

    await navTo('设置')
    await sleep(700)
    console.log('[SET_VERIFY] appearance', (await bodyText()).slice(0, 400))
    await shot('settings-appearance.png')

    await sectionTo('AI 提供商')
    await sleep(500)
    // 展开第一个提供商配置面板
    await wc.executeJavaScript(
      `(function(){var b=document.querySelector('.prov-card .btn-icon');if(b){b.click();return true}return false})()`
    )
    await sleep(500)
    console.log('[SET_VERIFY] ai section', (await bodyText()).slice(0, 700))
    await shot('settings-ai.png')

    await navTo('AI 分析')
    await sleep(700)
    console.log('[SET_VERIFY] ai page', (await bodyText()).slice(0, 400))
    await shot('ai-page.png')

    // 空态「开始综合检测」应跳转到综合检测页并开始运行
    await navTo('风险分析')
    await sleep(600)
    await click('开始综合检测')
    await sleep(2500)
    const t4 = await bodyText()
    console.log(
      '[SET_VERIFY] empty-cta nav=',
      t4.includes('正在综合检测'),
      t4.slice(0, 160)
    )

    console.log('[SET_VERIFY] done')
  } catch (e) {
    console.log('[SET_VERIFY] error', String(e))
  } finally {
    app.quit()
  }
}

// [UI 回归钩子] IPI_UI_VERIFY_FP=1：真实综合检测后进入「浏览器指纹」页，
// 验证分组摘要与「查看详细指纹」展开（含新增 audio/fonts/visitorId）。
async function setupFpVerify(): Promise<void> {
  if (process.env['IPI_UI_VERIFY_FP'] !== '1' || !mainWindow) return
  const wc = mainWindow.webContents
  const sleep = (ms: number): Promise<void> =>
    new Promise((r) => setTimeout(r, ms))
  const click = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(b){b.click();return true}return false})()`
    )
  const has = (text: string): Promise<boolean> =>
    wc.executeJavaScript(
      `[].slice.call(document.querySelectorAll('button')).some(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0})`
    )
  const navTo = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(el){el.click();return true}return false})()`
    )
  const bodyText = (): Promise<string> =>
    wc.executeJavaScript(`document.body.innerText.replace(/\\s+/g,' ')`)

  await new Promise<void>((resolve) => {
    if (!wc.isLoading()) resolve()
    else wc.once('did-finish-load', () => resolve())
  })
  await sleep(1200)

  try {
    console.log('[FP_VERIFY] start')
    await click('开始综合检测')
    const t0 = Date.now()
    while (!(await has('查看完整检测结果'))) {
      if (Date.now() - t0 > 180000) throw new Error('FP_VERIFY detect timeout')
      await sleep(1500)
    }
    await navTo('浏览器指纹')
    await sleep(1000)
    const t1 = await bodyText()
    console.log('[FP_VERIFY] summary', t1.slice(t1.indexOf('Browser Fingerprint'), t1.indexOf('Browser Fingerprint') + 1200))
    await click('查看详细指纹')
    await sleep(700)
    const t2 = await bodyText()
    const iUa = t2.indexOf('User-Agent')
    console.log('[FP_VERIFY] detail', t2.slice(iUa, iUa + 900))
    console.log(
      '[FP_VERIFY] hasNewFields',
      await wc.executeJavaScript(
        `(() => { const t = document.body.innerText; return JSON.stringify({ audio: t.includes('音频指纹'), fonts: t.includes('检出字体'), vid: t.includes('综合指纹') }); })()`
      )
    )
    console.log('[FP_VERIFY] done')
  } catch (e) {
    console.log('[FP_VERIFY] error', String(e))
  } finally {
    app.quit()
  }
}

// [UI 回归钩子] IPI_UI_VERIFY_HIST=1：真实综合检测 → 历史自动保存 → 历史页渲染/展开/
// 载入分析页 → 四种格式导出（直写 test-output，绕过保存对话框）→ AI 回写往返。
async function setupHistVerify(): Promise<void> {
  if (process.env['IPI_UI_VERIFY_HIST'] !== '1' || !mainWindow) return
  const wc = mainWindow.webContents
  const sleep = (ms: number): Promise<void> =>
    new Promise((r) => setTimeout(r, ms))
  const click = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(b){b.click();return true}return false})()`
    )
  const has = (text: string): Promise<boolean> =>
    wc.executeJavaScript(
      `[].slice.call(document.querySelectorAll('button')).some(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0})`
    )
  const navTo = (text: string): Promise<unknown> =>
    wc.executeJavaScript(
      `(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(el){el.click();return true}return false})()`
    )
  const bodyText = (): Promise<string> =>
    wc.executeJavaScript(`document.body.innerText.replace(/\\s+/g,' ')`)

  await new Promise<void>((resolve) => {
    if (!wc.isLoading()) resolve()
    else wc.once('did-finish-load', () => resolve())
  })
  await sleep(1200)

  try {
    console.log('[HIST_VERIFY] start')
    await click('开始综合检测')
    const t0 = Date.now()
    while (!(await has('查看完整检测结果'))) {
      if (Date.now() - t0 > 180000) throw new Error('HIST_VERIFY detect timeout')
      await sleep(1500)
    }
    await sleep(1500) // 等待历史异步写入
    const list = listHistory()
    console.log('[HIST_VERIFY] saved records=', list.length, 'first=', list[0]?.id, list[0]?.currentIp, list[0]?.riskLevel, list[0]?.netType)

    await navTo('历史记录')
    await sleep(900)
    const t1 = await bodyText()
    console.log('[HIST_VERIFY] page', t1.slice(t1.indexOf('History'), t1.indexOf('History') + 500))
    await click('载入分析页') // 展开第一行详情里的按钮？先展开行
    await sleep(300)
    // 展开第一行
    await wc.executeJavaScript(
      `(function(){var b=document.querySelector('.hist-main');if(b){b.click();return true}return false})()`
    )
    await sleep(500)
    const t2 = await bodyText()
    const iD = t2.indexOf('检测时间')
    console.log('[HIST_VERIFY] detail', t2.slice(iD - 200, iD + 300))

    // 载入分析页
    await click('载入分析页')
    await sleep(900)
    const t3 = await bodyText()
    console.log('[HIST_VERIFY] loaded', t3.slice(0, 260))

    // 四格式导出（直写文件）
    const rec = listHistory()[0]
    if (rec) {
      const fsV = await import('fs')
      const dir = join(__dirname, '../../test-output')
      const model: ReportModel = {
        generatedAt: new Date().toISOString(),
        startedAt: rec.startedAt,
        finishedAt: rec.finishedAt,
        currentIp: rec.currentIp,
        successCount: rec.successCount,
        totalCount: rec.totalCount,
        sources: rec.sources.map((s) => ({
          name: s.name,
          ok: s.ok,
          error: s.error,
          durationMs: s.durationMs
        })),
        consistency: 'verify consistency text',
        fields: [{ label: 'ISP', value: 'verify' }],
        sourceDetails: rec.results.map((r) => ({
          name: r.provider.name,
          ok: r.ok,
          error: r.error,
          rows: [{ label: '公网 IP', value: r.ip ?? '—' }]
        })),
        matrix: [
          {
            field: '公网 IP',
            perSource: rec.results.map((r) => ({
              source: r.provider.name,
              value: r.ip ?? '—'
            }))
          }
        ],
        raw: rec.results.map((r) => ({ source: r.provider.name, raw: r.raw ?? null }))
      }
      for (const f of ['html', 'pdf', 'json', 'txt'] as const) {
        const p = join(dir, `report-test.${f}`)
        await exportToFile(model, f, p)
        console.log('[HIST_VERIFY] export', f, fsV.statSync(p).size, 'bytes')
      }
      // AI 回写往返
      updateHistoryAi(rec.id, '# verify ai report')
      const got = getHistory(rec.id)
      console.log('[HIST_VERIFY] ai roundtrip=', got?.aiReport)
      updateHistoryAi(rec.id, '')
    }
    console.log('[HIST_VERIFY] done')
  } catch (e) {
    console.log('[HIST_VERIFY] error', String(e))
  } finally {
    app.quit()
  }
}

app.whenReady().then(async () => {
  // 去掉默认英文菜单栏（File/Edit/View/Window），界面更干净
  Menu.setApplicationMenu(null)

  // 设置联动：退出即清历史（在启动时清理上一次会话的记录）
  if (getSettings().privacy.clearHistoryOnExit) {
    clearHistory()
  }

  // 注册自定义 origin → 本地 out/renderer 文件映射（生产环境）
  const rendererRoot = normalize(join(__dirname, '../renderer'))
  protocol.handle('ipinsight', async (request) => {
    const u = new URL(request.url)
    let pathname = decodeURIComponent(u.pathname)
    if (pathname === '/' || pathname === '') pathname = '/index.html'
    const file = normalize(join(rendererRoot, pathname))
    if (!file.startsWith(rendererRoot)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(file).href)
  })

  // [自动测试钩子] IPI_AUTO_TEST=ping0 时无头跑一次，把真实结果写入 JSON 后退出（用于实测/回归）
  if (process.env['IPI_AUTO_TEST'] === 'ping0') {
    const logs: string[] = []
    const r = await ping0Adapter.detect({
      timeoutMs: 45000,
      onLog: (m) => logs.push(m)
    })
    const fs = await import('fs')
    const dir = await testOutDir()
    fs.writeFileSync(
      join(dir, 'ping0.result.json'),
      JSON.stringify({ result: r, logs }, null, 2)
    )
    console.log('[AUTO_TEST] ok=', r.ok, 'ip=', r.ip, 'risk=', r.riskScore, r.riskLabel, 'native=', r.nativeLabel, 'asn=', r.asn)
    console.log('[AUTO_TEST] location=', JSON.stringify(r.location), 'shared=', r.sharedUsers)
    console.log('[AUTO_TEST] flags=', JSON.stringify(r.flags))
    console.log('[AUTO_TEST] scenarios=', JSON.stringify(r.scenarios?.map((s) => `${s.name}:${s.stars}`)))
    console.log('[AUTO_TEST] error=', r.error ?? 'none')
    app.quit()
    return
  }

  // [自动测试钩子] Net.Coffee
  if (process.env['IPI_AUTO_TEST'] === 'netcoffee') {
    const logs: string[] = []
    const r = await netCoffeeAdapter.detect({
      timeoutMs: 50000,
      onLog: (m) => logs.push(m)
    })
    const fs = await import('fs')
    const dir = await testOutDir()
    fs.writeFileSync(
      join(dir, 'netcoffee.result.json'),
      JSON.stringify({ result: r, logs }, null, 2)
    )
    console.log('[AUTO_TEST] ok=', r.ok, 'ip=', r.ip, 'asn=', r.asn, 'trust=', r.riskScore, r.riskLabel, 'native=', r.nativeLabel)
    console.log('[AUTO_TEST] location=', JSON.stringify(r.location), 'timezone=', r.timezone)
    console.log('[AUTO_TEST] flags=', JSON.stringify(r.flags))
    console.log('[AUTO_TEST] blacklist=', JSON.stringify(r.blacklistSummary), 'ping=', JSON.stringify(r.globalPing))
    console.log('[AUTO_TEST] error=', r.error ?? 'none')
    app.quit()
    return
  }

  // [自动测试钩子] Net.Coffee GPT
  if (process.env['IPI_AUTO_TEST'] === 'netcoffee_gpt') {
    const logs: string[] = []
    const r = await netCoffeeGptAdapter.detect({
      timeoutMs: 60000,
      onLog: (m) => logs.push(m)
    })
    const fs = await import('fs')
    const dir = await testOutDir()
    fs.writeFileSync(
      join(dir, 'netcoffee-gpt.result.json'),
      JSON.stringify({ result: r, logs }, null, 2)
    )
    console.log('[AUTO_TEST] ok=', r.ok, 'gptIp=', r.ip, 'asn=', r.asn, 'trust=', r.riskScore, r.riskLabel)
    console.log('[AUTO_TEST] flags=', JSON.stringify(r.flags))
    console.log('[AUTO_TEST] dns=', JSON.stringify(r.dnsLeak))
    console.log('[AUTO_TEST] webrtc=', JSON.stringify(r.webRTCLeak))
    console.log('[AUTO_TEST] fp=', JSON.stringify(r.fingerprint))
    console.log('[AUTO_TEST] error=', r.error ?? 'none')
    app.quit()
    return
  }

  // [自动测试钩子] IPPure
  if (process.env['IPI_AUTO_TEST'] === 'ippure') {
    const logs: string[] = []
    const r = await ippureAdapter.detect({
      timeoutMs: 40000,
      onLog: (m) => logs.push(m)
    })
    const fs = await import('fs')
    const dir = await testOutDir()
    fs.writeFileSync(
      join(dir, 'ippure.result.json'),
      JSON.stringify({ result: r, logs }, null, 2)
    )
    console.log('[AUTO_TEST] ok=', r.ok, 'ip=', r.ip, 'asn=', r.asn, 'isp=', r.isp)
    console.log('[AUTO_TEST] coef=', r.riskScore, r.riskLabel, 'native=', r.nativeLabel)
    console.log('[AUTO_TEST] flags=', JSON.stringify(r.flags), 'loc=', JSON.stringify(r.location))
    console.log('[AUTO_TEST] geoCompare=', JSON.stringify((r.raw as Record<string, unknown>)?.geoCompare))
    console.log('[AUTO_TEST] humanBot=', (r.raw as Record<string, unknown>)?.humanBot)
    console.log('[AUTO_TEST] error=', r.error ?? 'none')
    app.quit()
    return
  }

  // [自动测试钩子] 本机测速 Cloudflare
  if (process.env['IPI_AUTO_TEST'] === 'speedtest') {
    const logs: string[] = []
    const r = await speedtestAdapter.detect({
      timeoutMs: 90000,
      onLog: (m) => logs.push(m)
    })
    const fs = await import('fs')
    const dir = await testOutDir()
    fs.writeFileSync(
      join(dir, 'speedtest.result.json'),
      JSON.stringify({ result: r, logs }, null, 2)
    )
    console.log('[AUTO_TEST] ok=', r.ok, 'ip=', r.ip, 'down=', r.downloadMbps, 'up=', r.uploadMbps)
    console.log('[AUTO_TEST] summary=', JSON.stringify((r.raw as { summary?: unknown })?.summary))
    console.log('[AUTO_TEST] error=', r.error ?? 'none')
    app.quit()
    return
  }

  // [自动测试钩子] 服务状态聚合 + 本机可达性
  if (process.env['IPI_AUTO_TEST'] === 'services') {
    const f = await fetchServiceStatus()
    console.log('[AUTO_TEST] services count=', f.count, 'failing=', f.failing, 'fetchedAt=', f.fetchedAt)
    console.log('[AUTO_TEST] first3=', JSON.stringify(f.services.slice(0, 3).map((s) => `${s.name}:${s.indicator}:${s.indicator_cn}`)))
    const r = await probeReachability()
    console.log('[AUTO_TEST] reach=', JSON.stringify(r.map((x) => `${x.name}:${x.ok ? `HTTP${x.status}` : 'FAIL'}/${x.ms}ms`)))
    app.quit()
    return
  }

  // [诊断钩子] 详细诊断 speed.cloudflare.com 连接（代理解析 + 带超时 fetch）
  if (process.env['IPI_AUTO_TEST'] === 'netdiag2') {
    const urls = [
      'https://1.1.1.1/cdn-cgi/trace',
      'https://speed.cloudflare.com/cdn-cgi/trace',
      'https://speed.cloudflare.com/__down?bytes=0',
      'https://speed.cloudflare.com/__down?bytes=1000',
      'https://www.cloudflare.com/cdn-cgi/trace'
    ]
    const sess = session.defaultSession
    const proxies: Record<string, string> = {}
    for (const u of urls) proxies[u] = await sess.resolveProxy(u)
    console.log('PROXIES', JSON.stringify(proxies))

    const { HiddenPage } = await import('./providers/base/hiddenPage')
    const page = new HiddenPage()
    await page.open({ url: 'https://ippure.com/', timeoutMs: 12000 })
    const res = await page.eval(
      `(async () => {
        const urls = ${JSON.stringify(urls)}
        const out = {}
        for (const u of urls) {
          try {
            const ctrl = new AbortController()
            const to = setTimeout(() => ctrl.abort(), 8000)
            const t0 = performance.now()
            const r = await fetch(u, { signal: ctrl.signal })
            clearTimeout(to)
            out[u] = { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0) }
          } catch (e) {
            out[u] = { error: String(e), cause: e && e.cause ? String(e.cause) : undefined }
          }
        }
        return out
      })()`
    )
    await page.close()
    console.log('FETCH', JSON.stringify(res))
    app.quit()
    return
  }

  // 检测超时：以设置为准，各源保留下限保护（避免设置过短导致必然超时）
  const cfgTimeout = (): number =>
    Math.max(15, getSettings().detection.timeoutSec) * 1000

  // 运行 Ping0 检测；过程日志通过事件推给渲染层
  ipcMain.handle('detect:ping0', async (event) => {
    const onLog = (message: string): void => {
      event.sender.send('detect:log', message)
    }
    return await ping0Adapter.detect({
      timeoutMs: Math.max(cfgTimeout(), 30000),
      onLog
    })
  })

  // 运行 Net.Coffee 检测
  ipcMain.handle('detect:netcoffee', async (event) => {
    const onLog = (message: string): void => {
      event.sender.send('detect:log', message)
    }
    return await netCoffeeAdapter.detect({
      timeoutMs: Math.max(cfgTimeout(), 60000),
      onLog
    })
  })

  // 运行 Net.Coffee GPT 检测
  ipcMain.handle('detect:netcoffee_gpt', async (event) => {
    const onLog = (message: string): void => {
      event.sender.send('detect:log', message)
    }
    return await netCoffeeGptAdapter.detect({
      timeoutMs: Math.max(cfgTimeout(), 45000),
      onLog
    })
  })

  // 运行 IPPure 检测
  ipcMain.handle('detect:ippure', async (event) => {
    const onLog = (message: string): void => {
      event.sender.send('detect:log', message)
    }
    return await ippureAdapter.detect({
      timeoutMs: Math.max(cfgTimeout(), 30000),
      onLog
    })
  })

  // 运行本机测速（Cloudflare）；完整测量约 1-2 分钟，超时留足余量避免误报
  ipcMain.handle('detect:speedtest', async (event) => {
    const onLog = (message: string): void => {
      event.sender.send('detect:log', message)
    }
    return await speedtestAdapter.detect({ timeoutMs: 150000, onLog })
  })

  // 拉取 Net.Coffee 服务状态聚合（公开 data.json，只读展示）
  ipcMain.handle('fetch:serviceStatus', async () => {
    try {
      return { ok: true, feed: await fetchServiceStatus() }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  // 本机可达性实测（主进程真实 HTTP 探测）
  ipcMain.handle('probe:reachability', async () => {
    try {
      return { ok: true, results: await probeReachability() }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  // ------------ 设置 ------------
  ipcMain.handle('settings:get', async () => ({ ok: true, settings: getSettings() }))
  ipcMain.handle('settings:set', async (_event, patch: DeepPartial<AppSettings>) => ({
    ok: true,
    settings: setSettings(patch)
  }))
  ipcMain.handle('settings:reset', async () => ({ ok: true, settings: resetSettings() }))
  ipcMain.handle('app:version', async () => app.getVersion())

  // ------------ AI ------------
  // 解析提供商配置：内置（含 Ollama 等）或用户自定义
  const resolveProvider = (
    id: string
  ): { name: string; cfg: AiProviderConfig; needsKey: boolean } | null => {
    const s = getSettings()
    const meta = AI_PROVIDER_META.find((m) => m.id === id)
    if (meta && s.ai.providers[meta.id]) {
      return {
        name: meta.name,
        cfg: s.ai.providers[meta.id],
        needsKey: meta.id !== 'ollama'
      }
    }
    const custom = s.ai.customProviders?.[id]
    if (custom) return { name: custom.name || id, cfg: custom, needsKey: true }
    return null
  }

  // 连通性测试：真实发起一次最小对话，失败返回服务端真实报文
  ipcMain.handle('ai:test', async (_event, providerId: string) => {
    const p = resolveProvider(providerId)
    if (!p) return { ok: false, error: '未知的提供商' }
    const apiKey = p.cfg.apiKey.trim() || (p.needsKey ? '' : 'ollama')
    if (!apiKey) return { ok: false, error: '未填写 API Key' }
    if (!p.cfg.baseUrl.trim()) return { ok: false, error: '未填写 Base URL' }
    const t0 = Date.now()
    try {
      const r = await chatStream({
        baseUrl: p.cfg.baseUrl,
        apiKey,
        model: p.cfg.model,
        temperature: 0,
        maxTokens: 16,
        idleTimeoutMs: 30000,
        messages: [{ role: 'user', content: '请只回复两个字：收到' }],
        onChunk: () => undefined
      })
      return { ok: true, ms: Date.now() - t0, reply: r.text.slice(0, 40) }
    } catch (e) {
      return { ok: false, error: (e as Error).message, ms: Date.now() - t0 }
    }
  })

  // AI 综合分析：流式，chunk 通过 ai:chunk 事件推给渲染层；
  // 若因 max_tokens 截断（finish_reason=length）自动续写，最多续 3 次。
  ipcMain.handle('ai:analyze', async (event, payload: AiAnalyzeRequest) => {
    const s = getSettings()
    const p = resolveProvider(s.ai.current)
    if (!p) return { ok: false, error: '未选择有效的 AI 提供商' }
    const apiKey = p.cfg.apiKey.trim() || (p.needsKey ? '' : 'ollama')
    if (!apiKey)
      return { ok: false, error: '当前 AI 提供商未配置 API Key，请到「设置 → AI 提供商」填写。' }
    const results: NormalizedIPResult[] = Array.isArray(payload?.results)
      ? payload.results
      : []
    if (!results.length) return { ok: false, error: '暂无检测数据可供分析' }
    console.log('[AI] payload bytes', JSON.stringify(results).length)
    const t0 = Date.now()
    let full = ''
    try {
      const messages = buildMessages(results, String(payload?.consistency ?? ''), s.ai.extraPrompt)
      for (let cont = 0; cont < 4; cont++) {
        const r = await chatStream({
          baseUrl: p.cfg.baseUrl,
          apiKey,
          model: p.cfg.model,
          temperature: s.ai.temperature,
          maxTokens: s.ai.maxTokens,
          messages,
          onChunk: (d) => event.sender.send('ai:chunk', d),
          onStage: (st) => event.sender.send('ai:stage', st)
        })
        full += r.text
        if (r.finishReason !== 'length') break
        // 被长度截断：追加续写请求（不重复已输出内容）
        messages.push({ role: 'system' as const, content: r.text ? `【已输出内容结尾】…${r.text.slice(-400)}` : '' })
        messages.push({
          role: 'user',
          content:
            '上一次输出因长度限制被截断。请从截断处继续写完剩余内容：不要重复已完成的段落与标题，不要开场白，直接续写。'
        })
        event.sender.send('ai:chunk', '\n\n')
      }
      return {
        ok: true,
        text: full,
        provider: p.name,
        model: p.cfg.model,
        ms: Date.now() - t0
      }
    } catch (e) {
      return {
        ok: false,
        error: (e as Error).message,
        partial: full,
        provider: p.name,
        model: p.cfg.model,
        ms: Date.now() - t0
      }
    }
  })

  // ------------ 历史记录 ------------
  ipcMain.handle('history:list', async () => ({
    ok: true,
    enabled: getSettings().privacy.historyEnabled,
    records: listHistory()
  }))
  ipcMain.handle('history:get', async (_event, id: string) => {
    const record = getHistory(id)
    return record ? { ok: true, record } : { ok: false, error: '记录不存在' }
  })
  ipcMain.handle('history:save', async (_event, record: HistoryRecord) => {
    try {
      const r = saveHistory(record)
      return 'skipped' in r
        ? { ok: true, skipped: true }
        : { ok: true, id: r.id }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
  ipcMain.handle('history:updateAi', async (_event, id: string, aiReport: string) => ({
    ok: updateHistoryAi(id, aiReport)
  }))
  ipcMain.handle('history:delete', async (_event, id: string) => ({
    ok: deleteHistory(id)
  }))
  ipcMain.handle('history:clear', async () => {
    clearHistory()
    return { ok: true }
  })

  // ------------ 报告导出 ------------
  ipcMain.handle(
    'export:report',
    async (event, payload: { model: ReportModel; format: ExportFormat }) => {
      try {
        const ext = payload.format
        const win = BrowserWindow.fromWebContents(event.sender)
        const opts = {
          title: '导出检测报告',
          defaultPath: defaultReportName(ext),
          filters: [
            {
              name:
                ext === 'html'
                  ? 'HTML 网页'
                  : ext === 'pdf'
                    ? 'PDF 文档'
                    : ext === 'json'
                      ? 'JSON 数据'
                      : 'TXT 文本',
              extensions: [ext]
            }
          ]
        }
        const dlg = win
          ? await dialog.showSaveDialog(win, opts)
          : await dialog.showSaveDialog(opts)
        if (dlg.canceled || !dlg.filePath) return { ok: true, canceled: true }
        await exportToFile(payload.model, ext, dlg.filePath)
        return { ok: true, path: dlg.filePath }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )
  ipcMain.handle('export:reveal', async (_event, path: string) => {
    shell.showItemInFolder(path)
    return { ok: true }
  })

  // 在软件内部打开原始数据源网站（供用户自行验证，不做抓取）
  ipcMain.handle('open:source', async (_event, url: string) => {
    const win = new BrowserWindow({
      width: 1280,
      height: 820,
      backgroundColor: '#0d1117',
      autoHideMenuBar: true,
      icon: appIconPath()
    })
    await win.loadURL(url)
    return true
  })

  createWindow()
  void setupUiVerify()
  void setupNetworkVerify()
  void setupRiskVerify()
  void setupSettingsVerify()
  void setupFpVerify()
  void setupHistVerify()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
