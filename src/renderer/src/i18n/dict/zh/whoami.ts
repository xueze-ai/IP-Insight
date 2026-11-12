export const zhWhoami = {
  kicker: 'What the Web Sees · 不用你授权',
  title: '网站眼里的你',
  desc:
    '网站不需要你点任何「允许」，就能读到这些信息：出口 IP、TLS 形状、DNS 递归出口，以及屏幕、显卡、字体、Canvas 这些本机读数。这里把它们逐项摊开——包括那些你在本机测不到、但服务端一定看得到的项。',
  count: '{n} 个探测项 · 不用你授权',
  tabs: {
    overview: '概览',
    items: '全部探测项',
    disguise: '伪装检测',
    toolbox: '网络工具箱'
  },
  scanning: '正在读取…',
  rescan: '重新检测',
  copyText: '复制为文字',
  copyJson: '复制 JSON',
  copied: '已复制',
  privacy: '全部读数在本机完成，不发送给任何第三方，也不参与任何统计。',
  empty: '还没有结果，点「重新检测」。',
  overview: {
    summaryTitle: '一句话结论',
    gradeLabel: '暴露等级',
    grade: {
      A: 'A · 很难被单独认出',
      B: 'B · 有几处能缩小范围',
      C: 'C · 多处可以被关联',
      D: 'D · 能长期认出你'
    },
    gradeNote: '{bad} 处明确冲突 · {warn} 处值得注意',
    noConflict: '没有发现明确冲突，剩下的都是「本来就会暴露」的公开信息。',
    addrTitle: '地址与网络',
    envTitle: '设备与环境',
    stabilityTitle: '指纹稳定性',
    stabilityFirst: '这是本机第一次记录。下次打开这一页，就能看出哪些分项没变。',
    stabilityLine: '{total} 项中有 {unchanged} 项与上次完全一样。',
    stabilityChanged: '变了：{list}',
    stabilityStable: '全都没变：网站不用 Cookie 也能认出你。',
    idLabel: '指纹 ID',
    baselineReset: '清除历史基线',
    rtbTitle: '广告交易平台会收到什么',
    rtbDesc:
      '用本页读数拼出的竞价请求（字段名按 OpenRTB 常用命名）。真实请求还会带平台自己的 ID 和页面广告位；兴趣标签来自画像，不是这些读数。',
    rtbNote: '这里的内容不会发往任何地方。'
  },
  items: {
    search: '搜索探测项或读到的值',
    noResult: '没有匹配的项。',
    colItem: '探测项',
    colValue: '读到的值',
    colSource: '读取方式',
    all: '全部',
    unavailable: '本次读不到',
    error: '读取出错',
    why: '网站拿这条能做什么',
    levelHigh: '强识别',
    levelMid: '可缩小范围',
    levelLow: '公开信息',
    partial: '部分可用',
    serverOnly: '仅服务端可观测'
  },
  disguise: {
    title: '伪装检测',
    desc: '把「你自报的」和「实际读到的」放在一起比。只报有证据的冲突；证据不足的项会明确写成「本页不判定」。',
    count: '{n} 处可能暴露你',
    clean: '没有发现冲突项。',
    advice: '怎么改',
    ok: '一致',
    info: '说明',
    warn: '值得注意',
    bad: '冲突'
  },
  region: {
    title: '想装成在别处？',
    desc: '选一个目标地区，逐项告诉你「还差什么」。只比较已读到的值；IP、时区、语言、DNS 出口这几项必须一起对上。',
    allOk: '已读到的 {n} 项全部对得上。',
    summary: '{n} 项里有 {total} 项对得上，还差 {missing} 项。'
  },
  tools: {
    note: '下面几项都是真实测量：路由追踪调用系统 tracert，网络诊断做真实 TCP / DNS / HTTP 探测，CDN 雷达直接请求各 CDN 的公开性能端点。',
    traceroute: {
      title: '路由追踪',
      desc: '逐跳看到数据包经过哪些路由器。不做反向解析（-d），每跳三次探测。',
      target: '目标域名或 IP',
      placeholder: '例如 1.1.1.1',
      run: '开始追踪',
      running: '追踪中…',
      colHop: '跳',
      colRtt: '往返时延',
      colAddr: '地址',
      timeout: '超时',
      noData: '还没有结果。',
      empty: '没有解析出任何跳。'
    },
    diagnose: {
      title: '网络诊断',
      desc: '本机地址、DNS 服务器与解析、TCP 443 连通、HTTP 延迟、网卡 MTU。',
      run: '运行诊断',
      running: '诊断中…',
      noData: '还没有结果。',
      check: {
        'local-ip': '本机地址',
        'dns-servers': 'DNS 服务器',
        'dns-resolve': '域名解析',
        'tcp-cloudflare': 'Cloudflare 443',
        'tcp-github': 'GitHub 443',
        'tcp-baidu': '百度 443',
        'http-latency': 'HTTP 延迟',
        mtu: '网卡 MTU'
      }
    },
    radar: {
      title: 'CDN 雷达',
      desc: '同时请求 10 个 CDN 的公开性能端点，读回节点标识、缓存命中与耗时。',
      run: '开始探测',
      running: '探测中…',
      noData: '还没有结果。',
      colCdn: 'CDN',
      colNode: '节点',
      colCache: '缓存信号',
      colMs: '耗时'
    },
    shortcuts: {
      title: '其它工具',
      desc: '已经做好的能力，直接跳过去用。',
      speedtest: '网速测试',
      speedtestDesc: 'Cloudflare 真实上下行 / 延迟 / 抖动',
      ipQuality: 'IP 质量',
      ipQualityDesc: '风险评分与原生 / 广播 / 代理判定',
      exitDiag: '网络透视',
      exitDiagDesc: '出口、分流、CDN 节点、DNS 出口四模块',
      fingerprint: '浏览器指纹',
      fingerprintDesc: '多源指纹对比与明细'
    }
  }
}
