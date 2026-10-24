// =============================================================
// 从 Demo 预览生成 docs/images 截图（样例数据，文档保留地址）。
// 用法: node scripts/capture-demo.cjs
// 规则：
// · 每步断言（导航 / 按钮找不到 → 报错退出，绝不静默保存错图）。
// · 截图前强制浅色主题与中文界面，保证文档一致性。
// · 每张截图后校验 PNG 非空且尺寸合理。
// =============================================================
const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const IMG = path.join(ROOT, 'docs', 'images')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let server
let failed = false

function assert(cond, msg) {
  if (!cond) {
    console.error(`[CAP][FAIL] ${msg}`)
    failed = true
    throw new Error(msg)
  }
  console.log(`[CAP][ok] ${msg}`)
}

app.whenReady().then(async () => {
  server = spawn('node', ['scripts/preview-web.mjs'], { cwd: ROOT, stdio: 'ignore' })
  await sleep(4000)
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: true,
    backgroundColor: '#ffffff',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  await win.loadURL('http://127.0.0.1:4173/')
  await sleep(2200)
  const wc = win.webContents
  const exec = (e) => wc.executeJavaScript(e, true)
  const must = async (expr, msg) => {
    const v = await exec(expr).catch((e) => `THREW: ${String(e).slice(0, 120)}`)
    assert(v === true, `${msg} (got ${JSON.stringify(String(v).slice(0, 80))})`)
  }
  const clickText = async (text, msg) =>
    must(
      `(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(b){b.click();return true}return false})()`,
      msg ?? `click「${text}」`
    )
  const navTo = async (text) =>
    must(
      `(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(el){el.click();return true}return false})()`,
      `导航到「${text}」`
    )
  const clickTab = async (text) =>
    must(
      `(function(){var b=[].slice.call(document.querySelectorAll('.diag-tab')).find(function(x){return x.textContent.indexOf(${JSON.stringify(text)})>=0});if(b){b.click();return true}return false})()`,
      `切换标签「${text}」`
    )
  const shot = async (name, mustContain) => {
    await sleep(700)
    if (mustContain) {
      const body = String(await exec(`document.body.innerText.replace(/\\s+/g,' ')`))
      assert(body.includes(mustContain), `截图前校验 ${name}：页面应包含「${mustContain}」；实际片段：${body.slice(0, 300)}`)
    }
    const img = await wc.capturePage()
    const png = img.toPNG()
    assert(png.length > 20000, `截图 ${name} 内容非空（${png.length}B）`)
    fs.writeFileSync(path.join(IMG, name), png)
    console.log(`[CAP] ${name} ${png.length}B`)
  }

  try {
    // 强制浅色主题 + 中文：主题首帧来自 localStorage 缓存（可能残留深色），需同时清缓存与 DOM 属性
    await exec(`localStorage.setItem('ipi-theme','light'); document.documentElement.setAttribute('data-theme','light'); undefined`)
    await exec(`window.ipInsight.setSettings({ appearance: { theme: 'light', language: 'zh' } }); undefined`)
    await sleep(600)

    // 01 综合检测
    await clickText('开始综合检测', '点击开始综合检测')
    await sleep(5200)
    await shot('01-dashboard.png', '检测完成')

    // 02 多源完整结果（独立截图，修复与 01 同图问题）
    await clickText('查看完整检测结果', '展开完整检测结果')
    await sleep(900)
    await shot('02-multisource.png', '多源一致性')

    // 03 网络质量（新顺序：测速 → 全球节点 → 本机可达性 → 服务可用性）
    await navTo('网络质量')
    await sleep(1100)
    await shot('03-network-quality.png', '服务可用性')

    // 04 网络出口诊断 · 概览（独立页面）
    await navTo('网络出口诊断')
    await sleep(1000)
    await shot('04-exitdiag-overview.png', '本轮概况')

    // 05 网站分流（默认标签）：跑完一次诊断展示真实行结构
    const started = await exec(
      `(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.indexOf('开始全部检测')>=0 || x.textContent.indexOf('重新全部检测')>=0});if(b){b.click();return true}return false})()`
    )
    assert(started === true, '点击开始/重新全部检测')
    await sleep(12000)
    await shot('05-exitdiag-split.png', '网站分流测试')

    // 06 本机公网 IP
    await clickTab('本机公网 IP')
    await sleep(700)
    await shot('06-exitdiag-publicip.png', '观测点')

    // 07 CDN 命中节点
    await clickTab('CDN 命中节点')
    await sleep(700)
    await shot('07-exitdiag-cdn.png', '原始节点标识')

    // 08 DNS 出口查询
    await clickTab('DNS 出口查询')
    await sleep(700)
    await shot('08-exitdiag-dns.png', '系统配置解析器')

    // 09 风险分析
    await navTo('风险分析')
    await sleep(1000)
    await shot('09-risk.png', '综合风险等级')

    // 10 浏览器指纹（独立截图）
    await navTo('浏览器指纹')
    await sleep(1000)
    await shot('10-fingerprint.png', 'BROWSER')

    // 11 AI 分析（独立截图；先等 Demo 报告流式完成）
    await navTo('AI 分析')
    await sleep(900)
    await clickText('生成分析', '生成分析')
    await sleep(6500)
    await shot('11-ai.png', '结论速览')

    // 12 历史记录
    await navTo('历史记录')
    await sleep(1000)
    await exec(`document.querySelector('.hist-main')?.click(); true`)
    await sleep(600)
    await shot('12-history.png', '检测时间')

    // 13 设置
    await navTo('设置')
    await sleep(900)
    await shot('13-settings.png', '主题模式')

    console.log('[CAP] ALL DONE')
  } catch (e) {
    console.error('[CAP] aborted:', String(e).slice(0, 200))
    process.exitCode = 1
  } finally {
    server?.kill()
    app.quit()
  }
})
