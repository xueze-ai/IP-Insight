// 深色截图亮度断言 + 英文界面校验（改进版：语言切换后 reload）
const { app, BrowserWindow, nativeImage } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'test-output')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let server
function brightnessOf(img) {
  const bm = img.getBitmap()
  const sz = img.getSize()
  let sum = 0
  let n = 0
  for (let y = 20; y < sz.height - 20; y += 30) {
    for (let x = 20; x < sz.width - 20; x += 30) {
      const i = (y * sz.width + x) * 4
      sum += 0.299 * bm[i] + 0.587 * bm[i + 1] + 0.114 * bm[i + 2]
      n++
    }
  }
  return sum / n
}
app.whenReady().then(async () => {
  server = spawn('node', ['scripts/preview-web.mjs'], { cwd: ROOT, stdio: 'ignore' })
  await sleep(4000)
  const win = new BrowserWindow({ width: 1280, height: 820, show: true, webPreferences: {} })
  await win.loadURL('http://127.0.0.1:4173/')
  await sleep(2000)
  const wc = win.webContents
  const exec = (e) => wc.executeJavaScript(e, true).catch((e2) => 'THREW ' + String(e2).slice(0, 80))

  // ① 深色主题出口诊断页
  const darkB = brightnessOf(nativeImage.createFromPath(path.join(OUT, 'dark-exitdiag.png')))
  console.log('[THEME] dark-exitdiag brightness =', darkB.toFixed(1), darkB < 120 ? '(深色 ✓)' : '(异常：偏亮)')

  // ② 英文界面：设置语言后 reload 生效
  // 走真实用户路径：设置页 → 外观 → English（setLang 即时生效并持久化）
  await exec(`(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return x.textContent.indexOf('设置')>=0});if(el){el.click();return true}return false})()`)
  await sleep(900)
  await exec(`(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.textContent.trim()==='English'});if(b){b.click();return true}return false})()`)
  await sleep(1200)
  await exec(`localStorage.setItem('ipi-theme','light'); document.documentElement.setAttribute('data-theme','light'); undefined`)
  await exec(`(function(){var el=[].slice.call(document.querySelectorAll('.nav-item')).find(function(x){return /Exit Diagnostics/.test(x.textContent)});if(el){el.click();return true}return false})()`)
  await sleep(1200)
  const enText = String(await exec(`document.body.innerText.replace(/\\s+/g,' ').slice(0,300)`))
  fs.writeFileSync(path.join(OUT, 'en-exitdiag.png'), (await wc.capturePage()).toPNG())
  console.log('[LANG] nav-en-found:', /Exit Diagnostics/.test(enText))
  console.log('[LANG] overview-en:', /HTTP egress|exits observed/.test(enText))
  console.log('[LANG] text:', enText.slice(0, 220))
  server?.kill()
  app.quit()
})
