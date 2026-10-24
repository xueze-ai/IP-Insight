# 0.2.3 验证记录（2026-10-24）

> 环境：Windows 10 (26200) x64 · Electron 44.5.1 · Node 22.23.4 · 真实网络（系统代理 + 直连双路径）
> 原则：区分「通过 / 失败 / 受环境限制未验证」；Demo 通过 ≠ 真实采集通过；代码写完 ≠ 验证通过。
> 目录：`E:\ip\ip-insight-0.2.3`（独立于 0.2.2 工作树；产物与日志在 `test-output/`）。

## 一、静态验证（全部通过）

| 项目 | 结果 |
| --- | --- |
| `npm run typecheck:node` | ✅ 0 错误 |
| `npm run typecheck:web` | ✅ 0 错误 |
| `npm run build` | ✅ 0 错误（main / preload / renderer 三端） |
| 解析单元测试 `node scripts/test-textparse.cjs` | ✅ 25/25（DNS 报文 ID/rcode/全 TXT/字符段、Google & Akamai whoami 字段语义：ns=出口 / ip=ECS 代表 / ecs=客户端网段 / 仅 ECS / 歧义多 IP、CDN 原始节点与多段缓存顺序、trace/bilibili/IPIP/纯文本回显） |

## 二、真实采集验证（非 Demo）

### 全四模块真实运行（`IPI_AUTO_TEST=diag`，`test-output/diag.result.json`）

- **publicIp** [partial 2/4]：两台 Cloudflare 观测点回显同一出口并带归属（ip-api.com：香港 / 运营商）；强制 IPv6 直连在本机无 IPv6 时返回 `unsupported`（中性「未取得 IPv6 出口」）；Sukka 页面遇 Cloudflare 人机验证如实报失败（不绕过）。
- **splitTunnel** [partial 14/15]：ChatGPT（IPv6 日本）、Claude（IPv6 美国）、Anthropic（IPv6 美国）、OpenAI API（IPv4 日本）各自回显真实出口，与主出口（香港）不同——按目标并列展示，未判异常；哔哩哔哩 / IPIP.net / IP.SB 取得国内出口且归属正确（哔哩哔哩/IPIP 标注「目标自身提供」）；GitHub / 百度 / 网易云如实显示「可访问，未提供出口 IP」；Discord 一次失败保留真实原因（响应中无 ip 字段）。
- **cdnNode** [success 11/11]：原始节点完整保留（`HKG61-P1`、`cache-hkg17922-HKG`、`BunnyCDNE-HK1-1059`、CacheFly 全串）；jsDelivr 多段缓存信号顺序保留（`HIT → HIT`）；CDN77 当次响应无 PoP 头 → 显示「未提供节点信息」（未编造）。
- **dnsExit** [partial 9/12]：Akamai 语义解析正确（`ns`=出口、`ecs`=客户端网段、`ip` 不计出口）；DNSPod 仅返回 ECS 网段（内含截断地址）→ 不输出猜测出口；Google/Cloudflare 出口正常取得（含 IPv6 出口）；系统解析器与 Google DNS 若干超时如实标注。
- 整轮状态在含 partial 模块时正确显示 partial（修复项已验证）。

### 修复项专项验证（真实运行核对）

| 修复项 | 验证方式 | 结果 |
| --- | --- | --- |
| 骨架启动即渲染、事件更新未创建行 | UI 真实窗口点击「开始全部检测」后立即出现全部目标行并逐行更新 | ✅ |
| 停止/超时终结全部未完成状态 | 真实窗口点「停止」→ 全部行立即落定（取消/超时语义），可立即重跑 | ✅（钩子路径） |
| 综合检测关联指定 runId（非全局 latest） | 综合检测后历史记录 diag 摘要的 runId 与启动返回一致 | ✅（HIST 钩子：含出口诊断 2/3 · 批次号一致） |
| 载入历史后出口面板显示历史快照 | 历史载入 → 出口诊断页显示快照横幅与批次号 | ✅（代码路径 + Demo 手动核对；真实历史载入在 HIST 钩子通过） |
| AI reqId 绑定 | aiStore/askStore 请求 ID 与流式片段匹配过滤（单测级代码路径） | ✅ 代码级；跨请求竞态受环境限制未做双 AI 并发实测 |
| Sukka 仅 IPv6 成功保留地址 | orchestrator 显式 ipv4??ipv6 逻辑 | ✅ 代码级（本环境 Sukka 被挑战页拦截，无法实测 IPv6-only 成功样例） |
| 单项重试保留其他结果与尝试历史 | `diag:retry` 事件流（真实窗口重试按钮） | ✅（UI 钩子路径）attempts 数组进入历史导出 |

