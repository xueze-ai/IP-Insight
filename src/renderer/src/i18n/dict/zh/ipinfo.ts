export const zhIpinfo = {
  startDetection: '开始综合检测',
  differ: '各源表述有差异',
  conflict: '多源不一致',
  none: '无',
  kicker: 'IP Information · 公网 IP',
  coverage: '{n} 个数据源覆盖主出口',
  latest: ' · 最近检测 {date}',
  othersNote: '另有 {ips} 等其他出口（如 ChatGPT 出口），其画像见「综合检测 → 完整结果」中的独立出口卡片，不与主出口直接比较。',
  rangeFmt: '{first} – {last}（{count} 个，/{prefix}）',
  empty: {
    title: '暂无 IP 信息',
    desc: '先完成一次综合检测，即可查看聚合后的网络与位置信息。'
  },
  section: {
    network: 'Network · 网络',
    location: 'Location · 位置'
  },
  row: {
    isp: 'ISP 运营商',
    asn: 'ASN',
    org: 'Organization 组织',
    netType: 'Network Type 网络类型',
    country: 'Country 国家',
    region: 'Region 省/州',
    city: 'City 城市',
    timezone: 'Timezone 时区',
    lat: 'Latitude 纬度',
    lon: 'Longitude 经度'
  },
  netTypeVal: {
    residential: '住宅',
    datacenter: '数据中心',
    hosting: '托管'
  },
  ext: {
    title: '扩展网络信息 · Net.Coffee lookup（单源，未交叉）',
    viewSource: '查看原网站',
    rdns: 'rDNS 反向解析',
    rpki: 'RPKI 状态',
    regCountry: '注册国/地区',
    asnKind: 'ASN 类型',
    asnBandwidth: 'ASN 带宽',
    asnIpv4: 'ASN IPv4 规模',
    asnAllocated: 'ASN 分配时间',
    dcName: '数据中心名称'
  }
}
