# 「网站眼里的你」数据来源与测法

页面：左侧导航「网站眼里的你」（`whoAmI`）。本文件说明每一项读数**从哪来、怎么测、测不到时怎么显示**，方便复核与质疑。

总原则：

1. **只报实测值**。读不到就写「本次读不到」或「本页不判定」，并用 `detail` 说明原因，不用推测值填充。
2. **服务端能观测的与本机可读的分开标注**。JA4 / HTTP/2 / TCP-IP / QUIC / 服务端 UA 回显这 5 项标「仅服务端可观测」。
3. **全部在本机完成**。除下列公开诊断端点的普通请求外，不上传任何读数；「复制为文字 / JSON」只写系统剪贴板。

---

## 一、服务器看到的（28 项，主进程 `src/main/whoami/serverProbe.ts`）

| 组内项 | 来源 | 测法 |
| --- | --- | --- |
| 出口 IP、地址族、HTTP 版本、TLS 版本、密钥交换、SNI、WARP / Gateway、colo、时钟参考 | Cloudflare `/cdn-cgi/trace` | 主进程 HTTPS GET，解析 `key=value` 行；同时用第二个 trace 端点（speed.cloudflare.com）交叉，避免单点误差 |
| TLS 套件 / ALPN | Node `https` 直连 | `TLSSocket.getProtocol()` / `getCipher()` / `alpnProtocol`，独立于浏览器 |
| IPv6 出口 | Node `https`（`family: 6`） | 单独请求 trace 的 IPv6 端点；失败保留「不支持 / 读不到」 |
| 多出口 / 分流 | 4 个回显端点 | cloudflare trace、speed trace、chatgpt trace、api.ip.sb 各自回显的 IP 并列；不同即视为多出口 |
| 归属（城市 / 坐标 / ASN / 类型 / 时区 / 反解） | `ip-api.com`，失败回退 `ipwho.is` | 对测得的唯一出口 IP 查询；按 IP 去重、10 分钟缓存 |
| DNS 服务器 | 系统 `dns.getServers()` | 读系统配置，不发请求 |
| DNS 递归出口 / ECS | 系统解析器与 `223.5.5.5` 各自查询 `whoami.akamai.net` | 读 TXT 里的 `ns=`（解析器出口）与 `ecs=`（客户端网段）；两者不混用 |
| DNS 出口归属 | `ip-api.com`（对 DNS 出口 IP） | 与 HTTP 出口归属分开查询，用于「DNS 与 IP 不同国」判定 |
| 往返延迟 | 3 次 trace 请求 | 取最小 RTT，避开抖动 |
| 时钟偏差 | trace 的 `ts` 与 `Date.now()` | 只标「快 / 慢 n 秒」，不判断原因 |
| Tor 出口节点 | `check.torproject.org` 公开出口列表 | 下载列表、30 分钟缓存、按 IP 精确比对；只判断「在 / 不在列表」 |
| JA4 / HTTP2 / TCP-IP / QUIC / 服务端 UA | —— | **仅服务端可观测**，本应用不伪造本机读数 |

失败处理：单项失败只影响该项，其余照常；整轮失败时页面顶部提示「没有取到任何出口信息：请检查网络或代理设置」。

---

## 二、请求头（8 项）

浏览器把请求发给应用主进程时由 Electron 会话发出，页面侧通过 `fetch` 到 trace 端点回读 `request.headers`；`Sec-CH-UA-*` 依赖浏览器是否发送高熵 hints（`Accept-CH` 协商后才出现），未发送时显示「未发送」而不是空值。

## 三、语言和地区（15 项）

全部来自标准 Web API，不需要授权：`navigator.languages`、`Intl.DateTimeFormat().resolvedOptions()`（locale / calendar / numberingSystem / timeZone / hourCycle）、`Intl.Locale().weekInfo`、`Intl.NumberFormat` 样例格式、`Intl.supportedValuesOf`（时区 / 货币 / 单位 / 历法数量）、`navigator.keyboard.getLayoutMap()`、`speechSynthesis.getVoices()`。

## 四、指纹（28 项，渲染进程 `src/renderer/src/whoami/collect.ts`）

| 项 | 测法 |
| --- | --- |
| Canvas | 固定文案 + 图形绘制后 `toDataURL`，取 SHA-256 前 8 位；同页再画一次用于「防指纹」比对（两次一致 = 没有加噪） |
| WebGL / WebGL 读回像素 | `getParameter`（VENDOR / RENDERER / 版本 / 扩展数 / 限制）+ `readPixels` 取样哈希 |
| 音频 | `OfflineAudioContext` 渲染固定缓冲，取前若干采样哈希 |
| 数学函数 | 一组 `Math.*` 结果拼接后 SHA-256（不同引擎的浮点实现有差异） |
| 系统 Emoji 版本 | `measureText` 逐级探测能渲染的最高 Emoji 版本 |
| 字体列表 | 60 种常见字体：以基准字体宽度比对 `measureText`，命中即视为已安装；**近似判定**，非常规字体或改过字体回退会漏 |
| DOMRect / SVG / 文字度量 | `getClientRects`、SVG `getBBox` / `getComputedTextLength`、`measureText.actualBoundingBox*` |
| 引擎接口数 | `window` / `HTMLElement` / `CSS` 自有属性计数 |
| 计时精度 / 递归深度 | `performance.now()` 最小步长；受控递归直到栈溢出 |
| 综合指纹 | 上述分项规范化后 SHA-256，用于「本次 vs 上次」对比 |
| 硬件编号（跨浏览器） | 屏幕 + 核心数 + GPU + 字体集合哈希，换浏览器仍可能一致 |
| 缓存 ETag | 请求一个带 `ETag` 的本机资源，读 `If-None-Match` 命中情况（缓存能否认出你） |
| 谎言检测 | 常用接口 `Function.prototype.toString` 是否被改写 + iframe 内读数对照 |
| 防指纹 | Canvas 两次绘制是否一致；`navigator.brave` 等开关 |

