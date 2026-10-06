export const zhFingerprint = {
  startDetection: '开始综合检测',
  leakNotChecked: '未检测',
  openIppure: '打开 IPPure 指纹页',
  viewGptSource: '查看 GPT 源原网站',
  empty: {
    intro: '指纹数据由 Net.Coffee GPT 源在隐藏浏览器内计算。',
    failed: '本次检测该源失败：{reason}',
    hint: '先完成一次综合检测即可查看。'
  },
  tz: {
    consistent: '与 ChatGPT 出口时区一致',
    inconsistent: '与 ChatGPT 出口时区不一致',
    unknown: '无法判断'
  },
  kicker: 'Browser Fingerprint · 隐藏浏览器实测',
  desc: '以下为检测所用内置隐藏浏览器（Chromium）的环境指纹，由 Net.Coffee GPT 源在页面内固定绘制计算、稳定可复现；用于评估检测出口的指纹暴露面，与你日常使用的浏览器可能不同。未采集项显示「—」。',
  group: {
    browser: 'Browser · 浏览器',
    device: 'Device · 设备',
    graphics: 'Graphics · 图形与音频',
    privacy: 'Privacy · 隐私一致性'
  },
  row: {
    browser: '浏览器',
    os: '操作系统',
    language: '语言',
    cookie: 'Cookie',
    screen: '屏幕分辨率',
    colorDepth: '色彩深度',
    cpuThreads: 'CPU 线程数',
    deviceMemory: '设备内存',
    deviceMemoryVal: '{gb} GB（浏览器上报上限值）',
    gpuRenderer: 'GPU 渲染器',
    webgl: 'WebGL 指纹',
    canvas: 'Canvas 指纹',
    audio: '音频指纹',
    timezone: '时区',
    tzConsistency: '时区一致性',
    dnsLeak: 'DNS 泄露',
    webrtcLeak: 'WebRTC 泄露'
  },
  cookie: {
    enabled: '已启用',
    disabled: '已禁用'
  },
  full: {
    title: 'Fingerprint · 综合指纹',
    fontCount: '检出 {n} 个字体',
    prefLanguage: '偏好语言',
    rerun: '重新综合检测以获取新版指纹字段',
    desc: '综合指纹 ID 由本机对 Canvas / WebGL / 音频 / 屏幕 / 时区 / 语言 / 线程数哈希计算，仅用于自我前后对比（例如更换代理或浏览器内核后是否变化）；非跨站跟踪 ID，不上传任何服务器。',
    legacyNote: '（本次检测为旧版 Adapter 结果，无该项）'
  },
  detail: {
    expand: '查看详细指纹',
    collapse: '收起详细指纹',
    prefLanguageList: '偏好语言列表',
    fontListTitle: '检出字体（宽度差异法，浏览器端计算）',
    noFonts: '未检出候选字体',
    fontsNotCollected: '本次检测未采集字体项',
    rawJson: '原始指纹 JSON'
  }
}
