import { getSettings } from './settings'

// =============================================================
// 主进程 i18n：面向用户的报错提示与导出报告模板文案。
// 语言跟随 设置 → 外观 → 界面语言；测试钩子内的中文不翻译。
// =============================================================

const zh = {
  unknownProvider: '未知的提供商',
  needApiKey: '未填写 API Key',
  needBaseUrl: '未填写 Base URL',
  aiNoProvider: '未选择有效的 AI 提供商',
  aiNoKey: '当前 AI 提供商未配置 API Key，请到「设置 → AI 提供商」填写。',
  aiNoData: '暂无检测数据可供分析',
  askEmpty: '请先输入问题',
  historyNotFound: '记录不存在',
  exportTitle: '导出检测报告',
  exportHtml: 'HTML 网页',
  exportPdf: 'PDF 文档',
  exportJson: 'JSON 数据',
  exportTxt: 'TXT 文本',
  updateDevMode: '当前为开发模式，自动更新仅在打包版本中可用',
  updateNoRelease: 'GitHub Releases 上暂无可用的更新信息（可能尚未发布正式版本），稍后再试',
  updateNetworkError: '检查更新时网络连接失败，请检查网络后重试',
  updateCheckFailed: '检查更新失败，请稍后重试',
  // ---- 导出报告 ----
  reportSignature: '网鉴（IP Insight）· 版权所有 © 2026 薛泽（Xue Ze）',
  reportTitle: '网鉴 · IP Insight 网络环境综合检测报告',
  reportSub: 'Wang Jian · IP Insight Comprehensive Network Report',
  reportIp: '公网 IP：',
  reportTime: '检测时间：',
  reportGenerated: '报告生成：',
  reportSources: '数据源：',
  reportSuccess: '成功',
  reportSec1: '一、数据源检测明细',
  reportSec2: '二、关键字段（多源聚合）',
  reportSec3: '三、多源对比矩阵',
  reportSec4: '四、多源一致性结论',
  reportSecDiag: '五、网络出口诊断',
  reportSec5: '六、AI 综合分析',
  reportDiagRun: '批次 {runId} · {start} — {end} · 状态：{status}',
  reportDiagObserved: '观测到的出口',
  reportDiagNodes: '命中节点',
  reportDiagFailed: '失败/超时项',
  reportDiagStats: '探测项',
  reportDiagNoData: '（本报告未包含出口诊断）',
  reportDiagColModule: '模块',
  reportDiagColTarget: '目标',
  reportDiagColSource: '来源',
  reportDiagColStatus: '状态',
  reportDiagColIp: '出口 IP',
  reportDiagColNode: '节点',
  reportDiagColMs: '耗时',
  reportDiagColGeo: '出口归属',
  reportDiagColCache: '缓存信号',
  reportDiagColEcs: 'ECS 网段',
  reportDiagColErr: '失败原因',
  reportDetectOk: '检测成功',
  reportDetectFail: '检测失败',
  reportUnknownReason: '未知原因',
  reportNoMatrix: '无多源可比字段。',
  reportNoAi: '（本次报告未包含 AI 分析）',
  reportRepo: '项目仓库：',
  reportFoot:
    '本报告由检测时点各数据源公开页面与本机实测汇总生成；多源分歧项已如实标注，未做单一化裁剪。',
  reportFileName: '网鉴-IP-Insight-报告',
  reportHtmlLang: 'zh-CN'
}

const en: typeof zh = {
  unknownProvider: 'Unknown provider',
  needApiKey: 'API Key not configured',
  needBaseUrl: 'Base URL not configured',
  aiNoProvider: 'No valid AI provider selected',
  aiNoKey: 'The current AI provider has no API key. Fill it in under Settings → AI Providers.',
  aiNoData: 'No detection data to analyze',
  askEmpty: 'Please enter a question first',
  historyNotFound: 'Record not found',
  exportTitle: 'Export detection report',
  exportHtml: 'HTML page',
  exportPdf: 'PDF document',
  exportJson: 'JSON data',
  exportTxt: 'Plain text',
  updateDevMode: 'Dev mode: auto-update is only available in packaged builds',
  updateNoRelease: 'No update metadata found on GitHub Releases (no published release yet). Please try again later.',
  updateNetworkError: 'Network error while checking for updates. Please check your connection and retry.',
  updateCheckFailed: 'Update check failed. Please try again later.',
  // ---- report ----
  reportSignature: 'IP Insight · Copyright © 2026 Xue Ze',
  reportTitle: 'IP Insight Network Environment Report',
  reportSub: 'IP Insight Comprehensive Network Report',
  reportIp: 'Public IP: ',
  reportTime: 'Tested: ',
  reportGenerated: 'Generated: ',
  reportSources: 'Sources: ',
  reportSuccess: 'succeeded',
  reportSec1: '1. Per-source details',
  reportSec2: '2. Key fields (multi-source)',
  reportSec3: '3. Multi-source comparison',
  reportSec4: '4. Multi-source consistency',
  reportSecDiag: '5. Network exit diagnostics',
  reportSec5: '6. AI analysis',
  reportDiagRun: 'Run {runId} · {start} — {end} · Status: {status}',
  reportDiagObserved: 'Observed egress',
  reportDiagNodes: 'Edge nodes',
  reportDiagFailed: 'Failed / timed out probes',
  reportDiagStats: 'Probes',
  reportDiagNoData: '(This report contains no exit diagnostics)',
  reportDiagColModule: 'Module',
  reportDiagColTarget: 'Target',
  reportDiagColSource: 'Source',
  reportDiagColStatus: 'Status',
  reportDiagColIp: 'Egress IP',
  reportDiagColNode: 'Node',
  reportDiagColMs: 'Time',
  reportDiagColGeo: 'Egress geo',
  reportDiagColCache: 'Cache signals',
  reportDiagColEcs: 'ECS subnet',
  reportDiagColErr: 'Failure reason',
  reportDetectOk: 'Succeeded',
  reportDetectFail: 'Failed',
  reportUnknownReason: 'Unknown reason',
  reportNoMatrix: 'No comparable multi-source fields.',
  reportNoAi: '(This report contains no AI analysis)',
  reportRepo: 'Repository: ',
  reportFoot:
    'This report was compiled from public source pages and local measurements at detection time; multi-source disagreements are reported as-is without forced consensus.',
  reportFileName: 'IP-Insight-Report',
  reportHtmlLang: 'en'
}

export type MainTKey = keyof typeof zh

/** 按当前界面语言取主进程文案。 */
export function mt(key: MainTKey, params?: Record<string, string | number>): string {
  let lang: 'zh' | 'en' = 'zh'
  try {
    lang = getSettings().appearance.language === 'en' ? 'en' : 'zh'
  } catch {
    /* 设置未就绪时默认中文 */
  }
  let s: string = (lang === 'en' ? en : zh)[key]
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (_, k: string) =>
      params[k] !== undefined ? String(params[k]) : `{${k}}`
    )
  }
  return s
}
