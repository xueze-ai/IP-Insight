// 从 Demo 预览重新生成 docs/images 下的界面截图（样例数据，文档保留地址）
// 用法: node scripts/capture-demo.cjs
const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const IMG = path.join(ROOT, 'docs', 'images')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let server
app.whenReady().then(async () => {
  server = spawn('node', ['scripts/preview-web.mjs'], { cwd: ROOT, stdio: 'ignore' })
  await sleep(4000)
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  await win.loadURL('http://127.0.0.1:4173/')
  await sleep(2000)
  const wc = win.webContents
  const exec = (e) => wc.executeJavaScript(e, true)
  const click = (t) => exec(`(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.indexOf(${JSON.stringify(t)})>=0});if(b){b.click();return true}return false})()`)
  const nav = (t) => exec(`(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return x.textContent.indexOf(${JSON.stringify(t)})>=0});if(el){el.click();return true}return false})()`)
  const shot = async (name) => {
    const img = await wc.capturePage()
    fs.writeFileSync(path.join(IMG, name), img.toPNG())
    console.log('[CAP] ' + name + ' ' + img.toPNG().length)
  }

  // 01 综合检测：运行检测 → 完成摘要
  await click('开始综合检测')
  await sleep(6000)
  await shot('01-dashboard.png')
  // 02 多源完整结果
  await click('查看完整检测结果')
  await sleep(800)
  await shot('02-multisource.png')
  await click('收起完整结果')

  // 03 网络质量：跑一次完整出口诊断（Demo 约 5s 完成）后截取
  await nav('网络质量')
  await sleep(1500)
  const clicked = await click('一键出口诊断')
  if (!clicked) await click('重新诊断全部')
  await sleep(20000)
  await exec("document.getElementById('exit-diag')?.scrollIntoView({block:'start'})")
  await sleep(600)
  await shot('03-network.png')

  // 04 风险分析
  await nav('风险分析')
  await sleep(1000)
  await shot('04-risk.png')

  // 05 浏览器指纹
  await nav('浏览器指纹')
  await sleep(1000)
  await shot('05-fingerprint.png')

  // 06 AI 分析（生成一次样例报告）
  await nav('AI 分析')
  await sleep(1000)
  await click('生成分析报告')
  await sleep(7000)
  await shot('06-ai.png')

  // 07 历史记录（demo 自带样例，展开第一条）
  await nav('历史记录')
  await sleep(1000)
  await exec("document.querySelector('.hist-main')?.click()")
  await sleep(600)
  await shot('07-history.png')

  // 08 设置（外观）
  await nav('设置')
  await sleep(900)
  await shot('08-settings.png')

  server?.kill()
  app.quit()
}).catch((e) => {
  console.log('[CAP] ERR', String(e).slice(0, 200))
  server?.kill()
  app.quit()
})
