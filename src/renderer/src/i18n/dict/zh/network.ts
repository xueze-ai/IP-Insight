export const zhNetwork = {
  kicker: 'Network Quality · 本机实测 + 全球节点',
  intro:
    'Download / Upload / Ping / Jitter 由内置 Cloudflare 官方测速引擎在隐藏窗口测量；全球节点延迟由 Net.Coffee 提供；服务可用性聚合各服务官方状态页。',
  idleDesc:
    '测速将在后台隐藏窗口运行 Cloudflare 官方测量引擎，全程约 1–2 分钟（带宽越好耗时越长）。 测速期间可继续使用其他页面，结果会保留在本页。 丢包率依赖 WebRTC TURN 中继，若当前网络环境不可达将显示「未测得」。',
  startSpeedtest: '开始测速',
  phase: {
    preparing: '加载测速页 / 启动引擎',
    starting: '启动测量引擎',
    latency: '延迟（Ping / Jitter）',
    download: '下载',
    upload: '上传',
    finished: '完成',
    error: '错误'
  },
  running: {
    elapsed: '已用时 {s}s',
    desc: '测量引擎按阶段自动加压以逼近真实带宽，延迟在各轮负载间穿插采样。 后台隐藏窗口运行，不弹窗、不阻塞当前页面。'
  },
  error: {
    badge: '测速失败',
    hint: '可在网络恢复后重试。'
  },
  downloadLabel: 'Download 下载',
  uploadLabel: 'Upload 上传',
  kv: {
    ping: 'Ping 空载延迟',
    jitter: 'Jitter 空载抖动',
    loadedPingDown: '下载负载下 Ping / Jitter',
    loadedPingUp: '上传负载下 Ping / Jitter',
    loss: '丢包率',
    lossTitle: '依赖 WebRTC TURN 中继；当前网络环境不可达时不提供该项',
    exitIp: '测速出口 IP',
    exitIpDetail: '（{colo}{suffix}）',
    exitIpSep: ' · {loc}',
    duration: '总耗时',
    durationSec: '{n} s',
    time: '测量时间'
  },
  notMeasured: '未测得',
  lossNote: '丢包率依赖 WebRTC TURN 中继；当前网络环境不可达，暂不提供该项。',
  aim: {
    title: '体验评分 · Cloudflare AIM',
    streaming: '流媒体',
    gaming: '游戏',
    rtc: '实时通话',
    noScore: '{label}：—',
    note: '分类由 Cloudflare 官方引擎按本次实测的延迟 / 抖动 / 带宽实时计算，非固定值。'
  },
  retest: '重新测速',
  viewSource: '查看原网站',
  rawShow: '查看原始测量数据',
  rawHide: '收起原始测量数据',
  ping: {
    title: '全球节点延迟 · Net.Coffee',
    node: '节点',
    min: '最小',
    avg: '平均',
    max: '最大',
    asia: '亚洲',
    america: '美洲',
    europe: '欧洲',
    other: '其他',
    unreachable: '不可达',
    note: '来源：本次综合检测中 Net.Coffee 全球测速节点的结果（服务端缓存或实时测量，min/avg/max 与站点同口径）；「不可达」为该节点本次测量无响应。',
    empty:
      '全球节点延迟由 Net.Coffee 提供。请先在「综合检测」页完成一次检测，本页将按 亚洲 / 美洲 / 欧洲 分组显示 20 个节点的最小 / 平均 / 最大延迟。'
  },
  svc: {
    title: '服务可用性 · Net.Coffee 聚合',
    sourceSite: '原网站',
    feedError: '服务状态获取失败',
    sourceDown: '（该数据源暂时不可用）',
    failing: '{n} 个服务异常',
    allOk: '全部正常',
    meta: '共 {count} 个服务 · 站点聚合时间 {fetchedAt} · 本地获取 {fetchedLocalAt}',
    incidentsTitle: '异常服务当前事件',
    incidentLine: '· {name}：{incident}',
    incidentStatus: '（{status}）',
    unknown: '状态未知'
  },
  reach: {
    title: '本机可达性 · 真实 HTTP 探测',
    start: '开始探测',
    redetect: '重新探测',
    probeError: '可达性探测失败',
    ok: '可达 · {ms} ms',
    fail: '不可达',
    failMs: '不可达 · {ms} ms',
    probedAt: '探测时间：{time}',
    note: '探测在隐藏浏览器页内发起（与真实浏览器相同的网络栈与请求头，遵循系统代理）；收到任何响应记为可达，网络层失败（含重试 1 次后仍失败）或 8s 超时记为不可达并显示真实错误。若你的代理仅配置在浏览器插件内而非系统代理，本探测不经过该插件。结果只反映本次探测时刻。'
  }
}
