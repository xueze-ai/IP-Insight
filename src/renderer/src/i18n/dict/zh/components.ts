export const zhComponents = {
  multiSource: {
    dims: {
      residential: '住宅 IP',
      datacenter: '数据中心',
      vpn: 'VPN',
      proxy: '代理 Proxy',
      tor: 'Tor'
    },
    exitChatGpt: 'ChatGPT 出口',
    exitOther: '其他出口',
    exitTitle: '{label} · 独立画像',
    sourcesCovered: '{n} 源覆盖',
    typeResidential: '住宅',
    typeDatacenter: '数据中心',
    typeUnknown: '类型未判定',
    riskScore: '评分 {score}',
    noRiskScore: '无风险评分',
    noLocation: '无位置信息',
    exitNoteMain: '该出口 IP 与主出口不同，其类型判定不与主出口直接比较；',
    exitNoteSingle: '仅 1 个数据源覆盖，无法多源交叉验证。',
    exitNoteMulti: '已在覆盖该出口的源之间进行比较。',
    viewSource: '查看原网站',
    openSourceManual: '手动打开原网站',
    badgeOk: '检测成功',
    badgeBad: '不可用',
    duration: '耗时 {sec}s',
    completeness: '数据完整度 {pct}%',
    rawShow: '原始结果',
    rawHide: '收起原始结果',
    sourceUnavailable: '该数据源暂时不可用（超时 / 访问受限 / 需人工验证）。',
    consistencyTitle: '多源一致性 · 主出口',
    mainExitCovered: '{n} 源覆盖主出口',
    consistencySummary: '{total} 个可判断维度中，{agrees} 个在覆盖源之间结论一致。',
    hasConflict: '存在分歧的项目当前无法确认，已如实标注。',
    noConflict: '可判断维度未发现分歧。',
    dimAgree: '一致',
    dimConflict: '存在分歧',
    dimNoData: '无数据',
    resultsTitle: '多源检测结果'
  },
  exportDialog: {
    title: '导出检测报告',
    formats: {
      html: '自包含网页，浏览器打开，含可折叠原始结果',
      pdf: 'A4 排版文档，与 HTML 版式一致，适合存档分享',
      json: '完整结构化数据，含各源原始结果，适合二次处理',
      txt: '纯文本报告，适合快速阅读与粘贴'
    },
    reportIncludes:
      '报告包含：检测时间（{start} — {end}）、公网 IP（{ip}）、{total} 个数据源状态、关键字段多源聚合、多源对比、各源原始结果{aiPart}。',
    withAi: '、AI 综合分析',
    withoutAi: '（本次未包含 AI 分析）',
    exportFailed: '导出失败',
    locate: '定位',
    exporting: '导出中……',
    exportAgain: '再次导出',
    save: '保存'
  }
}