## 三、UI 真实窗口回归（真实 IPC + 真实网络，非 Demo）

| 钩子 | 覆盖 | 结果 |
| --- | --- | --- |
| `IPI_UI_VERIFY=1` | 综合检测全流程（四源真实 4/4）、多源摘要、IP 信息页 | ✅ |
| `IPI_UI_VERIFY_EXIT=1` | 新独立页：开始全部检测（34s 完成 38 项）→ 概览统计（6 HTTP 出口 / 11 取得 IP / 3 仅可达 / 1 失败 / 8 DNS 出口）→ 四标签计数（2/4、14/15、11/11、9/12）→ CDN 标签行展开详情（含尝试历史与原始证据） | ✅ |
| `IPI_UI_VERIFY_HIST=1` | 检测 → 历史写入（含失败源 + 关联诊断摘要 runId）→ 展示 → 载入分析页（历史横幅）→ 四格式导出（含出口诊断章节：TXT/HTML 含归属/缓存/ECS 列，JSON 结构化，PDF 165KB 生成）→ AI 回写往返 | ✅ |
| `IPI_UI_VERIFY_RISK=1` | 风险页：计算值说明、口径标注、分歧项、ChatGPT 出口独立、泄露中性条目（真实检测后） | ✅ |
| `IPI_UI_VERIFY_SETTINGS=1` | 设置往返、AI 未配置真实报错路径、AI 当前提供商置顶 | ✅ |
| `IPI_UI_VERIFY_FP=1` | 指纹页分组摘要 + 详细展开（真实 GPU / 字体 / 音频指纹） | ✅ |

## 四、Demo / 截图 / 双语 / 主题

| 项目 | 结果 |
| --- | --- |
| Demo 预览启动（preview-web + Electron 加载） | ✅ 页面正常渲染（含出口诊断页四标签、骨架流式更新） |
| 截图脚本 `capture-demo.cjs` | ✅ 13/13 全部通过（逐张断言：导航 / 按钮 / 关键文案 / PNG ≥20KB；ALL DONE） |
| 截图亮度复核 `check-shots.cjs` | ✅ 浅色主题平均亮度 244.9–248.2 |
| 英文界面 | ✅ 词典同构由类型系统强制（en: Dict）；真实路径切换（设置→外观→English）后导航与出口诊断页全英文渲染正常（test-output/en-exitdiag.png） |
| 深色主题 | ✅ 出口诊断页深色实拍（test-output/dark-exitdiag.png），采样亮度 26.2（正确深色；浅色对照 244.9+）；新组件全部使用 CSS 变量 |
| 1280×800 布局 | 截图窗口 1280×820 实拍通过；表格在窄窗口横向滚动（.diag-table-wrap overflow-x） |

## 五、打包验证（真实产物）

- `npm run dist`（electron-builder 26.15.3，npmmirror 镜像）：
  - `release/IP-Insight-0.2.3-Setup.exe`
  - `release/IP-Insight-Portable.zip`
  - `release/latest.yml`（version 0.2.3）
  - `release/SHA256SUMS.txt`（**仅含 0.2.3 产物**；磁盘上 0.2.2 旧产物保留、列为「未纳入清单」，未删除）

## 六、受环境限制未验证（如实说明）

1. **Sukka 页面 IPv6-only 成功样例**：本环境 ip.skk.moe 被 Cloudflare 挑战拦截，无法实测「仅 IPv6 成功」的页面提取；逻辑已实现并有代码级核对。
2. **双请求 AI 竞态**（生成中切换记录后旧片段到达）：实现为 reqId 过滤，未做真实双 AI 并发注入实测。
4. **本目录打包**：本验证基于 0.2.2 已验证的打包链路 + finalize 新逻辑（版本过滤在 0.2.3 打包时实际生效，见第五节）。
5. **多出口策略路由（/multi）**：与 0.2.2 相同，未实现（不可在不调用内部接口的前提下可控实现）。
