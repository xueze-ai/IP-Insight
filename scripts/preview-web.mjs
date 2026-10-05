import http from 'http'
import fs from 'fs'
import path from 'path'

// 浏览器 Demo 预览静态服务器：服务 out/renderer（含 demo mock 自动注入）。
// 用法：npm run build && npm run preview:web → 打开 http://127.0.0.1:4173/

const root = path.resolve('out/renderer')
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
}

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (p === '/' || p === '') p = '/index.html'
    const file = path.join(root, p)
    if (!file.startsWith(root)) {
      res.writeHead(403)
      res.end()
      return
    }
    fs.readFile(file, (e, d) => {
      if (e) {
        res.writeHead(404)
        res.end('404')
        return
      }
      res.writeHead(200, {
        'content-type': types[path.extname(file)] || 'application/octet-stream'
      })
      res.end(d)
    })
  })
  .listen(4173, '127.0.0.1', () =>
    console.log('preview at http://127.0.0.1:4173/')
  )
