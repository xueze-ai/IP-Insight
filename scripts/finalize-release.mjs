import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// =============================================================
// 打包后整理：
// 1. 把 electron-builder 默认命名的 zip 便携包重命名为
//    产品文档要求的 IP-Insight-Portable.zip；
// 2. 为所有发布产物生成 SHA256SUMS.txt（供用户校验下载完整性，
//    也是 WinGet 上架与日后申请免费代码签名时需要的材料）；
// 3. 打印产物清单。
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

// 生成 SHA256SUMS.txt（只覆盖本次构建的安装包 / 便携包 / yml）
const sums = []
for (const f of fs.readdirSync(rel).sort()) {
  if (!/\.(exe|zip|yml)$/i.test(f)) continue
  const buf = fs.readFileSync(path.join(rel, f))
  const sha = crypto.createHash('sha256').update(buf).digest('hex')
  sums.push(`${sha}  ${f}`)
  console.log(`[finalize] sha256 ${f}`)
}
if (sums.length) {
  fs.writeFileSync(path.join(rel, 'SHA256SUMS.txt'), sums.join('\n') + '\n')
  console.log('[finalize] SHA256SUMS.txt 已生成')
}

console.log('[finalize] release 产物：')
for (const f of fs.readdirSync(rel)) {
  const st = fs.statSync(path.join(rel, f))
  if (st.isFile()) {
    console.log(`  ${f}  ${(st.size / 1048576).toFixed(1)} MB`)
  }
}
