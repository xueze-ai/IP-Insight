# 网鉴 IP Insight v0.2.2 · 网络出口诊断

> Network Exit Diagnostics — observe the egress your machine actually uses, from independent vantage points.

## ✨ 新增 / What's New

### 🚦 网络出口诊断（网络质量页新分组）

四个紧凑摘要卡 + 点击展开明细与原始证据，一键诊断 / 随时停止：

| 模块 | 内容 |
| --- | --- |
| **本机公网 IP** | Cloudflare 多观测点 trace + 强制 IPv6 直连探测 + ip.skk.moe 页面流程（遇人机验证如实上报，不绕过）；综合检测默认附带轻量查询，可在设置关闭 |
| **网站分流测试** | ChatGPT / Claude / OpenAI API / Discord / GitLab 等官方诊断端点回显出口；国内目标仅记录可达性（不伪造出口）；多出口并排展示，不判异常 |
| **CDN 命中节点** | Cloudflare / Fastly / CloudFront / Bunny / CDN77 / CacheFly / OVH 等 11 个公开端点；节点代码保留原文，不推断城市，无证据不显示 HIT/MISS |
| **DNS 出口查询** | 本机 UDP 直连 6 组解析器 × Google / Akamai 官方诊断 TXT 区；多递归出口完整保留；与 HTTP 出口不同 ≠ DNS 泄露 |

全部端点已于 2026-10 以真实请求核验，来源如实标注、不冒充 Sukka 数据——详见 [docs/exit-diagnostics-data-sources.md](https://github.com/xueze-ai/IP-Insight/blob/main/docs/exit-diagnostics-data-sources.md)。

### 📖 专业数据更好懂

- 三层表达：**关键结果 → 简明解释 → 展开依据**；Dashboard 新增「这些字段是什么意思」
- 术语配通俗名与口径：网络服务商（ISP）、网络归属编号（ASN）、VPN / 代理 / Tor「检测源标记」等
- 视觉语义统一：正常=绿 · 有证据风险=红 · 分歧=橙 · 未测得/取消/不支持=中性

### 🔧 修复与改进

- 「未检测到泄露」不再标红（结构化判定，兼容旧历史）；未测试 / 取消 / 不支持显示中性状态
- 主出口按「覆盖源最多 → 源顺序」稳定选取，不随并行请求返回顺序漂移
- 历史保留失败与部分成功来源；出口诊断随快照保存；四种导出（HTML/PDF/JSON/TXT）均含诊断章节
- AI 报告改为「能确认 / 值得注意 / 不能确认 / 下一步」层次，并发送有界诊断事实行
- 中英双语、Demo 模式（覆盖多出口 / IPv6 未测得 / 部分失败形态）同步更新

完整变更见 [CHANGELOG.md](https://github.com/xueze-ai/IP-Insight/blob/main/CHANGELOG.md)。

## 📦 下载 / Downloads

| 文件 | 说明 |
| --- | --- |
| `IP-Insight-0.2.2-Setup.exe` | Windows 安装包（NSIS，x64） |
| `IP-Insight-Portable.zip` | 便携版，解压运行 `IP-Insight.exe` |
| `SHA256SUMS.txt` | 完整性校验：`certutil -hashfile <文件> SHA256` |
| `latest.yml` / `*.blockmap` | 自动更新元数据 |

> 未签名应用首次运行如遇 SmartScreen：「更多信息 → 仍要运行」。
> 更新说明：已安装 0.2.0+ 的用户启动后会自动检查更新。

## 🔒 隐私

诊断由本机直接发起并本地保存；观测点仅看到请求出口与诊断目标本身。证据截断脱敏，不保存 Cookie / 授权头 / API Key。详见 [PRIVACY.md](https://github.com/xueze-ai/IP-Insight/blob/main/PRIVACY.md)。

---

**网鉴 · IP Insight** — 让每一次出口 IP 都看得清清楚楚。
Copyright © 2026 薛泽（Xue Ze）· MIT License
