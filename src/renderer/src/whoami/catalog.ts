// =============================================================
// 「网站眼里的你」探测目录
//
// 每一条都是网站不需要你授权就能读到（或服务端本来就能看到）的信息。
// · id 与采集器（collect.ts / 主进程 serverProbe.ts）一一对应。
// · level：high=强识别（可当准身份）；mid=能缩小人群；low=大家都在用的公开信息。
// · 目录只描述「读到什么、为什么值得注意」，不描述读取实现细节。
// 英文与中文同构，由页面按当前语言取用。
// =============================================================

export type ProbeGroup = 'server' | 'headers' | 'locale' | 'fingerprint' | 'device' | 'browser' | 'network'

export type ProbeLevel = 'low' | 'mid' | 'high'

export interface ProbeDef {
  id: string
  group: ProbeGroup
  zh: string
  en: string
  level: ProbeLevel
  /** 网站拿到这条能做什么（中文） */
  whyZh: string
  /** 网站拿到这条能做什么（英文） */
  whyEn: string
  /** 读取方式（技术口径） */
  source: string
}

export const PROBE_GROUPS: { id: ProbeGroup; zh: string; en: string }[] = [
  { id: 'server', zh: '服务器看到的', en: 'Server-side' },
  { id: 'headers', zh: '请求头', en: 'Request headers' },
  { id: 'locale', zh: '语言和地区', en: 'Language & region' },
  { id: 'fingerprint', zh: '指纹', en: 'Fingerprint' },
  { id: 'device', zh: '设备', en: 'Device' },
  { id: 'browser', zh: '浏览器设置', en: 'Browser settings' },
  { id: 'network', zh: '网络', en: 'Network' }
]

const p = (
  id: string,
  group: ProbeGroup,
  zh: string,
  en: string,
  level: ProbeLevel,
  whyZh: string,
  whyEn: string,
  source: string
): ProbeDef => ({ id, group, zh, en, level, whyZh, whyEn, source })

