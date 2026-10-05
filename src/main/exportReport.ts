import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import { join } from 'path'
import type { ExportFormat, ReportModel } from '@shared/types'

// =============================================================
// 报告导出：HTML / PDF / JSON / TXT
// 报告内容（文档 §17）：检测时间、IP、四个数据源、多源对比、AI 分析。
// HTML / PDF / TXT 面向人类阅读：逐源摘要明细 + 多源对比矩阵，不堆原始 JSON；
// JSON 面向机器：保留完整结构化数据（含各源 raw）。
// PDF 由隐藏窗口对同一份 HTML 执行 printToPDF 生成，所见即所得。
// 落款：网鉴（IP Insight）· 版权所有 © 2026 薛泽。
// =============================================================

const SIGNATURE = '网鉴（IP Insight）· 版权所有 © 2026 薛泽（Xue Ze）'
const REPO = 'https://github.com/xueze-ai?tab=repositories'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/* 极简 Markdown → HTML（AI 分析段落用）：标题 / 列表 / 加粗 / 行内代码 */
function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false
  const closeLists = (): void => {
    if (inUl) {
      out.push('</ul>')
      inUl = false
    }
    if (inOl) {
      out.push('</ol>')
      inOl = false
    }
  }
  const inline = (s: string): string =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      closeLists()
      continue
    }
    if (line.startsWith('### ')) {
      closeLists()
      out.push(`<h4>${inline(line.slice(4))}</h4>`)
    } else if (line.startsWith('## ')) {
      closeLists()
      out.push(`<h3>${inline(line.slice(3))}</h3>`)
    } else if (line.startsWith('# ')) {
      closeLists()
      out.push(`<h2>${inline(line.slice(2))}</h2>`)
    } else if (/^【.+】$/.test(line.trim())) {
      closeLists()
      out.push(`<h3>${inline(line.trim())}</h3>`)
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!inUl) {
        closeLists()
        out.push('<ul>')
        inUl = true
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      if (!inOl) {
        closeLists()
        out.push('<ol>')
        inOl = true
      }
      out.push(`<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`)
    } else {
      closeLists()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeLists()
  return out.join('\n')
}

export function buildJson(model: ReportModel): string {
  return JSON.stringify(model, null, 2)
}

/* ---------- TXT：人类可读摘要版 ---------- */
export function buildTxt(model: ReportModel): string {
  const L: string[] = []
  const line = '='.repeat(64)
  const sub = '-'.repeat(64)
  L.push(line)
  L.push('网鉴 · IP Insight 网络环境综合检测报告')
  L.push(line)
  L.push(`报告生成时间：${fmtTime(model.generatedAt)}`)
  L.push(`检测时间：${fmtTime(model.startedAt)} — ${fmtTime(model.finishedAt)}`)
  L.push(`公网 IP：${model.currentIp ?? '—'}`)
  L.push(`数据源：${model.successCount}/${model.totalCount} 成功`)
  L.push('')
  L.push('一、数据源检测明细')
  L.push(sub)
  for (const d of model.sourceDetails) {
    L.push(`◆ ${d.name}　${d.ok ? '成功' : `失败（${d.error ?? '未知原因'}）`}${d.durationMs != null ? `　耗时 ${(d.durationMs / 1000).toFixed(1)}s` : ''}`)
    for (const row of d.rows) L.push(`    ${row.label}：${row.value}`)
    L.push('')
  }
  L.push('二、关键字段（多源聚合）')
  L.push(sub)
  for (const f of model.fields) L.push(`· ${f.label}：${f.value}`)
  L.push('')
  L.push('三、多源对比矩阵')
  L.push(sub)
  for (const m of model.matrix) {
    L.push(`· ${m.field}`)
    for (const p of m.perSource) L.push(`    - ${p.source}：${p.value}`)
  }
  L.push('')
  L.push('四、多源一致性结论')
  L.push(sub)
  L.push(model.consistency)
  L.push('')
  L.push('五、AI 综合分析')
  L.push(sub)
  L.push(model.ai ? model.ai : '（本次报告未包含 AI 分析）')
  L.push('')
  L.push(line)
  L.push(SIGNATURE)
  L.push(`项目仓库：${REPO}`)
  return L.join('\r\n')
}

