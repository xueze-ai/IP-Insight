export const zhDashboard = {
  start: '开始综合检测',
  rerun: '重新检测',
  viewFull: '查看完整检测结果',
  exportReport: '导出报告',
  collapseFull: '收起完整结果',
  step: {
    waiting: '等待',
    running: '检测中',
    done: '已完成 · {sec}s',
    failed: '失败 / 超时'
  },
  hero: {
    kicker: 'IP Insight · 网络环境综合检测',
    title: '网络环境，一次看清。',
    desc: '自动访问多个检测网站，聚合真实 IP 画像、风险与泄露数据，经交叉验证与 AI 分析，生成一份可信的网络环境报告。',
    currentEnv: '当前网络环境',
    currentEnvHint: '点击「{action}」以识别当前公网 IP'
  },
  running: '正在综合检测',
  runningDesc: '软件正在后台依次访问检测网站，请稍候……',
  currentIp: '当前公网 IP',
  doneKicker: '检测完成 · {ok}/4 数据源成功',
  alert: {
    conflict: '多源对部分属性判断不一致，相关项目当前无法确认；',
    leak: '检测到 DNS / WebRTC 出口与 ChatGPT 出口不一致，存在真实位置泄露。',
    tail: '以下为各项目的多源口径，确定结论请查看完整结果与 AI 分析。'
  },
  row: {
    vpn: 'VPN',
    proxy: '代理 Proxy',
    tor: 'Tor',
    native: '原生性',
    dnsLeak: 'DNS 泄露',
    webrtcLeak: 'WebRTC 泄露'
  },
  chatgptExit: ' · ChatGPT 出口 {ip}（{country}）'
}
