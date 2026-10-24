// 核验 docs/images 截图主题（采样像素亮度）+ 直接读取 PNG 头
const { app, nativeImage } = require('electron')
const path = require('path')
app.whenReady().then(() => {
  const files = ['01-dashboard.png', '05-exitdiag-split.png', '13-settings.png']
  for (const f of files) {
    const img = nativeImage.createFromPath(path.join(__dirname, '..', 'docs', 'images', f))
    const sz = img.getSize()
    if (!sz.width) {
      console.log('[PX]', f, 'FAILED to load')
      continue
    }
    const bm = img.getBitmap()
    let sum = 0
    let n = 0
    for (let y = 20; y < sz.height - 20; y += 24) {
      for (let x = 20; x < sz.width - 20; x += 24) {
        const i = (y * sz.width + x) * 4
        sum += 0.299 * bm[i] + 0.587 * bm[i + 1] + 0.114 * bm[i + 2]
        n++
      }
    }
    console.log('[PX]', f, `${sz.width}x${sz.height}`, 'avgBrightness=', (sum / n).toFixed(1), n, 'samples')
  }
  app.quit()
})