**不做稀有度结论**：本站没有公共样本库，无法给出「N 次检测里只有你」，因此只用本机历史对比，并在页面写明。

## 五、设备（47 项）

`navigator.userAgentData`（brands / platform / architecture / bitness / model / formFactors）、`screen`（尺寸 / `devicePixelRatio` / 色深 / `isExtended` / `availHeight`）、窗口尺寸与滚动条宽度、`requestAnimationFrame` 估刷新率、WebGL RENDERER（识别软件渲染：Basic Render / llvmpipe / SwiftShader / VMware / VirtualBox）、WebGPU adapter 与 limits、`hardwareConcurrency`、`deviceMemory`、`performance.memory`、`maxTouchPoints` / `pointer`、`getBattery()`、`enumerateDevices()`、`AudioContext` 采样率与声道、`PublicKeyCredential`、`bluetooth.getAvailability()`、`getGamepads()`、`navigator.xr.isSessionSupported`、`MediaSource.isTypeSupported`、`RTCRtpSender.getCapabilities`、`MediaRecorder.isTypeSupported`、`mediaCapabilities.decodingInfo`、`requestMediaKeySystemAccess`、`storage.estimate()`。

**读不到时的显示**：WebGL 不可用（虚拟机、远程桌面、关闭硬件加速）→ 值留空 + 「WebGL 不可用（GPU 被禁用或环境没有显卡）」；刷新率、WebGPU、传感器等浏览器不提供时显示「这个浏览器不提供」。

## 六、浏览器设置（27 项）

`matchMedia`（`prefers-color-scheme` / `prefers-reduced-motion` / `prefers-contrast` / `forced-colors` / `color-gamut` / `dynamic-range`）、计算样式（默认字号、`AccentColor`）、`navigator.permissions.query` 逐项状态、敏感接口是否存在（WebUSB / Serial / HID / MIDI / IdleDetection / ComputePressure / LocalFontAccess / WindowManagement / InstalledRelatedApps / FileSystemAccess）、`pdfViewerEnabled`、内置 AI（`LanguageModel` / `Translator.availability`）、`navigator.webdriver` 与 headless / CDP / Electron 痕迹、扩展识别（`window.ethereum`、`chrome-extension://` 资源探测）、广告拦截 bait element、`history.length`、localStorage / IndexedDB / CacheStorage / `window.name` 留痕。

## 七、网络（4 项）

`RTCPeerConnection` + 公共 STUN 收集候选：区分 host / srflx（局域网与公网候选），用于 WebRTC 泄漏判定；`navigator.connection`（effectiveType / rtt / downlink）；IPv6 地址与 EUI-64 特征从 WebRTC 候选读取。拿不到候选时写「没有公网地址 / 无」，不推断。

## 八、伪装检测与目标地区模拟

- 判定逻辑在 `src/renderer/src/whoami/checks.ts`，输入是上面的实测读数 + 服务端事实，输出「冲突 / 值得注意 / 一致 / 说明」四类结论，每条带证据行与改法。
- **只报有证据的冲突**；证据不足（例如本机看不到 TCP 层特征、trace 不返回 ECH）→ 明确写「本页不判定」。
- 目标地区模拟只比较已读到的项，读不到的项不参与打分，避免「读不到 = 不合格」的假结论。

## 九、网络工具箱（真实测量，主进程 `src/main/whoami/tools.ts`）

| 工具 | 命令 / 方式 | 说明 |
| --- | --- | --- |
| 路由追踪 | 系统 `tracert -d -w 700 -h 22` | 不做反向解析（`-d`），最多 22 跳；Linux/macOS 无此命令时如实报错 |
| 网络诊断 | 本机地址（`os.networkInterfaces`）、DNS 服务器、DNS 解析、TCP 443 到 Cloudflare / GitHub / 百度、HTTP 延迟、`netsh interface ipv4 show subinterfaces` 取 MTU | 8 项，逐项给通过 / 警告 / 失败与证据；MTU 仅 Windows |
| CDN 雷达 | 10 个 CDN 公开性能端点，并发 4 | 读响应头里的节点标识与缓存信号（如 `cf-cache-status`、`x-cache`、`x-amz-cf-pop`），并用 Cloudflare trace 补 colo；耗时是 HTTP 请求耗时，不是 ICMP |

## 十、本版未做的事

- 不写入历史、不参与 AI 分析（需要留存用「复制 JSON」）。
- 不做公共样本稀有度、不做 JA4 / TCP 指纹的本机伪造读数、不猜 ECH 与后量子结果。