export const WHO_PROBES: ProbeDef[] = [
  // ---------------- 服务器看到的（本应用真实请求测得） ----------------
  p('server.ip', 'server', 'IP 地址', 'IP address', 'high', '连接的来源，一切地理与归属判断的起点。', 'Where the connection comes from; the basis for every geo lookup.', 'cdn-cgi/trace · ip'),
  p('server.family', 'server', '地址族', 'Address family', 'low', 'IPv4 与 IPv6 可能走不同出口，网站会分开对待。', 'IPv4 and IPv6 can exit differently; sites treat them separately.', 'trace · ip'),
  p('server.geo', 'server', '位置（按 IP 估）', 'Location (by IP)', 'high', 'IP 库给出的城市，不是 GPS；常与真实位置不符。', 'City from an IP database, not GPS; often wrong.', 'ip-api.com'),
  p('server.coords', 'server', '坐标（按 IP 估）', 'Coordinates (by IP)', 'mid', '只到城市级，但足以做地区定价、内容分区。', 'City-level only, yet enough for regional pricing.', 'ip-api.com · lat/lon'),
  p('server.asn', 'server', '网络（ASN）', 'Network (ASN)', 'mid', '运营商 / 机房决定网站把你归为家宽、企业还是数据中心。', 'Carrier or datacenter decides how you are classified.', 'ip-api.com · as / asname'),
  p('server.netType', 'server', 'IP 类型（机房 / 代理 / 移动）', 'IP type (hosting / proxy / mobile)', 'high', '机房或代理标记会直接触发风控与验证码。', 'Hosting or proxy flags trigger risk control and captchas.', 'ip-api.com · hosting/proxy/mobile'),
  p('server.reverseDns', 'server', '反向解析', 'Reverse DNS', 'mid', '反解名字常暴露线路用途（家宽、机房、云主机）。', 'The PTR name often reveals the line type.', 'ip-api.com · reverse'),
  p('server.ipTimezone', 'server', 'IP 所在时区', 'IP timezone', 'mid', '与浏览器时区一比，代理就藏不住。', 'Compared with your browser timezone, proxies stand out.', 'ip-api.com · timezone'),
  p('server.colo', 'server', '最近的数据中心', 'Nearest datacenter', 'low', '边缘节点代码（如 HKG），不是你的城市。', 'Edge code such as HKG, not your city.', 'trace · colo'),
  p('server.http', 'server', 'HTTP 版本', 'HTTP version', 'low', 'HTTP/3 走不通往往说明 UDP 被拦。', 'No HTTP/3 often means UDP is blocked.', 'trace · http'),
  p('server.tls', 'server', 'TLS 版本', 'TLS version', 'low', '新版本是常态；异常版本可能意味着中间有代理。', 'A modern version is normal; odd ones suggest interception.', 'trace · tls + TLSSocket'),
  p('server.kex', 'server', '密钥交换', 'Key exchange', 'mid', '原本会用后量子算法却退回 X25519，说明中间另建了连接。', 'Falling back to X25519 can mean a middlebox re-terminated TLS.', 'trace · kex'),
  p('server.cipher', 'server', '密码套件 / ALPN', 'Cipher / ALPN', 'low', '补充 TLS 细节，用于识别中间设备。', 'Extra TLS detail for spotting middleboxes.', 'Node https · getCipher'),
  p('server.sni', 'server', 'SNI 状态', 'SNI status', 'low', 'trace 只说明 SNI 是否发送，不代表 ECH 生效。', 'Trace only shows whether SNI was sent, not ECH.', 'trace · sni'),
  p('server.warp', 'server', 'Cloudflare WARP', 'Cloudflare WARP', 'low', '开着 WARP 会被直接识别为 Cloudflare 出口。', 'WARP traffic is identified as Cloudflare egress.', 'trace · warp / gateway'),
  p('server.ipv6', 'server', 'IPv6 出口', 'IPv6 egress', 'mid', 'IPv6 常常绕过只处理 IPv4 的代理。', 'IPv6 often bypasses IPv4-only proxies.', 'Node https family=6'),
  p('server.egress', 'server', '多出口 / 分流', 'Multiple egress', 'high', '不同站点看到不同 IP，分流规则与节点数量一目了然。', 'Different sites see different IPs, revealing split routing.', '4 个站点各自回显'),
  p('server.dnsServer', 'server', '系统 DNS 服务器', 'System DNS servers', 'mid', 'DNS 服务器地址本身就能说明你在哪个网络。', 'The resolver address alone locates your network.', 'dns.getServers()'),
  p('server.dnsResolver', 'server', 'DNS 递归出口', 'DNS resolver egress', 'high', '权威侧看到的解析器出口，和 HTTP 出口常常不是一回事。', 'The resolver egress seen by authoritative DNS.', 'Akamai whoami TXT · ns'),
  p('server.dnsResolverGeo', 'server', 'DNS 出口归属', 'DNS egress geo', 'high', 'DNS 出口与 IP 国家不一致，是代理环境最典型的痕迹。', 'A DNS egress in another country is the classic proxy trace.', 'ip-api.com（DNS 出口 IP）'),
  p('server.rtt', 'server', '到最近节点的往返延迟', 'RTT to nearest edge', 'mid', '物理距离无法伪装；绕路代理一定会多出这一段。', 'Distance cannot be faked; a detour adds latency.', '3 次 trace 请求取最小'),
  p('server.clockSkew', 'server', '时钟偏差', 'Clock skew', 'low', '系统时间与服务器时间差太多，会暴露虚拟机或异常环境。', 'Large clock drift hints at VMs or odd environments.', 'trace · ts vs Date.now()'),
  p('server.tor', 'server', 'Tor 出口节点', 'Tor exit node', 'high', '公开出口列表一比就能确认是否 Tor。', 'A public exit list confirms Tor immediately.', 'check.torproject.org 列表'),
  p('server.ja4', 'server', 'TLS 指纹（JA4）', 'TLS fingerprint (JA4)', 'high', 'TLS 握手的形状由客户端栈决定，换 UA 也改不掉。', 'The TLS handshake shape comes from the client stack, not the UA.', '仅服务端可观测'),
  p('server.h2fp', 'server', 'HTTP/2 指纹', 'HTTP/2 fingerprint', 'high', '伪头顺序与 SETTINGS 组合能区分浏览器内核与代理工具。', 'Pseudo-header order and SETTINGS distinguish stacks.', '仅服务端可观测'),
  p('server.tcpfp', 'server', 'TCP/IP 指纹', 'TCP/IP fingerprint', 'high', '初始 TTL、窗口大小由操作系统发出，浏览器改不了。', 'Initial TTL and window size come from the OS, not the browser.', '仅服务端可观测'),
  p('server.quicfp', 'server', 'QUIC / HTTP3 指纹', 'QUIC fingerprint', 'mid', '走 HTTP/3 时另有一套可识别的传输特征。', 'HTTP/3 exposes a separate transport signature.', '仅服务端可观测'),
  p('server.uaEcho', 'server', '服务端看到的 UA', 'UA as seen by server', 'mid', '服务端读到的 UA 才是它真正用于判断的字符串。', 'The UA the server reads is the one it judges you by.', '仅服务端可观测'),

  // ---------------- 请求头 ----------------
  p('headers.ua', 'headers', 'User-Agent', 'User-Agent', 'high', 'UA 声明系统与浏览器；与本机真实栈不一致就是破绽。', 'UA claims an OS and browser; mismatches are the giveaway.', 'navigator.userAgent'),
  p('headers.acceptLanguage', 'headers', '语言（Accept-Language）', 'Accept-Language', 'mid', '语言列表会随请求发出，网站据此猜地区与母语。', 'Sent with every request; sites infer region and mother tongue.', 'navigator.languages'),
  p('headers.secChUa', 'headers', '浏览器品牌（Client Hints）', 'Browser brands (Client Hints)', 'mid', '新版浏览器主动上报品牌列表，与 UA 互为校验。', 'Modern browsers report brands, cross-checked against UA.', 'navigator.userAgentData.brands'),
  p('headers.secChUaPlatform', 'headers', '平台（Client Hints）', 'Platform hint', 'mid', '平台提示与 UA 里的系统应一致。', 'Should agree with the OS in the UA.', 'navigator.userAgentData.platform'),
  p('headers.clientHints', 'headers', 'Client Hints 明细', 'Client Hints detail', 'mid', '架构、位数、型号、平台版本会被按需索取。', 'Architecture, bitness, model and platform version on demand.', 'userAgentData.getHighEntropyValues'),
  p('headers.acceptEncoding', 'headers', '压缩方式', 'Accept-Encoding', 'low', '通常由浏览器自动发送，脚本读不到。', 'Usually sent automatically; not readable from script.', '服务端可观测'),
  p('headers.dnt', 'headers', '请勿追踪（DNT / GPC）', 'DNT / GPC', 'low', '开启后反而更少见，本身就是一个特征位。', 'Rare when enabled, so it becomes a distinguishing bit.', 'navigator.doNotTrack'),
  p('headers.referer', 'headers', '来源页面', 'Referer', 'low', '从哪跳转过来，会暴露你上一个访问的站点。', 'Where you came from reveals your previous page.', 'document.referrer'),

  // ---------------- 语言和地区 ----------------
  p('locale.browserLanguage', 'locale', '浏览器语言', 'Browser language', 'mid', '首选语言与 IP 国家不一致是最常见的破绽之一。', 'A first language that contradicts the IP country is a common tell.', 'navigator.language'),
  p('locale.languages', 'locale', '语言列表', 'Language list', 'mid', '排序与取舍反映真实使用习惯。', 'Order and omissions reflect real habits.', 'navigator.languages'),
  p('locale.intlLocale', 'locale', '区域设置', 'Locale', 'mid', 'ICU 区域决定数字、日期、货币的呈现方式。', 'The ICU locale drives numbers, dates and currency.', 'Intl.DateTimeFormat'),
  p('locale.timezone', 'locale', '系统时区', 'System timezone', 'high', '时区由系统给出，改浏览器语言也改不掉。', 'Comes from the OS; changing the browser language does not hide it.', 'Intl resolvedOptions'),
  p('locale.timezoneOffset', 'locale', '时区偏移', 'Timezone offset', 'mid', '偏移量与时区名一起校验，夏令时也会暴露。', 'Offset plus name; daylight saving gives extra signal.', 'getTimezoneOffset'),
  p('locale.hourCycle', 'locale', '时钟格式', 'Hour cycle', 'low', '12/24 小时制随地区，能细化人群。', '12h vs 24h narrows the population.', 'Intl hourCycle'),
  p('locale.weekStart', 'locale', '一周从哪天开始', 'First day of week', 'low', '地区习惯，单人不足以定位，但能参与合成。', 'Regional habit; weak alone, useful in combination.', 'Intl.Locale weekInfo'),
  p('locale.numberFormat', 'locale', '数字格式', 'Number format', 'low', '千位分隔与小数的写法跟地区走。', 'Grouping and decimal style follow the region.', 'Intl.NumberFormat'),
  p('locale.dateFormat', 'locale', '日期格式', 'Date format', 'low', '年月日顺序是一种稳定的地区信号。', 'Date ordering is a stable regional signal.', 'Intl.DateTimeFormat'),
  p('locale.calendar', 'locale', '日历与数字系统', 'Calendar & numbering', 'low', '历法与数字系统能进一步缩小范围。', 'Calendar and numbering system narrow the pool.', 'Intl resolvedOptions'),
  p('locale.collator', 'locale', '排序规则', 'Collation', 'low', '文本排序规则同样来自区域数据。', 'Sort order also comes from regional data.', 'Intl.Collator'),
  p('locale.currency', 'locale', '货币格式', 'Currency format', 'low', '默认货币符号暴露地区偏好。', 'Default currency symbol hints at regional preference.', 'Intl.NumberFormat'),
  p('locale.textDirection', 'locale', '文字方向', 'Text direction', 'low', '从右到左的语言是更小的人群。', 'RTL languages form a much smaller group.', 'Intl.Locale textInfo'),
  p('locale.speechVoices', 'locale', '朗读语音', 'Speech voices', 'mid', '语音列表带语言与本地/云标记，是很强的地区线索。', 'Voice names carry language and local/cloud flags.', 'speechSynthesis.getVoices'),
  p('locale.keyboardLayout', 'locale', '键盘布局', 'Keyboard layout', 'mid', '键位表暴露实际使用的输入法布局。', 'Key maps reveal the layout actually in use.', 'navigator.keyboard'),

  // ---------------- 指纹 ----------------
  p('fp.jsEngine', 'fingerprint', 'JS 引擎', 'JS engine', 'low', '引擎类型是所有脚本行为的基础。', 'The engine underlies every script behaviour.', 'Error.message'),
  p('fp.engineVersion', 'fingerprint', '引擎真实版本', 'Engine version', 'mid', '用特性探测比 UA 更可信，UA 可以随便改。', 'Feature probes are more trustworthy than a changeable UA.', 'ES feature probes'),
  p('fp.wasm', 'fingerprint', 'WebAssembly 能力', 'WebAssembly support', 'low', 'WASM 特性集与版本绑定。', 'WASM feature set is tied to the version.', 'WebAssembly.validate'),
  p('fp.lieCheck', 'fingerprint', '接口篡改检测', 'Tampering check', 'mid', '被改写的接口 toString 不再是 native，一眼可见。', 'Overridden APIs stop looking native.', 'Function.toString'),
  p('fp.cssSupport', 'fingerprint', 'CSS 特性版本', 'CSS feature level', 'low', '支持的 CSS 特性集合等于一个版本号。', 'The supported CSS set acts as a version number.', 'CSS.supports'),
  p('fp.fontSmoothing', 'fingerprint', '字体平滑方式', 'Font smoothing', 'mid', 'ClearType 与灰度抗锯齿产生不同像素边缘。', 'ClearType and grayscale AA leave different pixel edges.', 'canvas getImageData'),
  p('fp.canvas', 'fingerprint', 'Canvas 指纹', 'Canvas fingerprint', 'high', '同一段绘制在不同 GPU/驱动/字体下像素不同。', 'The same drawing rasterizes differently per GPU, driver and fonts.', 'canvas.toDataURL'),
  p('fp.canvasRepeat', 'fingerprint', 'Canvas 稳定性', 'Canvas stability', 'mid', '画两次完全一致，说明没有加噪声。', 'Two identical draws mean no noise is added.', 'canvas × 2'),
  p('fp.webgl', 'fingerprint', 'WebGL 指纹', 'WebGL fingerprint', 'high', 'GPU 参数组合极其罕见，是强识别项。', 'GPU parameter combinations are rare and highly identifying.', 'WebGL getParameter'),
  p('fp.webglVendor', 'fingerprint', '显卡厂商', 'GPU vendor', 'mid', '厂商串常暴露虚拟化与软件渲染。', 'The vendor string often reveals virtualization.', 'UNMASKED_VENDOR_WEBGL'),
  p('fp.webglImage', 'fingerprint', 'WebGL 渲染图像', 'WebGL render image', 'high', '渲染结果的像素差异比参数串更难伪造。', 'Rendered pixels are harder to fake than parameter strings.', 'WebGL readPixels'),
  p('fp.audio', 'fingerprint', '音频指纹', 'Audio fingerprint', 'high', '音频栈的浮点差异形成稳定签名。', 'Floating-point differences in the audio stack form a signature.', 'OfflineAudioContext'),
  p('fp.math', 'fingerprint', '数学函数指纹', 'Math fingerprint', 'low', '多数人相同，只能作为合成的一部分。', 'Mostly identical; only useful in combination.', 'Math.* → SHA-256'),
  p('fp.emoji', 'fingerprint', '系统 Emoji 版本', 'Emoji version', 'low', 'Emoji 字形随系统版本变化。', 'Emoji glyphs vary by OS version.', 'canvas measureText'),
  p('fp.fontList', 'fingerprint', '字体列表', 'Font list', 'high', '装了哪些字体能反映系统、软件与语言环境。', 'Installed fonts reflect OS, software and language.', 'measureText 探测'),
  p('fp.fontCount', 'fingerprint', '已装字体数量', 'Font count', 'mid', '数量本身就是一个人群切分维度。', 'The count alone splits the population.', '同上'),
  p('fp.domRect', 'fingerprint', '元素尺寸（DOMRect）', 'DOMRect fingerprint', 'mid', '排版引擎的取整差异可被哈希。', 'Layout rounding differences can be hashed.', 'getClientRects'),
  p('fp.svgText', 'fingerprint', 'SVG 文字尺寸', 'SVG text metrics', 'mid', '另一套文字测量路径，与 canvas 略有不同。', 'A second text-measurement path, slightly different from canvas.', 'SVG getBBox'),
  p('fp.textMetrics', 'fingerprint', '文字度量', 'Text metrics', 'mid', '字体度量的小数位是很细的指纹。', 'Fractional text metrics make a fine-grained print.', 'measureText actualBoundingBox'),
  p('fp.apiCounts', 'fingerprint', '引擎接口数量', 'API surface size', 'low', '暴露的接口数量与版本强相关。', 'Number of exposed APIs correlates with version.', 'window / prototype keys'),
  p('fp.timerResolution', 'fingerprint', '计时精度', 'Timer resolution', 'low', '最小步长反映浏览器的隐私与平台策略。', 'Minimum step reflects platform and privacy policy.', 'performance.now()'),
  p('fp.recursionDepth', 'fingerprint', '调用栈深度', 'Recursion depth', 'low', '栈大小与平台、编译参数相关。', 'Stack size depends on platform and build.', '递归直至溢出'),
  p('fp.compositeId', 'fingerprint', '综合指纹', 'Composite fingerprint', 'high', '多项组合后，换 Cookie 也认得出你。', 'Combined, it identifies you without cookies.', 'SHA-256'),
  p('fp.hardwareId', 'fingerprint', '硬件编号', 'Hardware ID', 'high', '屏幕、核心数、显卡、字体组合跨浏览器仍相近。', 'Screen, cores, GPU and fonts stay similar across browsers.', 'screen · cores · GPU · fonts'),
  p('fp.cacheTag', 'fingerprint', '缓存编号（ETag）', 'Cache tag (ETag)', 'mid', '站点可在缓存头里存编号，清 Cookie 也留痕。', 'A site can store an ID in cache headers, surviving cookie clears.', '本页不写任何标记'),
  p('fp.antiFingerprint', 'fingerprint', '防指纹手段', 'Anti-fingerprint', 'mid', '有无噪声、是否随机化，决定指纹能否稳定。', 'Noise or randomization decides whether the print is stable.', 'canvas × 2 · 一致性'),
  p('fp.protection', 'fingerprint', '防护身份', 'Protection', 'low', '浏览器是否主动隐藏或伪造读数。', 'Whether the browser hides or spoofs readings.', 'navigator.brave 等'),
  p('fp.storageTrace', 'fingerprint', '存储留痕', 'Storage traces', 'mid', '本地存储、IndexedDB、缓存都能被再次读取。', 'Local storage, IndexedDB and caches can be read again.', 'localStorage · IndexedDB'),

  // ---------------- 设备 ----------------
  p('device.os', 'device', '操作系统', 'OS', 'mid', '系统决定后续所有能力与字体基线。', 'The OS sets the baseline for capabilities and fonts.', 'userAgentData / UA'),
  p('device.browser', 'device', '浏览器', 'Browser', 'low', '版本过低会额外引起风控注意。', 'An outdated version draws extra scrutiny.', 'userAgentData.brands'),
  p('device.cpuArch', 'device', 'CPU 架构', 'CPU architecture', 'low', '架构与位数能区分设备族群。', 'Architecture and bitness separate device families.', 'architecture / bitness'),
  p('device.form', 'device', '设备形态', 'Device form', 'low', '桌面 / 手机 / 平板影响内容与广告出价。', 'Form factor affects content and ad bidding.', 'formFactors · touch'),
  p('device.model', 'device', '设备型号', 'Device model', 'mid', '桌面通常读不到，移动端常能读到具体型号。', 'Usually hidden on desktop, often exposed on mobile.', 'Client Hints model'),
  p('device.screen', 'device', '屏幕分辨率', 'Screen resolution', 'mid', '分辨率加缩放比例是稳定的人群切分。', 'Resolution plus scaling is a stable split.', 'screen.*'),
  p('device.colorDepth', 'device', '色深', 'Color depth', 'low', '色深与显示链路相关。', 'Color depth follows the display pipeline.', 'screen.colorDepth'),
  p('device.pixelRatio', 'device', '像素比', 'Pixel ratio', 'mid', '缩放比例暴露显示器与系统设置。', 'Scaling exposes display and OS settings.', 'devicePixelRatio'),
  p('device.availScreen', 'device', '可用屏幕区域', 'Available screen area', 'low', '任务栏与系统栏高度会一起暴露。', 'Taskbar and system bar heights leak along with it.', 'screen.avail*'),
  p('device.screenOrientation', 'device', '屏幕方向', 'Screen orientation', 'low', '横竖屏对移动设备有额外意义。', 'Orientation matters more on mobile.', 'screen.orientation'),
  p('device.refreshRate', 'device', '刷新率', 'Refresh rate', 'mid', '60/120/144Hz 能区分设备档次。', '60/120/144Hz separates device tiers.', 'requestAnimationFrame'),
  p('device.monitors', 'device', '显示器数量', 'Monitor count', 'mid', '多屏是远程桌面与工作站的常见特征。', 'Multi-monitor is common for remote desktops and workstations.', 'screen.isExtended'),
  p('device.windowSize', 'device', '窗口尺寸', 'Window size', 'low', '窗口大小随使用习惯变化。', 'Window size follows usage habits.', 'inner / outer'),
  p('device.windowPosition', 'device', '窗口位置', 'Window position', 'low', '负坐标常见于多屏与虚拟显示器。', 'Negative coordinates hint at virtual displays.', 'screenX / screenY'),
  p('device.scrollbar', 'device', '滚动条宽度', 'Scrollbar width', 'low', '滚动条样式暴露系统与主题。', 'Scrollbar width exposes OS and theme.', 'offsetWidth − clientWidth'),
  p('device.gpuRenderer', 'device', '显卡渲染器', 'GPU renderer', 'high', '软件渲染常意味着虚拟机、远程桌面或关了硬件加速。', 'Software rendering often means VM, remote desktop or no HW accel.', 'UNMASKED_RENDERER_WEBGL'),
  p('device.virtualization', 'device', '虚拟化迹象', 'Virtualization hints', 'mid', '显卡名里带 VMware/Basic Render 就直接暴露。', 'Renderer names like VMware or Basic Render give it away.', 'renderer 关键词'),
  p('device.webgpu', 'device', 'WebGPU', 'WebGPU', 'low', '新接口会额外暴露适配器信息。', 'The newer API exposes extra adapter details.', 'navigator.gpu'),
  p('device.webgpuCaps', 'device', 'WebGPU 能力', 'WebGPU caps', 'low', '限制与特性集与 GPU 绑定。', 'Limits and features are tied to the GPU.', 'GPUAdapter'),
  p('device.webgl2Caps', 'device', 'WebGL 能力', 'WebGL caps', 'mid', '纹理上限、扩展数是显卡签名。', 'Texture limits and extensions sign the GPU.', 'WebGL2'),
  p('device.cpuThreads', 'device', 'CPU 线程', 'CPU threads', 'mid', '线程数是很常见的人群切分点。', 'Thread count is a common population split.', 'hardwareConcurrency'),
  p('device.memory', 'device', '内存', 'Memory', 'mid', '内存档位（8/16/32GB）区分设备配置。', 'Memory tiers distinguish hardware configs.', 'deviceMemory'),
  p('device.jsHeap', 'device', 'JS 内存上限', 'JS heap limit', 'low', '堆上限反映架构与版本。', 'Heap limit reflects architecture and version.', 'performance.memory'),
  p('device.touch', 'device', '触控点', 'Touch points', 'low', '有无触屏决定设备类别。', 'Touch support decides the device class.', 'maxTouchPoints'),
  p('device.battery', 'device', '电池与供电', 'Battery & power', 'low', '台式机没有电池；笔记本会暴露电量与充电状态。', 'Desktops have none; laptops reveal level and charging.', 'getBattery'),
  p('device.geolocation', 'device', '精确定位（需授权）', 'Precise geolocation (consent)', 'high', '一旦授权，IP 估算就被真实坐标取代。', 'Once granted, real coordinates replace the IP estimate.', 'geolocation'),
  p('device.motion', 'device', '运动传感器（需授权）', 'Motion sensors (consent)', 'mid', '手机上传感器读数能辅助识别设备与真伪。', 'Sensor readings help identify real devices on mobile.', 'devicemotion'),
  p('device.connection', 'device', '浏览器网络估计', 'Connection estimate', 'low', '浏览器对带宽与延迟的自估，与实际可能不同。', 'Browser-estimated bandwidth and latency.', 'navigator.connection'),
  p('device.mediaDevices', 'device', '摄像头 / 麦克风 / 扬声器', 'Cameras / mics / speakers', 'mid', '设备数量在未授权时也能读到，数量组合很少见。', 'Counts are visible without permission and are rare in combination.', 'enumerateDevices'),
  p('device.audioHardware', 'device', '音频硬件', 'Audio hardware', 'mid', '采样率、声道、延迟构成硬件签名。', 'Sample rate, channels and latency sign the hardware.', 'AudioContext'),
  p('device.audioLatency', 'device', '音频输出延迟', 'Audio output latency', 'low', '延迟值受驱动与设备影响。', 'Latency varies with driver and device.', 'baseLatency / outputLatency'),
  p('device.passkey', 'device', '通行密钥能力', 'Passkey support', 'low', '是否支持平台认证器，反映系统与安全芯片。', 'Platform authenticator support reflects OS and secure hardware.', 'PublicKeyCredential'),
  p('device.bluetooth', 'device', '蓝牙', 'Bluetooth', 'low', '蓝牙有无区分设备类型。', 'Presence of Bluetooth distinguishes device types.', 'navigator.bluetooth'),
  p('device.gamepad', 'device', '游戏手柄', 'Gamepad', 'low', '接入手柄是更小的人群。', 'A connected gamepad is a smaller group.', 'getGamepads'),
  p('device.vr', 'device', 'VR / AR 设备', 'VR / AR device', 'low', '头显用户群体很小。', 'Headset users are a small group.', 'navigator.xr'),
  p('device.vrDisplays', 'device', 'VR 显示能力', 'VR display', 'low', '是否支持沉浸式会话。', 'Whether immersive sessions are supported.', 'isSessionSupported'),
  p('device.usbDevices', 'device', 'USB 接口', 'WebUSB', 'low', '接口开放与否本身是一个特征。', 'Whether the API is exposed is itself a signal.', 'navigator.usb'),
  p('device.midiDevices', 'device', 'MIDI 接口', 'Web MIDI', 'low', '专业音频用户才会用到。', 'Used mostly by audio professionals.', 'navigator.requestMIDIAccess'),
  p('device.videoCodecs', 'device', '视频编码格式', 'Video codecs', 'low', '硬件与系统决定支持哪些编码。', 'Hardware and OS decide codec support.', 'MediaSource.isTypeSupported'),
  p('device.rtcCodecs', 'device', 'WebRTC 编解码器', 'WebRTC codecs', 'low', '音频视频编码清单随浏览器版本变化。', 'Codec lists follow browser versions.', 'RTCRtpSender.getCapabilities'),
  p('device.recorderFormats', 'device', '录制格式', 'Recording formats', 'low', '可录格式数与版本相关。', 'Supported recording formats track versions.', 'MediaRecorder'),
  p('device.hwDecode', 'device', '视频硬件解码', 'Hardware decoding', 'mid', '有硬件解码的格式很少见，可作为显眼项。', 'Supported HW-decoded formats are rare and stand out.', 'mediaCapabilities'),
  p('device.drm', 'device', 'DRM 模块', 'DRM modules', 'low', 'Widevine 与 ClearKey 暴露平台能力。', 'Widevine and ClearKey expose platform capability.', 'requestMediaKeySystemAccess'),
  p('device.storageQuota', 'device', '存储配额', 'Storage quota', 'low', '可用配额与磁盘、配额策略相关。', 'Quota depends on disk and policy.', 'storage.estimate'),
  p('device.webrtcPublic', 'device', 'WebRTC 公网地址', 'WebRTC public address', 'high', '即使不用代理，WebRTC 也可能暴露真实出口。', 'WebRTC can reveal the real egress even behind a proxy.', 'RTCPeerConnection · STUN'),
  p('device.webrtcLocal', 'device', '局域网地址', 'Local address', 'mid', '内网地址会暴露本地网络结构。', 'LAN addresses reveal local network structure.', 'host candidate'),
  p('device.webrtcCandidates', 'device', 'ICE 候选数量', 'ICE candidate count', 'low', '候选数与网络拓扑相关。', 'Candidate count reflects topology.', 'onicecandidate'),

  // ---------------- 浏览器设置 ----------------
  p('browser.colorScheme', 'browser', '深浅色', 'Color scheme', 'low', '主题偏好是很轻但稳定的信号。', 'A light but stable signal.', 'prefers-color-scheme'),
  p('browser.reducedMotion', 'browser', '动画效果', 'Reduced motion', 'low', '关闭动画的人比想象中少。', 'Fewer people disable motion than you would think.', 'prefers-reduced-motion'),
  p('browser.colorGamut', 'browser', '屏幕色域', 'Color gamut', 'low', '广色域屏幕是更小的群体。', 'Wide-gamut screens are a smaller group.', 'color-gamut'),
  p('browser.contrast', 'browser', '对比度偏好', 'Contrast preference', 'low', '辅助功能设置会进入合成指纹。', 'Accessibility settings join the composite print.', 'prefers-contrast'),
  p('browser.forcedColors', 'browser', '强制配色', 'Forced colors', 'low', '高对比模式会影响渲染结果。', 'High contrast changes rendering.', 'forced-colors'),
  p('browser.defaultFont', 'browser', '默认字号与强调色', 'Default font size & accent', 'low', '系统设置被直接读出。', 'System settings are read directly.', 'font-size / AccentColor'),
  p('browser.displayMode', 'browser', '打开方式', 'Display mode', 'low', '独立窗口与标签页可被区分。', 'Standalone window vs tab is detectable.', 'display-mode'),
  p('browser.privacySignals', 'browser', '隐私信号', 'Privacy signals', 'low', 'DNT/GPC 设置本身就是一个位。', 'DNT/GPC is itself a bit.', 'doNotTrack · GPC'),
  p('browser.cookies', 'browser', 'Cookie', 'Cookies', 'low', '关掉 Cookie 并不会让你更匿名。', 'Disabling cookies does not make you more anonymous.', 'navigator.cookieEnabled'),
  p('browser.permissions', 'browser', '权限状态', 'Permission states', 'mid', '未弹窗也能读到已允许/已拒绝的清单。', 'Granted/denied lists are readable without a prompt.', 'permissions.query'),
  p('browser.notifPermission', 'browser', '通知权限', 'Notification permission', 'low', '权限状态进入合成指纹。', 'Permission state joins the composite.', 'Notification.permission'),
  p('browser.geoPermission', 'browser', '定位权限', 'Geolocation permission', 'mid', '已授权定位的用户群体小得多。', 'Users who granted geolocation are far fewer.', 'permissions.query'),
  p('browser.clipboardPermission', 'browser', '剪贴板权限', 'Clipboard permission', 'low', '写剪贴板权限常被忽略。', 'Clipboard-write is often overlooked.', 'permissions.query'),
  p('browser.storagePersisted', 'browser', '持久化存储', 'Persistent storage', 'low', '是否申请了持久化，影响留痕能力。', 'Whether storage is persisted affects traceability.', 'storage.persisted'),
  p('browser.sensitiveApis', 'browser', '敏感接口开放数', 'Sensitive APIs', 'mid', '开放多少高危接口，是很反常的组合。', 'How many powerful APIs are exposed is unusual in combination.', 'usb / serial / hid …'),
  p('browser.pdfViewer', 'browser', 'PDF 阅读器', 'PDF viewer', 'low', '内置阅读器有无与版本相关。', 'Built-in viewer presence tracks version.', 'pdfViewerEnabled'),
  p('browser.builtinAi', 'browser', '浏览器内置 AI', 'Built-in AI', 'mid', '本地模型是否就绪，只有极少数人有。', 'A ready local model is very rare.', 'LanguageModel'),
  p('browser.automation', 'browser', '自动化标记', 'Automation flag', 'high', 'webdriver 标记直接说明不是真人操作。', 'The webdriver flag says a robot is driving.', 'navigator.webdriver'),
  p('browser.automationTraces', 'browser', '自动化痕迹', 'Automation traces', 'high', 'headless、CDP、Electron 都会留下痕迹。', 'Headless, CDP and Electron all leave traces.', 'window 属性扫描'),
  p('browser.identityStrings', 'browser', '身份字符串', 'Identity strings', 'low', '厂商、产品子版本、插件数是老牌指纹源。', 'Vendor, productSub and plugin count are classic prints.', 'navigator.vendor'),
  p('browser.interaction', 'browser', '操作方式', 'Interaction pattern', 'mid', '鼠标轨迹与点击时序能区分人与脚本。', 'Pointer paths and timing separate humans from scripts.', 'pointer 事件'),
  p('browser.workerNav', 'browser', 'Worker 中的 navigator', 'Worker navigator', 'mid', '脚本环境里的读数若与页面不一致，就是破绽。', 'Mismatched readings between worker and page are a tell.', 'Worker · navigator'),
  p('browser.adblock', 'browser', '广告拦截', 'Ad blocking', 'mid', '拦截器的存在会改变页面与请求行为。', 'A blocker changes page and request behaviour.', 'bait element'),
  p('browser.trackerBlock', 'browser', '追踪拦截', 'Tracker blocking', 'mid', '需要主动向追踪域名发请求才能测，本页不发。', 'Requires requests to tracker domains; this page sends none.', '本页不测量'),
  p('browser.extensions', 'browser', '浏览器扩展', 'Extensions', 'mid', '部分扩展会改写页面，从而被识别。', 'Some extensions rewrite pages and become identifiable.', 'window 标记'),
  p('browser.tabHistory', 'browser', '本标签页历史', 'Tab history', 'low', '本页打开过多少页面会被读到。', 'How many pages this tab visited is readable.', 'history.length'),
  p('browser.installedFonts', 'browser', '已装字体明细', 'Installed fonts', 'high', '字体清单是最常见的强识别项之一。', 'Font lists are among the strongest common identifiers.', '字体探测'),

  // ---------------- 网络 ----------------
  p('network.effectiveType', 'network', '网络类型估计', 'Effective type', 'low', '浏览器对 4G/5G 的粗估。', 'A rough 4G/5G estimate.', 'navigator.connection'),
  p('network.rtt', 'network', '浏览器估计的延迟', 'Estimated RTT', 'low', '自估值，常与真实链路不一致。', 'Self-estimated, often unlike the real path.', 'connection.rtt'),
  p('network.downlink', 'network', '浏览器估计的带宽', 'Estimated downlink', 'low', '自估带宽会进入网络画像。', 'Estimated bandwidth joins the network profile.', 'connection.downlink'),
  p('network.saveData', 'network', '省流量模式', 'Data saver', 'low', '开启省流量是较小的人群。', 'Data-saver users are a smaller group.', 'connection.saveData')
]

