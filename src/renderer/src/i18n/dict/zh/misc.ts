export const zhMisc = {
  tri: {
    found: '发现',
    clear: '未发现',
    conflict: '多源存在分歧',
    unknown: '无法判断',
    nodata: '无数据'
  },
  flagText: {
    hit: '命中',
    miss: '未命中',
    na: '未提供'
  },
  netType: {
    residential: '住宅',
    datacenter: '数据中心',
    hosting: '托管'
  },
  riskLevels: {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    critical: '严重'
  },
  riskScale: {
    trust: '信任分 · 越高越安全',
    ping0: '风控值 · 越高越危险',
    ippure: 'IPPure 系数 · 越高越危险'
  },
  consistency: {
    mainExit: '主出口：{ip}（{n} 个源覆盖）',
    unknown: '未知',
    otherExit: '其他出口：{ip}（{names}；与主出口 IP 不同，不直接比较）',
    flagLine: '{label}：{text}{detail}',
    conflictDetail: '（{items}）',
    sourceVerdict: '{source}：{verdict}',
    note: '注：Net.Coffee 与 IPPure 后端部分同源；Ping0 相对独立。'
  },
  report: {
    inconsistent: '多源不一致',
    flagLabels: {
      residential: '住宅',
      datacenter: '数据中心',
      hosting: '托管'
    },
    rows: {
      publicIp: '公网 IP',
      isp: 'ISP 运营商',
      org: '组织',
      location: '位置',
      coords: '坐标',
      timezone: '时区',
      netType: '网络类型',
      risk: '风险口径',
      native: '原生性',
      shared: '共享出口',
      flags: '属性标签',
      blacklist: 'DNSBL 黑名单',
      dnsLeak: 'DNS 泄露',
      webrtcLeak: 'WebRTC 泄露',
      ping: '全球节点延迟',
      speed: '本机测速',
      fingerprint: '浏览器指纹',
      scenarios: '场景评分'
    },
    blacklistValue: '{listed}/{checked} 家命中{names}',
    blacklistNames: '：{names}',
    leakValue: '{status}{exit}',
    leakExit: '（出口 {ip}）',
    speedValue: '下载 {down} Mbps / 上传 {up} Mbps',
    fpVisitor: '综合 {id}',
    matrix: {
      publicIp: '公网 IP',
      location: '位置',
      netType: '网络类型',
      risk: '风险口径'
    },
    summary: {
      isp: 'ISP 运营商',
      netType: '网络类型',
      country: '国家 / 地区',
      region: '省 / 州',
      city: '城市',
      timezone: '时区',
      coords: '经纬度',
      proxy: '代理 Proxy',
      crawler: '爬虫 Crawler',
      native: '原生性',
      dnsLeak: 'DNS 泄露',
      webrtcLeak: 'WebRTC 泄露',
      blacklist: 'DNSBL 黑名单',
      blacklistValue: '{listed} / {checked} 家命中'
    }
  },
  speedtest: {
    failed: '测速失败，未取得带宽数据'
  },
  ai: {
    alreadyRunning: '已有分析正在进行',
    failed: 'AI 分析失败'
  },
  shell: {
    brandAlt: '网鉴',
    brandSub: '网鉴 · IP 综合检测助手',
    groupDetect: '检测',
    collapseNav: '折叠导航',
    toggleTheme: '切换主题'
  },
  placeholderDesc: '该模块将在后续阶段完善；底层数据采集与各数据源 Adapter 已就绪并通过实测。'
}
