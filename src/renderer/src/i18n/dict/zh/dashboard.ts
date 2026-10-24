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
  currentIp: '当前公网出口 IP',
  doneKicker: '检测完成 · {ok}/{total} 数据源成功',
  alert: {
    conflict: '多个检测源对部分属性判断不一致，相关项目当前无法确认；',
    leak: '检测源报告 DNS / WebRTC 请求出口与主出口不一致（可能泄露真实网络位置）。',
    tail: '以下为各来源的判断口径；完整依据可在展开项与 AI 分析中查看。'
  },
  row: {
    vpn: 'VPN 标记',
    proxy: '代理标记（Proxy）',
    tor: 'Tor 出口标记',
    native: '原生性',
    dnsLeak: 'DNS 请求出口一致性',
    webrtcLeak: 'WebRTC 请求出口一致性'
  },
  chatgptExit: ' · ChatGPT 出口 {ip}（{country}）',
  diagBadge: '出口诊断',
  diagExits: '本机公网出口（多观测点）：{ips}',
  diagNone: '本轮未取得公网出口观测结果',
  diagFailed: '{n} 个观测点未成功',
  diagMore: '查看完整出口诊断 →',
  diagOnlyHint: '这是一次独立的出口诊断快照（未运行多源 IP 检测）；完整结果在「网络出口诊断」页面。',
  explain: {
    show: '这些字段是什么意思？',
    hide: '收起解释',
    isp: '网络服务商（ISP）：为你提供互联网接入的公司，如电信、联通或机房运营商。',
    asn: '网络归属编号（ASN）：一个网络在互联网中的独立编号，可用来识别该 IP 属于哪个运营商网络。',
    vpnProxy: 'VPN / 代理标记：各检测源对该地址属性的判断（是数据库里的记录，不是对你设备的检测）；「命中」表示至少一个来源如此标记，「未发现」表示有来源明确不这样认为。',
    native: '原生性：该 IP 是否由所属运营商自己广播（俗称「原生 IP」）；这是来源数据库的口径，不等同于好坏，也不代表适合某个业务。',
    leak: 'DNS / WebRTC 出口一致性：检测源观察到的「替你解析域名 / 建立 UDP 连接的出口」与主出口是否不同。不一致可能来自正常的分流配置，也可能暴露真实网络位置；仅以检测源报告为准。',
    diag: '出口诊断：从多个独立观测点（如 Cloudflare 诊断端点、权威 DNS 记录）观察你发起请求时实际使用的出口地址。不同目标看到不同出口是常见现象，不自动代表异常。'
  }
}
