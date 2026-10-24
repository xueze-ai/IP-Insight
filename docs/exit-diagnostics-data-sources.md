# 网络出口诊断 · 数据源与接入说明（0.2.2）

> 本文记录 0.2.2 新增「网络出口诊断」模块实际使用的页面 / 端点、测量方式、字段含义、最近核验时间与已知限制。
> 原则：只使用真实核验过的公开诊断端点与页面自身流程；不伪造 Referer / Origin / 令牌；不绕过验证码、登录、访问控制或证书校验；不把任何站点的内部接口当作可任意复用的公共 API。

最近核验时间：**2026-10-24**（本机实测，全部端点均以真实请求验证过响应结构与信号字段）

---

## 一、关于 ip.skk.moe 的接入方式

[ip.skk.moe](https://ip.skk.moe/)（作者 Sukka）的页面结构（IP 归属多源、网络连通性检查、CDN 命中节点测试、DNS 出口查询、多出口分流查询）经 2026-10 通过其公开页面与 2025-03 存档快照核验。

**本应用的接入方式：复用正常网页自身的检测流程。**
「出口诊断 → 本机公网 IP」在隐藏浏览器窗口中加载 `https://ip.skk.moe/`，等待页面自身完成检测后，读取页面展示的结果（IPv4 / IPv6 / ASN），不做接口逆向、不直接调用其内部 API。

已知限制（如实呈现，不做绕过）：

- 该站对数据中心 / 代理出口 IP 启用了 Cloudflare 人机验证（Managed Challenge）。出现验证页时，本应用**如实报告「站点返回人机验证页，按合规约束不绕过验证」**，不做任何规避；用户可在软件内浏览器手动完成验证后重试。
- 站点源码未开源，作者已明确反对复制其 API。本应用因此**不调用、不猜测其内部接口**；`/split-tunnel`、`/cdn-node-lookup`、`/dns-exit-lookup`、`/multi` 页面依赖作者自有基础设施（随机子域名 + 权威 DNS 回执等），不属于公开 API，本应用不直接复用。
- 旧版 MyIP 的端点（ip.skk.moe 的前身）已过时，本应用不使用。

因此，四项诊断的**数据来源以本应用自己的公开端点探测为主**（下文全部列出），来源标识如实标注（`cloudflare` / `google-authoritative` / `akamai-authoritative` / `cdn-target` / `target-site` / `sukka-page`），**不冒充 Sukka 数据**。

## 二、本机公网 IP（publicIp）

| 观测点 | 端点 | 测量方式 | 字段含义 | 核验 |
| --- | --- | --- | --- | --- |
| Cloudflare | `https://www.cloudflare.com/cdn-cgi/trace` | 主进程 HTTP GET（`net.fetch`，遵循系统代理） | `ip=`=该观测点看到的出口 IP；`colo=`=命中的 Cloudflare 边缘节点代码；`loc=`=IP 归属国家码 | ✅ 2026-10-24 |
| Cloudflare Speed | `https://speed.cloudflare.com/cdn-cgi/trace` | 同上 | 同上 | ✅ 2026-10-24 |
| Sukka 页面 | `https://ip.skk.moe/` | 隐藏浏览器加载，页面自身检测完成后提取展示结果 | 页面展示的 IPv4 / IPv6 / ASN | ✅ 2026-10-24（受挑战页限制，见上文） |

- `/cdn-cgi/trace` 是 Cloudflare 官方公开诊断路径（官方文档与社区长期使用），每台边缘节点提供，返回键值对文本。
- 不同观测点可能观察到不同出口（分流 / 地址族差异），应用全部保留、并排展示，不判为冲突。
- IPv6 未取得时显示「未测得」，不以 IPv4 或默认值代替。

## 三、网站分流测试（splitTunnel）

对每个目标使用**该目标官方提供的诊断端点**；Cloudflare 前置站点的 `/cdn-cgi/trace` 会回显出口 IP，其余目标仅记录可达性 / HTTP 状态 / 耗时（不伪造出口）。

| 目标 | 诊断端点 | 出口回显 | 核验 |
| --- | --- | --- | --- |
| Cloudflare（基线） | `https://www.cloudflare.com/cdn-cgi/trace` | ✅ ip= / colo= | ✅ |
| ChatGPT | `https://chatgpt.com/cdn-cgi/trace` | ✅ | ✅（直连网络下可能被重置，如实报错） |
| Claude | `https://claude.ai/cdn-cgi/trace` | ✅ | ✅ |
| OpenAI API | `https://api.openai.com/cdn-cgi/trace` | ✅ | ✅ |
| Discord | `https://discord.com/cdn-cgi/trace` | ✅ | ✅（个别网络返回异常页，如实报「响应中无 ip 字段」） |
| GitLab | `https://gitlab.com/cdn-cgi/trace` | ✅ | ✅ |
| GitHub | `https://github.com/` | ❌ 仅可达性 | ✅ |
| 百度 / 网易云音乐 / Bilibili | 站点首页 | ❌ 仅可达性 | ✅ |

**结果口径**：结果只代表该诊断端点观察到的出口，**不能宣称整个网站的全部资源都使用相同出口**。无基线时应用以「出口 A / 出口 B」并列表达差异，不推断「直连 / 代理 / 规则是否正确」。

## 四、CDN 命中节点（cdnNode）

对每个 CDN 的公开测试端点发起一次 HTTP GET，从**响应头 / trace 字段**读取节点代码（保留原文，不推断城市）；有明确缓存信号头时才显示 HIT/MISS；耗时为 HTTP 请求耗时（非 ICMP Ping）。

| CDN | 测试端点 | 节点信号 | 缓存信号 | 核验 |
| --- | --- | --- | --- | --- |
| Cloudflare | `www.cloudflare.com/cdn-cgi/trace` | `colo=` | — | ✅ |
| Cloudflare Speed | `speed.cloudflare.com/cdn-cgi/trace` | `colo=` | — | ✅ |
| Fastly | `https://any.pops.fastly-analytics.com` | `X-Served-By: cache-…-SIN` | `X-Cache` | ✅ |
| AWS CloudFront | `https://djlzvy5xcvhxt.cloudfront.net/500b-bench.jpg` | `X-Amz-Cf-Pop: HKG61-P1` | `X-Cache` | ✅ |
| Bunny Standard | `https://test.b-cdn.net` | `Server: BunnyCDN-…-JP1` | — | ✅ |
| Bunny Volume | `https://testvideo.b-cdn.net` | `Server: BunnyCDN-…-LA1` | — | ✅ |
| CDN77 | `https://1596384882.rsc.cdn77.org/500b-bench.jpg` | `X-77-POP: losangelesUSCA` | `X-77-Cache` | ✅ |
| CacheFly | `https://cdnperf.cachefly.net/500b-bench.jpg` | `X-CF1: …cacheN.hkg3-01…` | `X-CF2: H/M` | ✅ |
| OVH CDN | `https://ovh-cdn.perfops.io/500b-bench.jpg` | `X-CDN-Pop: sbg` | — | ✅ |
| Zenlayer | `https://test-perfops.ecn.zenlayer.net/500b-bench.jpg` | 无 PoP 头（仅可达性） | — | ✅ |
| jsDelivr | `https://cdn.jsdelivr.net/npm/latency-test@1.0.0/generate_200` | 无 PoP 头（仅可达性） | — | ✅ |

说明：`500b-bench.jpg` 等测试资源来自 PerfOps / CDNPerf 公开性能测试网络（公开 RUM 测速生态常用资源）；`test.b-cdn.net` / `testvideo.b-cdn.net` 为 Bunny 官方公开测试域；`any.pops.fastly-analytics.com` 为 Fastly 官方 RUM 收集端点（响应头明确声明 `Access-Control-Expose-Headers: X-Served-By`）。

## 五、DNS 出口查询（dnsExit）

**原理**：向指定的递归解析器发送 TXT 查询，查询「诊断用权威区」的记录；该权威区在应答中回显「来查询的解析器出口 IP」（以及 EDNS Client Subnet 信息）。这是递归解析器向权威 DNS 发起查询时暴露的出口，**通常不等于你的公网 IP**，也**不能单独据此判断「DNS 泄露」**。

| 诊断区 | 提供方 | 应答内容 | 核验 |
| --- | --- | --- | --- |
| `o-o.myaddr.l.google.com` (TXT) | Google 官方诊断区 | 解析器出口 IP（可含 `edns0-client-subnet …` 网段信息） | ✅ 2026-10-24 |
| `whoami.ds.akahelp.net` (TXT) | Akamai 官方诊断区（[whoami.ds.akahelp.net](https://whoami.ds.akahelp.net/)） | `ns <IP>` / `ip <IP>` | ✅ 2026-10-24 |

被查询的解析器（每组各查 2 条记录，UDP 53 直连）：

| 解析器 | 地址 | 说明 |
| --- | --- | --- |
| 系统默认解析器 | 运行时读取系统 DNS 配置的第一台 | 代表系统当前实际使用的解析路径之一 |
| AliDNS | `223.5.5.5` | 国内公共解析 |
| DNSPod | `119.29.29.29` | 国内公共解析 |
| 114DNS | `114.114.114.114` | 国内公共解析 |
| Google DNS | `8.8.8.8` | 国际公共解析 |
| Cloudflare DNS | `1.1.1.1` | 国际公共解析 |

**数据口径**：

- 多个递归出口全部保留（不同解析器、不同地址族的出口并列展示）。
- 部分解析器对诊断区返回 EDNS Client Subnet 网段或被二进制截断的片段；此时**不输出猜测的 IP**（保持无出口），原始记录保留在证据中。
- 本测试只覆盖被查询的解析器，不代表所有应用与所有域名的解析路径；系统配置的 DNS 地址、普通查询返回的 A/AAAA 记录、公共 DoH 结果、预置服务商地址、上一轮缓存——这些**都不冒充 DNS 出口**。
- `whoami.cloudflare` 已返回 NXDOMAIN（2026-10 实测），不再使用。

## 六、实现位置

- 数据模型：`src/shared/diag.ts`（runId / 探测项 / 状态机 / 证据）
- 目标配置（集中维护）：`src/main/diag/targets.ts`
- 探测原语：`src/main/diag/probes.ts`、纯解析 `src/main/diag/textparse.ts`（含单测 `scripts/test-textparse.cjs`）
- 编排（有限并发 / 超时 / 取消 / 迟到轮次隔离）：`src/main/diag/orchestrator.ts`
- UI：`src/renderer/src/components/ExitDiag.tsx`（网络质量页内嵌）
- 自动验证钩子：`IPI_AUTO_TEST=diag`（真实采集写 JSON）、`IPI_UI_VERIFY_EXIT=1`（真实窗口 UI 流程）

## 七、多出口策略路由（/multi）

Sukka 的 `/multi`（多出口策略路由）页面的接入方式无法在「不调用其内部接口」的前提下核实，且其请求规模（数百探针）不符合本应用的克制原则。**0.2.2 暂不实现**，保留后续以「用户明确启动 + 规模说明 + 进度与停止」的方式评估。
