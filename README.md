<div align="center">

<img src="resources/Logo.png" width="96" alt="网鉴 Logo" />

# 网鉴 · IP Insight

**多网站检测聚合 + 数据提取 + AI 综合分析的 IP 网络环境检测助手（Windows 桌面软件）**

[简体中文](README.md) · [English](README_EN.md)

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-44-47848F.svg)

版权所有 © 2026 [薛泽（Xue Ze）](https://github.com/xueze-ai)

</div>

---

## 效果预览

| 综合检测（多源摘要） | 多源结果与一致性 |
| :---: | :---: |
| ![综合检测](docs/images/01-dashboard.png) | ![多源结果](docs/images/02-multisource.png) |
| **网络质量（测速 / 全球节点 / 服务可用性 / 可达性）** | **风险分析（威胁情报 / 代理匿名 / 原生性）** |
| ![网络质量](docs/images/03-network.png) | ![风险分析](docs/images/04-risk.png) |
| **浏览器指纹（五组分类 + 详细展开）** | **AI 综合分析（流式报告）** |
| ![浏览器指纹](docs/images/05-fingerprint.png) | ![AI 分析](docs/images/06-ai.png) |
| **历史记录（按日分组 / 载入复看 / 导出）** | **设置（AI 提供商 / 外观 / 检测 / 隐私）** |
| ![历史记录](docs/images/07-history.png) | ![设置](docs/images/08-settings.png) |

> 以上截图来自内置 **Demo 模式**（浏览器预览，样例数据使用 RFC 5737 文档保留地址），`npm install && npm run build && npm run preview:web:web` 后打开提示的地址即可体验，无需 Electron 环境。

---

## 它是什么

网鉴（IP Insight）把你的公网 IP 放到**多个独立检测源**下同时「体检」：自动打开检测网站、等待页面 JavaScript 真实执行、提取结果、统一成同一套数据模型，再做**多源交叉验证**与 **AI 综合分析**，最后给你一份可读、可导出、可回溯的报告。

它**不内置任何 IP 库 / 威胁情报库 / GeoIP 库**——所有结论都来自检测站点的实时页面与接口，以及你本机的真实测量。

### 亮点

- 🌐 **四源聚合**：Ping0、Net.Coffee、Net.Coffee GPT、IPPure，单源失败互不影响
- 🔎 **多源交叉验证**：一致打 ✓、冲突标 ⚠ 并逐源列出，**不替你做单一结论**
- 🧠 **AI 综合分析**：通义千问 / DeepSeek / 豆包 / OpenAI / **Ollama 本地** / 智谱 / Moonshot / 硅基流动 / 自定义，流式输出、截断自动续写
- ⚡ **本机实测**：Cloudflare 官方引擎测速、20 节点全球延迟、31 个主流服务可用性、10 站点可达性（隐藏浏览器真实网络栈）
- 🖐 **浏览器指纹**：Canvas / WebGL / 音频 / 字体 / 综合指纹 ID + 时区一致性 + DNS / WebRTC 泄露
- 🗂 **历史记录与报告导出**：HTML / PDF / JSON / TXT，落款可署名
- 🎨 **Material 3 风格桌面 UI**：浅色 / 深色 / 跟随系统，简体中文界面
- 🧪 **Demo 模式**：浏览器直接预览全部界面（样例数据），开源透明

## 工作原理

```
点击「开始综合检测」
        │
        ▼
Electron 主进程为每个数据源创建隐藏 Chromium 窗口
        │  加载真实网页 → 等待 JS 执行 → 调用站点前端自身使用的
        │  公开 JSON 接口 / 读取 DOM → 提取 → 标准化
        ▼
NormalizedIPResult 统一数据模型（src/shared/types.ts）
        │
        ▼
按出口 IP 分组 → 字段共识 / 冲突标注 → 九页 UI 消费
        │
        ├─→ AI 分析（OpenAI 兼容协议，SSE 流式）
        ├─→ 历史记录（userData/history.json）
        └─→ 报告导出（HTML / PDF / JSON / TXT）
```

**合规边界**：仅正常浏览器访问、读取用户可见内容、调用站点前端自身使用的公开接口；不破解验证码、不绕过 Cloudflare 挑战 / 登录 / 访问控制、不伪造请求；出现人机验证时提示「该数据源需要人工验证 / 暂不可自动获取」。

**数据诚实性**：拿不到的字段保持空值并显示「— / 未测得 / 无数据 / 无法判断」；多源冲突显示「多源存在分歧」并逐源列出。

## 快速开始

### 方式 A：下载发行版
到 Releases 下载：
- `IP-Insight-<版本>-Setup.exe`：NSIS 安装包
- `IP-Insight-Portable.zip`：便携版，解压后双击 `IP-Insight.exe`
- `SHA256SUMS.txt`：校验文件，用 `certutil -hashfile <文件名> SHA256`（Windows）比对哈希值，确认下载完整未被篡改

无需安装 Node / Python 等任何开发环境。未签名应用首次运行如出现 SmartScreen 提示：「更多信息 → 仍要运行」。免费的代码签名路线见 `docs/code-signing.md`，也可用 `winget install xueze-ai.IP-Insight` 安装（见 `winget/README.md`）。

### 方式 B：源码自编译
```bash
git clone https://github.com/xueze-ai/IP-Insight.git
cd IP-Insight
npm install

npm run dev            # 开发模式（Electron）
npm run build          # 三端构建
npm run dist           # Windows 打包：NSIS 安装包 + 便携 zip
```

### 方式 C：浏览器 Demo 预览（无需 Electron）
```bash
npm install && npm run build && npm run preview:web
```
打开终端提示的地址即可浏览全部界面（样例数据，顶栏有 Demo 徽标）。

## 日常使用

1. 首页「开始综合检测」（约 30–60 秒；可设置并行 / 开机自测）
2. 软件更新：启动后自动检查 GitHub Releases，有新版本后台下载，下载完成后在「设置 → 关于 → 软件更新」点「重启并更新」（也可下次退出时自动安装）
3. 各页面查看：IP 信息 / 网络质量 / 风险分析 / 浏览器指纹
4. 设置 → AI 提供商 填写 Key（或本地 Ollama 免 Key）→「测试连接」
5. AI 分析页生成流式报告；检测完成页或历史记录「导出报告」

## AI 配置（含 Ollama）

设置 → AI 提供商，内置 9 家 OpenAI 兼容提供商，可隐藏内置项、无限添加自定义项：

| 提供商 | 默认 Base URL | 默认模型 |
| --- | --- | --- |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| 豆包（火山方舟） | `https://ark.cn-beijing.volces.com/api/v3` | 接入点 ID（ep-…） |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| **Ollama（本地）** | `http://localhost:11434/v1` | `qwen2.5:7b`（**免 Key**） |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-air` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` |
| 自定义 | 自填 | 自填 |

Ollama 用户：本机 `ollama serve` 并 `ollama pull qwen2.5:7b` 后，选择 Ollama、Key 留空即可，数据不出本机。

## 隐私边界与数据位置

| 数据 | 位置 | 说明 |
| --- | --- | --- |
| 设置（含 API Key） | `%AppData%/IP-Insight/settings.json` | 仅本机，不上传 |
| 历史记录 | `%AppData%/IP-Insight/history.json` | 可关闭 / 限天数 / 退出即清 |
| 检测过程 | 内存 | 除历史外不写磁盘 |
| 发送给 AI 的内容 | 标准化检测结果 + 交叉汇总 | 不含 Key、不含本机路径 |

不采集浏览历史、文件、剪贴板等任何与检测无关的数据。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| SmartScreen 拦截 | 未签名所致：「更多信息 → 仍要运行」 |
| 某源「需要人工验证」 | 站点出现人机验证；「查看原网站」手动完成后再检测 |
| 全球节点为「—」 | 先完成一次综合检测（数据来自 Net.Coffee 源） |
| 丢包率「未测得」 | 依赖 WebRTC TURN，网络不可达时不提供该项 |
| AI 连接失败 | 设置中「测试连接」查看服务端真实报错 |
| 可达性与浏览器体验不一致 | 探测走系统代理；仅浏览器插件内的代理不经过探测 |
| 打包下载组件超时 | 用 npmmirror 镜像（见 README_EN / issues） |

## 目录结构

```
├─ src/
│  ├─ main/                  # Electron 主进程
│  │  ├─ index.ts            # 窗口 / IPC / 回归钩子
│  │  ├─ settings.ts         # 设置持久化
│  │  ├─ history.ts          # 历史持久化
│  │  ├─ exportReport.ts     # HTML/PDF/JSON/TXT 报告
│  │  ├─ ai/                 # SSE 流式客户端 / 分析提示词
│  │  └─ providers/          # 每站点一个 Adapter + 隐藏浏览器底座
│  │     ├─ base/ ping0/ netcoffee/ netcoffee-gpt/ ippure/
│  │     ├─ speedtest/       # Cloudflare 官方引擎测速
│  │     └─ localprobe/      # 站点可达性实测
│  ├─ preload/               # contextBridge 最小 API 面
│  ├─ renderer/              # React UI（Material 3 设计系统）
│  │  ├─ src/pages/          # 九个页面
│  │  ├─ src/demo/mock.ts    # 浏览器 Demo 模式样例 API
│  │  ├─ src/state/          # DetectionContext / speedtest / ai / nav stores
│  │  └─ src/utils/          # 多源共识 / 报告模型
│  └─ shared/                # 统一数据模型 / AI 提供商元数据
├─ resources/Logo.png        # 应用图标
├─ docs/images/              # 效果预览截图
└─ scripts/                  # 打包收尾脚本
```

## 贡献

欢迎 Issue / PR：
1. Fork 并创建特性分支 `feat/xxx` 或修复分支 `fix/xxx`
2. 保持「每站点一个 Adapter」「统一数据模型」「不伪造数据」三条架构约束
3. `npm run typecheck:web && npm run typecheck:node && npm run build` 通过后提交
4. PR 描述中说明动机、改动面与验证方式

行为准则：友好、就事论事；尊重数据源的 robots 与服务条款。

## 许可证

采用 [MIT License](LICENSE)：可免费使用、修改、分发、商用，**唯一条件是保留版权声明（Copyright © 2026 薛泽 Xue Ze）**。
分发或二次发布时请同时保留软件内「关于」页的作者与仓库信息。

## 更新日志

### 0.2.1

- **英文界面**：设置 → 外观 → 界面语言，一键切换中 / English；AI 分析、场景询问、导出报告跟随界面语言
- **AI 场景询问**：AI 分析页新增「场景咨询」，点场景（看 Netflix / 打游戏 / 用 ChatGPT / 跨境电商）或直接提问，AI 结合本次检测数据回答「行不行、差在哪、换什么节点」
- AI 提供商名称 / 介绍支持英文显示
- 修复缺陷，版本号定为 0.2.1

### 0.2.0

- **自动更新**：启动后自动检查 GitHub Releases，有新版本后台静默下载，下载完成后提示重启更新（设置 → 关于 → 软件更新，可开关、可手动检查）
- **发布产物附 SHA256SUMS.txt**：可在下载后校验安装包完整性
- 新增 `PRIVACY.md` 隐私政策、`docs/code-signing.md` 免费代码签名路线图、`winget/` WinGet 上架文件

### 0.1.0（2026-10-05）
首个完整版本：四源 Adapter 与统一数据模型、多源交叉分析、九页 Material 3 中文 UI、本机测速 / 全球节点 / 服务可用性 / 可达性、浏览器指纹五组分类、AI 流式分析（9 提供商 + 自定义 + Ollama）、设置持久化、历史记录、四格式报告导出、NSIS 安装包与便携包、浏览器 Demo 预览模式。

---

<div align="center">

**网鉴 · IP Insight** — 让每一次出口 IP 都看得清清楚楚。

Copyright © 2026 [薛泽（Xue Ze）](https://github.com/xueze-ai) · MIT License

</div>
