import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// =============================================================
// 打包后整理：
// 1. 把 electron-builder 默认命名的 zip 便携包重命名为 IP-Insight-Portable.zip；
// 2. 生成 SHA256SUMS.txt —— **只包含当前版本（package.json version）的产物**：
//    磁盘上已有的旧版本安装包 / 便携包 / 调试文件保留不动，但不混入校验和，
//    避免「旧包混入清单」与哈希对不上的问题；
// 3. 打印「当前版本产物」与「磁盘其他文件（未纳入清单）」两组清单。
// =============================================================

const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'))
const ver = pkg.version

const rel = path.resolve('release')
if (!fs.existsSync(rel)) {
  console.error('[finalize] release 目录不存在')
  process.exit(1)
}

for (const f of fs.readdirSync(rel)) {
  // electron-builder 的 zip 目标按 win.artifactName 生成 <name>-<ver>-Setup.zip
  if (new RegExp(`-${ver}(-Setup)?\\.zip$`, 'i').test(f) && !/Portable/i.test(f)) {
    const from = path.join(rel, f)
    const to = path.join(rel, 'IP-Insight-Portable.zip')
    if (fs.existsSync(to)) fs.rmSync(to)
    fs.renameSync(from, to)
    console.log(`[finalize] ${f} -> IP-Insight-Portable.zip`)
  }
}

const isCurrent = (f) =>
  f === 'IP-Insight-Portable.zip' ||
  f === 'latest.yml' ||
  f.includes(ver) ||
  /^IP-Insight-Setup\.exe(\.blockmap)?$/i.test(f)

const files = fs.readdirSync(rel).filter((f) => fs.statSync(path.join(rel, f)).isFile())
const current = files
  .filter((f) => f !== 'SHA256SUMS.txt' && f !== 'builder-debug.yml')
  .filter(isCurrent)
  .filter((f) => /\.(exe|zip|yml|blockmap)$/i.test(f))
  .sort()

if (!current.length) {
  console.error(`[finalize] 未找到版本 ${ver} 的产物（期望 IP-Insight-${ver}-Setup.exe / IP-Insight-Portable.zip）`)
  process.exit(1)
}

const sums = []
for (const f of current) {
  const buf = fs.readFileSync(path.join(rel, f))
  const sha = crypto.createHash('sha256').update(buf).digest('hex')
  sums.push(`${sha}  ${f}`)
  console.log(`[finalize] sha256 ${f}`)
}
fs.writeFileSync(path.join(rel, 'SHA256SUMS.txt'), sums.join('\n') + '\n')
console.log(`[finalize] SHA256SUMS.txt 已生成（仅 v${ver}，共 ${current.length} 个文件）`)

console.log(`[finalize] 当前版本（v${ver}）产物：`)
for (const f of current) {
  const st = fs.statSync(path.join(rel, f))
  console.log(`  ${f}  ${(st.size / 1048576).toFixed(1)} MB`)
}
const others = files.filter((f) => !current.includes(f) && f !== 'SHA256SUMS.txt')
if (others.length) {
  console.log('[finalize] 磁盘上未纳入清单的文件（旧版本 / 调试文件，保留未动）：')
  for (const f of others) console.log(`  - ${f}`)
}
