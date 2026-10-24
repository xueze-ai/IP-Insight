export const zhDiag = {
  title: '网络出口诊断',
  intro:
    '从多个独立观测点观察「本机发起请求时实际使用的出口」：本机公网 IP、网站分流、CDN 命中节点、DNS 查询出口。不同目标看到不同出口可能来自正常的分流配置，不自动代表异常。',
  stop: '停止诊断',
  runAll: '一键出口诊断',
  rerunAll: '重新诊断全部',
  runningHint: '诊断进行中（批次 {id}）；单项失败不影响其他项，可随时停止。',
  runEnd: {
    canceled: '本轮诊断已取消（{time}）；已完成的探测项结果保留。',
    timeout: '本轮诊断整体超时（{time}）；已完成的探测项结果保留。'
  },
  runMeta: '批次 {runId} · 开始 {start} · {stats}',
  moduleStats: '{ok}/{total} 项成功',
  privacyNote: '诊断由本机直接发起并本地保存；观测点仅看到请求出口与诊断目标本身，证据已限制大小并脱敏。',
  empty: '本轮未包含该模块的探测项。',
  module: {
    publicIp: '本机公网 IP',
    splitTunnel: '网站分流测试',
    cdnNode: 'CDN 命中节点',
    dnsExit: 'DNS 出口查询'
  },
  note: {
    publicIp:
      '这里显示外部服务观察到的你的公网出口（不是局域网网卡地址）。不同观测点可能看到不同出口（例如分流或 IPv4/IPv6 差异），全部保留显示。IPv6 未取得时显示「未测得」，不会用 IPv4 或默认地址代替。',
    splitTunnel:
      '这里帮助你查看不同目标看到的出口地址。出口不同可能来自正常的分流配置。仅能测试各目标官方提供的诊断端点；结果只代表该诊断端点的出口，不能宣称整个网站的全部资源都使用相同出口。不回显出口的目标只记录可达性。',
    cdnNode:
      '这里显示这次请求由哪个 CDN 节点提供服务。节点位置并不直接代表你的所在地，也不等同于 DNS 解析结果、缓存命中状态或你的公网出口。节点代码保留来源原文，不推断城市；没有缓存证据时不显示 HIT/MISS；耗时为 HTTP 请求耗时，不是 ICMP Ping。',
    dnsExit:
      '这里显示为本次测试完成解析的 DNS 查询出口（递归解析器向权威 DNS 发起查询时暴露的地址），它通常不等于你的公网 IP。DNS 出口与 HTTP 出口不同是常见现象，不能单独据此判断「DNS 泄露」。本测试覆盖被查询的解析器，不代表所有应用与所有域名的解析路径。'
  },
  status: {
    success: '成功',
    partial: '部分成功',
    failed: '失败',
    timeout: '超时',
    canceled: '已取消',
    skipped: '已跳过',
    unsupported: '不支持',
    running: '进行中',
    pending: '未开始'
  },
  via: {
    'main-http': '主进程网络栈（遵循系统代理）',
    'browser-page': '隐藏浏览器页面上下文',
    'dns-udp': '本机 UDP 53 直连解析器'
  },
  family: {
    ipv4: 'IPv4',
    ipv6: 'IPv6',
    unknown: '地址族未知'
  },
  keyResult: {
    reachableOnly: '可达（无出口回显）'
  },
  summary: {
    publicIp: {
      multi: '多个观测点出口不同：{ips}',
      one: '公网出口：{ips}',
      none: '未取得出口观测结果'
    },
    splitTunnel: {
      exits: '观察到 {n} 个不同出口（{ips}…）',
      none: '未取得任何目标的出口回显'
    },
    cdnNode: {
      hit: '{n} 个 CDN 返回了命中节点（如 {first}）',
      none: '未取得节点信息'
    },
    dnsExit: {
      exits: '观察到 {n} 个递归出口（{ips}…）',
      none: '未观察到递归出口'
    },
    partial: '{n} 个探测项失败或超时'
  },
  field: {
    method: '测量方式',
    time: '时间与耗时',
    httpStatus: 'HTTP 状态',
    family: '地址族',
    node: '节点代码（来源原文）',
    cdn: 'CDN',
    sourceUrl: '来源说明',
    error: '失败原因'
  },
  evidence: {
    toggle: '展开原始证据（已截断 / 脱敏）'
  }
}
