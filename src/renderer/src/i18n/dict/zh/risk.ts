export const zhRisk = {
  kicker: 'Risk Analysis · 多源交叉',
  introBefore: '综合 {n} 个数据源对主出口',
  introAfter: '的风险判断。各源口径不同，均已归一为 0–100 风险值并保留原始标注。',
  empty: {
    title: '暂无风险数据',
    desc: '先完成一次综合检测，即可查看多源交叉后的风险分析。'
  },
  startDetection: '开始综合检测',
  nodata: '无数据',
  level: {
    title: '综合风险等级 · 主出口',
    score: '归一风险值 {v} / 100',
    scaleItem: '{name}：{raw}（{scale}）',
    scales: '{list}。',
    conflictNote:
      ' 各源风险等级存在分歧（口径与数值差异见上），综合等级取中位数，非确定结论。'
  },
  gpt: {
    badge: 'ChatGPT 分流出口',
    risk: '归一风险 {v}（{level}）',
    note: 'IP 与主出口不同，不直接比较'
  },
  tri: {
    sep: '、',
    itemSep: '；',
    hit: '命中',
    miss: '未命中',
    unknown: '无法判断',
    found: '{hit} 判定命中{label}。',
    foundMixed: '{hit} 判定命中{label}；{unknown} 未提供该字段。',
    clear: '全部 {n} 个覆盖源均判定无{label}。',
    clearMixed: '{clear} 判定无{label}；{unknown} 未提供该字段。',
    conflict: '多源判断不一致（{detail}），当前无法确认。',
    conflictItem: '{source}：{result}',
    unknownAll: '各源均提供该字段但均无法判断（{unknown}）。',
    nodata: '暂无数据源提供{label}判定。',
    label: {
      vpn: 'VPN',
      proxy: '代理',
      torExit: 'Tor 出口',
      crawler: '爬虫 / 蜘蛛特征',
      abuse: '滥用标记'
    }
  },
  ti: {
    title: 'Threat Intelligence · 威胁情报',
    blacklist: '黑名单 Blacklist',
    abuse: '滥用 Abuse',
    spam: '垃圾邮件 Spam',
    fraud: '欺诈 Fraud',
    threats: '威胁标签 Threats',
    blacklistHit: '{hit} / {total} 家命中',
    blacklistDescHit: '命中 {n} 家 DNSBL：{engines}；展开查看逐家类别与返回码。',
    blacklistDescClear: '12 家 DNSBL 均未命中（Net.Coffee 实测，单源）。',
    blacklistDescEmpty: '本次检测未取得黑名单数据。',
    abuseIntel:
      ' 另：Net.Coffee 情报库历史滥用等级 {level}{scorePart}，属历史评分口径，与当前实时标记不同。',
    abuseIntelScore: '（{raw}）',
    spamHit: '{n} 家 Spam 列表命中',
    spamClear: '未命中 Spam 列表',
    spamDescHit: '命中 Spam 类列表：{engines}（返回码 {codes}）。',
    spamDescClear: '未命中任何 Spam 类 DNSBL 列表。',
    fraudDesc:
      '当前四个数据源均未提供欺诈（Fraud）标签项；暂留空，后续接入提供该字段的数据源后自动显示。',
    threatsHit: '{n} 个威胁标签',
    threatsClear: '无威胁标签',
    threatsDescHit: 'Net.Coffee 情报库标记：{tags}（单源）。',
    threatsDescClear: 'Net.Coffee 情报库未标记任何威胁类型（单源，未交叉）。',
    threatsDescEmpty: '本次检测未取得情报库威胁标签。',
    table: {
      engine: '黑名单引擎',
      category: '类别',
      status: '状态',
      code: '返回码',
      ms: '耗时'
    }
  },
  proxy: {
    title: 'Proxy & Anonymity · 代理与匿名',
    vpn: 'VPN',
    proxy: '代理 Proxy',
    tor: 'Tor',
    crawler: '爬虫 Crawler'
  },
  nat: {
    title: 'Nativeness · 原生性与共享',
    native: '原生性',
    shared: '共享出口',
    human: '人机流量比',
    conflict: '多源不一致',
    nativeEmpty: '暂无数据源提供原生 / 广播判定。',
    nativeAgree: '覆盖源一致判定：{v}。',
    nativeConflict: '各源判定存在差异：{detail}。',
    sharedEmpty: '暂无数据源提供共享人数估计。',
    sharedDesc: 'Ping0 估计同一出口共享人数为 {v}（单源区间估计，非精确值）。',
    humanDesc: 'IPPure 统计该 IP 段人机流量比 {v}（单源统计口径）。',
    humanEmpty: '本次检测未取得人机流量比。'
  },
  item: {
    expand: '展开逐源 / 逐条明细',
    collapse: '收起'
  },
  viewNetcoffee: '查看 Net.Coffee 原始检测',
  viewPing0: '查看 Ping0 原始检测'
}
