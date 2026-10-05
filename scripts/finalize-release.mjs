import fs from 'fs'
import path from 'path'

// =============================================================
// 打包后整理：把 electron-builder 默认命名的 zip 便携包重命名为
// 产品文档要求的 IP-Insight-Portable.zip，并打印产物清单。
// =============================================================

const rel = path.resolve('release')
if (!fs.existsSync(rel)) {
  console.error('[finalize] release 目录不存在')
  process.exit(1)
}

for (const f of fs.readdirSync(rel)) {
  if (/\.zip$/i.test(f) && !/Portable/i.test(f)) {
    const from = path.join(rel, f)
    const to = path.join(rel, 'IP-Insight-Portable.zip')
    fs.renameSync(from, to)
    console.log(`[finalize] ${f} -> IP-Insight-Portable.zip`)
  }
}

console.log('[finalize] release 产物：')
for (const f of fs.readdirSync(rel)) {
  const st = fs.statSync(path.join(rel, f))
  if (st.isFile()) {
    console.log(`  ${f}  ${(st.size / 1048576).toFixed(1)} MB`)
  }
}
