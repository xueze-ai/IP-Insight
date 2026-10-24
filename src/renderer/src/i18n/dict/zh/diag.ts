export const zhDiag = {
  title: '网络出口诊断',
  intro:
    '查看本机访问不同目标时实际使用的出口：本机公网 IP、网站分流、CDN 命中节点、DNS 查询出口。关键结果直接显示，技术细节与原始证据可展开查看。',
  stop: '停止',
  runAll: '开始全部检测',
  rerunAll: '重新全部检测',
  runningHint: '检测进行中（批次 {id}）；单项失败不影响其他项，可随时停止。',
  runEnd: {
    canceled: '本轮已停止（{time}）；已完成项的结果保留，可立即重新检测。',
    timeout: '本轮整体超时（{time}）；已完成项的结果保留，可立即重新检测。'
  },
  runMeta: '批次 {runId} · 开始 {start}',
  progress: '{done}/{total} 项完成',
  elapsed: '已用时 {s} 秒',
  moduleStats: '{ok}/{total} 项成功',
  runModule: '检测本模块',
  rerunModule: '重测本模块',
  privacyNote: '诊断由本机直接发起并本地保存；观测点仅看到请求出口与诊断目标本身，证据已限制大小并脱敏。',
  empty: '还没有诊断数据。点击「开始全部检测」，或在各模块单独运行。',
  verifiedAt: '目标清单核验日期：{date}',
  historyBanner:
    '正在查看历史快照（{time} · 批次 {runId}），与当前网络无关。开始新检测将切换回实时视图。',
  overview: {
    title: '本轮概况',
    httpExits: '测得 {n} 个 HTTP 出口',
    splitGotIp: '{n} 个网站取得出口 IP',
    splitReachOnly: '{n} 个仅确认可达',
    failed: '{n} 个失败',
    dnsExits: '{n} 个 DNS 递归出口（单独统计）',
    multiExitNote: '多个出口可能来自正常的分流配置，本身不代表异常；出口数量统计已按唯一 IP 去重。',
    nothingYet: '尚未取得结果'
  },
  module: {
    publicIp: '本机公网 IP',
    splitTunnel: '网站分流测试',
    cdnNode: 'CDN 命中节点',
    dnsExit: 'DNS 出口查询'
  },
  tabDesc: {
    publicIp: '外部服务观察到的你的公网出口（不是局域网地址）；IPv4 / IPv6 独立成行。',
    splitTunnel: '访问不同网站时各自看到的出口 IP；出口不同可能来自正常分流。',
    cdnNode: '这次请求由哪个 CDN 节点提供服务；节点位置不代表你的所在地。',
    dnsExit: '递归解析器向权威 DNS 查询时暴露的出口；它通常不等于你的公网 IP。'
  },
  status: {
    queued: '排队',
    running: '检测中',
    success: '成功',
    partial: '部分成功',
    failed: '失败',
    timeout: '超时',
    canceled: '已取消',
    skipped: '已跳过',
    unsupported: '不支持',
    pending: '未开始'
  },
  statusLong: {
    gotExit: '取得出口',
    reachOnly: '可访问，未提供出口 IP',
    gotNode: '取得节点',
    dnsAnswered: '已应答，未取得递归出口',
    dnsOnlyEcs: '仅取得 ECS / TXT'
  },
  via: {
    'main-http': '主进程 HTTP（跟随系统代理）',
    'node-direct': 'Node 直连（不经应用层代理）',
    'dns-udp': '本机 UDP DNS',
    'browser-page': '隐藏浏览器页面'
  },
  mech: {
    'http-proxy': '跟随系统代理的 HTTP 请求',
    'node-direct': 'Node https 直连（不经应用层代理）',
    'dns-udp': 'UDP 53 直连解析器',
    'page': '页面流程提取'
  },
  mechNote: {
    'http-proxy': '与浏览器一致走系统代理；仅配置在浏览器插件内的代理不在此路径中。',
    'node-direct':
      'Node HTTPS 未使用应用层代理，但不代表绕过所有系统路由或 TUN；本机制只说明它自己走了哪条路，不据此推断其他路径。',
    'dns-udp': '按服务器地址自动选择 udp4 / udp6。',
    'page': '复用页面自身的检测流程，读取页面展示结果。'
  },
  family: {
    ipv4: 'IPv4',
    ipv6: 'IPv6',
    unknown: '未知'
  },
  category: {
    all: '全部类别',
    cn: '国内',
    intl: '国际',
    ai: 'AI 服务',
    dev: '开发者'
  },
  col: {
    site: '网站 / 域名',
    category: '类别',
    exit: '实际出口 IP',
    geo: '国家/地区 · 运营商',
    status: '状态',
    actions: '操作',
    vantage: '观测点',
    family: '地址族',
    geoFull: '国家与网络归属',
    mech: '请求机制',
    cdn: 'CDN',
    host: '测试域名',
    node: '原始节点标识',
    cache: '缓存信号',
    ms: '请求耗时',
    resolver: '解析器',
    server: '服务器地址',
    recExit: '递归出口',
    ecs: 'ECS 网段'
  },
  geo: {
    notFetched: '未获取',
    source: '归属来源：{source} · {time}',
    inline: '目标自身提供'
  },
  action: {
    copyIp: '复制 IP',
    copyTable: '复制表格',
    copied: '已复制',
    retryItem: '重试',
    retryFailed: '重试失败项',
    detail: '详情'
  },
  search: '搜索网站名称或域名…',
  filter: {
    failOnly: '仅看失败 / 未取得 IP',
    groupByExit: '按出口分组',
    exitGroup: '出口 {label}（{n} 个目标）',
    exitLabelA: 'A',
    exitLabelB: 'B',
    exitLabelC: 'C',
    exitLabelD: 'D',
    exitLabelE: 'E',
    reachOnlyGroup: '未取得出口（{n} 个目标）'
  },
  reachOnlyText: '可访问，未提供出口 IP。',
  noNode: '未提供节点信息',
  noCache: '未提供缓存信号',
  cacheOrderNote: '缓存信号按响应中出现顺序保留（多段不合并）。',
  cdnNote: '节点为来源原文（未裁剪）；CDN 节点位置不能当成出口 IP 所在城市；HTTP 请求耗时不是 ICMP Ping。',
  dns: {
    groupSystem: '系统配置解析器',
    groupPublic: '指定公共 DNS（UDP 直连）',
    publicNote:
      '指定公共 DNS 的结果是「向该服务器查询时」的递归出口，不能冒充浏览器当前实际 DNS。本测试不能完整代表浏览器安全 DNS（DoH）、应用自带 DoH、代理远端解析和系统分域规则。',
    dnsLeakNote: 'DNS 出口与 HTTP 出口不同是常见现象，不能单凭这一点判定「DNS 泄露」。',
    exitSource: '出口语义：{v}',
    exitSourceNs: 'ns 段（Akamai 官方语义：递归解析器出口）',
    exitSourceTxt: 'TXT 裸 IP 记录（Google 官方语义：递归解析器出口）',
    noExit: '未取得',
    ecsRepLabel: 'ECS 代表地址（不是解析器出口）',
    recordsLabel: '应答 TXT 记录（共 {n} 条）'
  },
  detail: {
    url: '实际请求',
    method: '测量方式',
    mech: '请求机制',
    family: '地址族',
    http: 'HTTP 状态',
    ms: '耗时',
    time: '测量时间',
    source: '数据来源',
    sourceUrl: '来源说明',
    records: 'TXT 记录',
    attempts: '尝试历史',
    firstAt: '首次：{time}',
    retriedAt: '第 {n} 次：{time} · {status}',
    evidence: '原始证据（已截断 / 脱敏）',
    historyNoEvidence: '历史快照不含原始证据。'
  },
  save: {
    toHistory: '保存到历史',
    saved: '已保存',
    kindBadge: '出口诊断快照',
    savedHint: '已保存为独立历史记录，可在历史页查看、导出或交给 AI。'
  },
  compare: {
    title: '快照对比',
    desc: '对比两次诊断：按相同目标、地址族与请求机制比较出口、节点与状态。',
    pick: '选择对比快照',
    run: '对比',
    a: '当前',
    b: '历史 {time}',
    changed: '出口变化',
    same: '一致',
    missing: '缺失（不当作变化）',
    noPairs: '两次快照没有可比较的相同目标。'
  }
}