/* ---------- HTML：人类可读摘要版（PDF 同源） ---------- */
export function buildHtml(model: ReportModel): string {
  const sourceCards = model.sourceDetails
    .map((d) => {
      const rows = d.rows
        .map((r) => `<tr><td class="k">${esc(r.label)}</td><td>${esc(r.value)}</td></tr>`)
        .join('')
      return `<div class="src">
        <div class="src-head">
          <span class="src-name">${esc(d.name)}</span>
          ${d.ok ? '<span class="ok">检测成功</span>' : `<span class="bad">检测失败</span>`}
          ${d.durationMs != null ? `<span class="dur">${(d.durationMs / 1000).toFixed(1)}s</span>` : ''}
        </div>
        ${d.ok ? `<table class="kv"><tbody>${rows}</tbody></table>` : `<p class="err">${esc(d.error ?? '未知原因')}</p>`}
      </div>`
    })
    .join('\n')

  const matrix = model.matrix
    .map((m) => {
      const cells = m.perSource
        .map((p) => `<tr><td class="k">${esc(p.source)}</td><td>${esc(p.value)}</td></tr>`)
        .join('')
      return `<div class="mx"><div class="mx-field">${esc(m.field)}</div><table class="kv"><tbody>${cells}</tbody></table></div>`
    })
    .join('\n')

  const fields = model.fields
    .map((f) => `<tr><td class="k">${esc(f.label)}</td><td>${esc(f.value)}</td></tr>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>网鉴 · IP Insight 检测报告 · ${esc(model.currentIp ?? '')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif; color: #1f2328; margin: 0; background: #f7f8fa; font-size: 13.5px; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 44px 30px 60px; }
  h1 { font-size: 25px; margin: 0 0 6px; letter-spacing: -0.3px; }
  h2 { font-size: 16.5px; margin: 30px 0 12px; padding-bottom: 7px; border-bottom: 2px solid #1a73e8; display: inline-block; }
  h3 { font-size: 14.5px; margin: 16px 0 8px; }
  h4 { font-size: 13.5px; margin: 12px 0 6px; }
  .sub { color: #8a919b; font-size: 12.5px; margin-top: 2px; }
  .meta { color: #5f6368; font-size: 13px; line-height: 1.9; background: #fff; border: 1px solid #e4e7eb; border-radius: 12px; padding: 14px 18px; margin-top: 14px; }
  .meta b { color: #1f2328; }
  .ip { font-family: Consolas, monospace; font-size: 24px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #eceff3; vertical-align: top; }
  th { color: #8a919b; font-weight: 600; font-size: 12px; background: #fafbfc; }
  td.k { color: #8a919b; width: 170px; }
  table.kv td.k { width: 150px; }
  .mono { font-family: Consolas, monospace; }
  .ok { color: #188038; font-weight: 600; }
  .bad { color: #c5221f; font-weight: 600; }
  .dur { color: #8a919b; font-size: 12px; }
  .src { background: #fff; border: 1px solid #e4e7eb; border-radius: 12px; padding: 14px 18px; margin: 10px 0; }
  .src-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .src-name { font-weight: 700; font-size: 14px; }
  .err { color: #c5221f; }
  .mx { background: #fff; border: 1px solid #e4e7eb; border-radius: 10px; padding: 10px 14px; margin: 8px 0; }
  .mx-field { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
  .card { background: #fff; border: 1px solid #e4e7eb; border-radius: 12px; padding: 6px 16px; }
  pre.consistency { background: #fff; border: 1px solid #e4e7eb; border-radius: 10px; padding: 12px 16px; font-size: 12.5px; line-height: 1.8; white-space: pre-wrap; word-break: break-word; font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; }
  .ai { background: #fff; border: 1px solid #e4e7eb; border-radius: 12px; padding: 16px 20px; line-height: 1.9; }
  .ai p { margin: 7px 0; }
  .ai ul, .ai ol { margin: 6px 0; padding-left: 22px; }
  .ai code { background: #f2f4f7; border-radius: 4px; padding: 1px 5px; font-size: 12px; }
  .foot { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e4e7eb; color: #5f6368; font-size: 12.5px; line-height: 2; }
  .foot .sign { font-size: 13.5px; font-weight: 600; color: #1f2328; }
  @media print { body { background: #fff; } .wrap { padding: 10mm; } }
</style>
</head>
<body>
<div class="wrap">
  <h1>网鉴 · IP Insight 网络环境综合检测报告</h1>
  <div class="sub">Wang Jian · IP Insight Comprehensive Network Report</div>

  <div class="meta">
    公网 IP：<span class="ip">${esc(model.currentIp ?? '—')}</span><br />
    检测时间：<b>${fmtTime(model.startedAt)}</b> — <b>${fmtTime(model.finishedAt)}</b><br />
    报告生成：<b>${fmtTime(model.generatedAt)}</b>　数据源：<b>${model.successCount}/${model.totalCount} 成功</b>
  </div>

  <h2>一、数据源检测明细</h2>
  ${sourceCards}

  <h2>二、关键字段（多源聚合）</h2>
  <div class="card"><table class="kv"><tbody>${fields}</tbody></table></div>

  <h2>三、多源对比矩阵</h2>
  ${matrix || '<p class="sub">无多源可比字段。</p>'}

  <h2>四、多源一致性结论</h2>
  <pre class="consistency">${esc(model.consistency)}</pre>

  <h2>五、AI 综合分析</h2>
  <div class="ai">${model.ai ? mdToHtml(model.ai) : '<p class="sub">（本次报告未包含 AI 分析）</p>'}</div>

  <div class="foot">
    <div class="sign">${SIGNATURE}</div>
    项目仓库：${REPO}<br />
    本报告由检测时点各数据源公开页面与本机实测汇总生成；多源分歧项已如实标注，未做单一化裁剪。
  </div>
</div>
</body>
</html>`
}

export async function exportToFile(
  model: ReportModel,
  format: ExportFormat,
  targetPath: string
): Promise<void> {
  if (format === 'json') {
    fs.writeFileSync(targetPath, buildJson(model), 'utf8')
    return
  }
  if (format === 'txt') {
    fs.writeFileSync(targetPath, buildTxt(model), 'utf8')
    return
  }
  const html = buildHtml(model)
  if (format === 'html') {
    fs.writeFileSync(targetPath, html, 'utf8')
    return
  }
  // pdf：隐藏窗口加载同一份 HTML 后 printToPDF，所见即所得
  const tmp = join(app.getPath('temp'), `ipi-report-${Date.now()}.html`)
  fs.writeFileSync(tmp, html, 'utf8')
  const win = new BrowserWindow({ show: false, width: 1000, height: 800 })
  try {
    await win.loadFile(tmp)
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    })
    fs.writeFileSync(targetPath, pdf)
  } finally {
    win.destroy()
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  }
}

export function defaultReportName(format: ExportFormat): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  return `网鉴-IP-Insight-报告-${stamp}.${format}`
}
