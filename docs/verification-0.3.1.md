# 0.3.1 验证记录

日期：2026-11-12
基线：`v0.2.3`（commit `38a7df9`）
环境：Linux（Ubuntu 容器，Node v22.23.2 / npm 10.9.8 / Electron 44.5.1）+ xvfb 虚拟显示（1440×960×24）；**未在 Windows 实机运行**（见文末「未验证项」）。
网络：容器可以访问 Cloudflare / ip-api / GitHub 等公开端点，但部分 HTTPS 站点被中间设备替换证书（`ERR_CERT_AUTHORITY_INVALID`）。

## 一、静态检查与构建

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 主进程类型检查 | `npm run typecheck:node` | **通过**，0 error |
| 渲染进程类型检查 | `npm run typecheck:web` | **通过**，0 error |
| 打包构建 | `npm run build` | **通过**，`out/main`、`out/preload`、`out/renderer` 全部产出；renderer 主包 ≈ 1.18 MB |
| 版本号 | `package.json` / `package-lock.json` | 均为 `0.3.1` |

## 二、界面实测（真实窗口，非 Demo）

启动方式：`node_modules/electron/dist/electron . --no-sandbox`，`DISPLAY=:100`。截图工具 ImageMagick `import -window root`，窗口 1280×820。

| 场景 | 操作 | 结果 |
| --- | --- | --- |
| 导航新增项 | 左侧一级导航 | 「网站眼里的你」位于「浏览器指纹」之后，图标为眼睛，路由 `whoAmI`，默认页仍为「综合检测」 |
| 概览标签 | 读完 157 项 | 一句话结论、暴露等级 C、地址与网络 / 设备与环境两栏、指纹稳定性 7/7、OpenRTB 预览均正常渲染（`docs/images/14-whoami-overview.png`） |
| 全部探测项 | 切标签 | 分组计数 28+8+15+28+47+27+4=157；实测值正常（出口 IP 14.103.216.78、AS137718、坐标、时区、IP 类型等），读不到的项显示「本次读不到」并给原因（`15-whoami-probes.png`） |
| 伪装检测 | 切标签 | 冲突条目按证据分级；目标地区模拟（香港）显示 5 项中 2 项对得上，逐项给改法（`16-whoami-disguise.png`） |
| 网络诊断 | 点「运行诊断」 | 8 项全部返回：本机地址 / DNS 服务器 / 域名解析 37 ms ×3 / Cloudflare 39 ms / GitHub 35 ms / 百度 35 ms / HTTP 延迟 417·210·213 ms / MTU 缺 netsh（Linux 预期）（`17-whoami-diagnose.png`） |
| CDN 雷达 | 点「开始探测」 | 10 个端点并发返回；Cloudflare 命中 LAX 297 ms 成功；其余因容器证书被替换返回失败并标注（`18-whoami-radar.png`） |
| 路由追踪 | 点「开始追踪」 | Linux 无 `tracert` → 界面显示「spawn tracert ENOENT」，未崩溃、未卡住（错误如实呈现） |
| 深色主题 | 顶部主题按钮切换 | 页面、卡片、表格、状态点对比度正常，无残留白底 |
| 加载态 | 进入页面立即截图 | 概览在读数完成前显示加载占位，不再提前给出错误等级或空值结论 |

## 三、逻辑单测（直接调用主进程函数）

用 esbuild 打包 `src/main/whoami/tools.ts` 后在 Electron 主进程内调用（绕过 UI，验证真实测量逻辑）：

- `diagnose()` → `ok=true`，8 项检查齐全，值/备注字段完整（此前发现的 `detail` 字段名不一致问题已确认不存在，实际字段为 `value` / `note`）。
- `cdnRadar()` → `ok=true`，10 条 entry，含 `node`（Cloudflare LAX）、`ms`、`status`、失败时的 `error`。
- `parseTracert` 解析 Windows 输出格式（样例文本）——仅文本解析，实际命令未在 Windows 运行。

## 四、本版修复的缺陷（均在实测中发现）

1. **显卡误判**：`/检测到/.test('未检测到虚拟显卡特征')` 命中，正常机器被判「值得注意」→ 改为只认以「检测到」开头的结论。
2. **空值文案**：未取到出口归属时输出「IP 落在 。」→ 改为明确说明「本次没有取到出口 IP 归属，只能读到本机这一侧」；字体/Canvas 缺失时不再输出半截句子。
3. **WebGL 不可用**：显卡被写成「无」→ 改为留空 + 「WebGL 不可用（GPU 被禁用或环境没有显卡）」，伪装检测对应项降为「说明」。
4. **加载态误导**：读数未完成时已显示 A 级与半空结论 → 概览在完成前只显示加载占位。
5. **雷达/诊断可读性**：节点列不再直接塞 `net::ERR_CERT_...`，改为「失败」+ 悬浮显示原因；成功行显示 `节点 · 缓存`；MTU 的 `spawn netsh ENOENT` 改为「这台机器没有 netsh（网卡 MTU 仅 Windows 支持）」。
6. **快捷键重复**：「IP 质量」与「风险分析」都跳同一页 → 第四项改为「浏览器指纹」。

## 五、未验证项（明确未做，不是已通过）

| 项 | 原因 |
| --- | --- |
| Windows 实机全流程 | 本环境为 Linux；`tracert`、`netsh` 只在 Windows 存在，必须在 Windows 上复测 |
| Windows 安装包 / 便携包 | electron-builder 交叉打包需要 wine，本环境没有；`npm run dist` 未执行 |
| 真实代理 / VPN 环境下的伪装检测 | 测试容器本身是机房网络，无法构造家宽 + 代理组合 |
| 与「浏览器指纹」「网络出口诊断」页的数据联动 | 本版未做（页面底部与 README 已写明） |
| 英文界面截图 | 仅代码层面确认文案齐全，未逐页截图核对 |

## 六、复现命令

```bash
npm ci
npm run typecheck:node && npm run typecheck:web
npm run build

# 真实窗口（需要 X 显示；Windows 直接双击 out/main/index.js 也可）
DISPLAY=:100 node_modules/electron/dist/electron . --no-sandbox
```

截图：`import -window root shot.png`（ImageMagick），窗口按 `xwininfo -root -children` 定位。
