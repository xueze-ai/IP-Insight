# 0.2.2 验证记录（2026-10-24）

> 环境：Windows 10 (26200) x64 · Electron 44.5.1 · Node 22.23.4 · 真实网络（本地系统代理 + 直连双路径）
> 原则：区分「通过 / 失败 / 因环境无法验证」，不将「代码写完」描述为「真实验证通过」。

## 一、静态验证（全部通过）

| 项目 | 结果 |
| --- | --- |
| `npm run typecheck:node` | ✅ 0 错误 |
| `npm run typecheck:web` | ✅ 0 错误 |
| `npm run build` | ✅ 0 错误（main / preload / renderer 三端） |
| 解析单元测试 `node scripts/test-textparse.cjs` | ✅ 13/13（Cloudflare trace、DNS 报文、ECS 网段、截断 IPv6、前导冒号片段等脱敏真实样例） |

## 二、真实采集验证（IPI_AUTO_TEST=diag，非 Demo）

完整四模块真实运行（`test-output/diag.result.json`，多次运行）：

- **publicIp**：两台 Cloudflare 观测点均回显出口（经系统代理 `203.0.113.7`，节点 HKG，HTTP 200）；IPv6 强制直连探测在本机无 AAAA 时返回 `unsupported`（中性「未取得 IPv6 出口」）；Sukka 页面返回 Cloudflare 人机验证页，如实报告失败原因，不绕过。
- **splitTunnel**：10 项目标 9 项成功——ChatGPT 出口 IPv6 `2001:db8:2686:…`（NRT）、Claude 出口 IPv6（LAX）、OpenAI API `198.51.100.131`（NRT）、GitLab 与基线同出口；百度 / 网易云 / Bilibili 记录可达性（无出口回显，如实说明）；Discord 一次返回异常页（如实记「响应中无 ip 字段」）。
- **cdnNode**：11/11 成功，节点代码全部来自响应头 / trace 原文（Cloudflare HKG、Fastly HKG、CloudFront HKG、Bunny HK1/SG1、CDN77 hongkongHK、CacheFly HKG1、OVH bhs）；jsDelivr / Zenlayer 无 PoP 信号头，仅记可达性。
- **dnsExit**：12 项探测 10 项成功，观察到 4 个递归出口（AliDNS `192.0.2.31/32`、DNSPod `198.51.100.30`、114DNS IPv6 `2001:db8:a18:…`、Cloudflare `198.51.100.11` 等）；系统解析器超时 2 项、ECS 截断 2 项（不出猜测 IP，证据保留）。
- 无 IPv6 不影响 IPv4 完成或其它模块；单项 403 / 超时 / 解析失败只影响该项。

## 三、集成验证（真实 Electron 窗口，非模拟）

| 钩子 | 覆盖 | 结果 |
| --- | --- | --- |
| `IPI_UI_VERIFY=1` | 综合检测全流程（四源真实采集 4/4 成功）、多源摘要、IP 信息页 | ✅（截图 test-output/ui-*.png） |
| `IPI_UI_VERIFY_EXIT=1` | 网络质量页 → 出口诊断 → 一键诊断（真实 IPC + 采集，30s 完成 32/36 项）→ 展开明细与证据 → 截图 | ✅ |
| `IPI_UI_VERIFY_HIST=1` | 检测 → 历史写入（含失败源与出口诊断摘要、runId）→ 历史页渲染 → 载入分析页（显示「当前查看：历史记录」横幅）→ 四格式导出（均含出口诊断章节）→ AI 回写往返 | ✅ |
| `IPI_UI_VERIFY_RISK=1` | 风险页渲染：计算值说明、口径标注、分歧标注、ChatGPT 出口独立、泄露中性条目 | ✅ |
| `IPI_UI_VERIFY_SETTINGS=1` | 设置往返、AI 未配置真实报错路径、AI 提供商当前项置顶 | ✅ |
| `IPI_UI_VERIFY_FP=1` | 指纹页分组摘要 + 详细展开（真实 GPU / 字体 / 音频指纹；DNS/WebRTC 泄露真实结果） | ✅ |
| Demo 预览 | `npm run preview:web` HTTP 200，mock 含出口诊断四类样例 | ✅ |

## 四、修复项验证

- 「未检测到泄露」不再标红（结构化 verdict；截图确认 Dashboard 泄露行色彩语义）。
- 主出口稳定：并行检测下主出口按「覆盖源最多 → 源顺序」选取（代码路径 + 真实运行核对）。
- 历史保留失败源：真实运行中失败源的名称 / 耗时 / 真实错误入档并在历史页可见。
- 迟到结果隔离：停止 / 重跑 / 载入历史后 epoch 与 runId 双重过滤（代码路径 + 运行中再次启动验证）。
- 「四源」写死改为 `{ok}/{total}` 动态计数（截图确认「4/4 数据源成功」）。

## 五、打包验证（真实产物）

- `npm run dist`（electron-builder 26.15.3，npmmirror 镜像）成功：
  - `release/IP-Insight-0.2.2-Setup.exe`（NSIS 安装包，120,959,437 字节）
  - `release/IP-Insight-Portable.zip`（便携包，163,951,204 字节）
  - `release/latest.yml`（自动更新元数据，version 0.2.2）
  - `release/SHA256SUMS.txt`（SHA256 独立复算一致：`5dc2a408…` / `366848f3…`）

## 六、因环境无法验证 / 外部限制（如实说明）

1. **ip.skk.moe 页面提取**：本环境出口 IP 被 Cloudflare 人机验证拦截，真实提取流程未能走通；应用行为为如实报告失败原因（已验证该路径）。住宅网络或已通过验证的环境下预期可用（与其余「隐藏页面 + 页面自身流程」Adapter 同机制）。
2. **Sukka 内部分流 / CDN / DNS 内部接口**：未开源且作者明确反对复用，按合规约束不调用、不猜测；四项诊断以本应用自己的公开端点探测实现并如实标注来源（见 docs/exit-diagnostics-data-sources.md）。
3. **PDF 视觉细节**：PDF 由同一 HTML printToPDF 生成（已加 word-break 与横向滚动容器）；已确认文件生成且尺寸合理，逐页视觉检查因无 PDF 渲染校对工具未逐项人工过目。
4. **多出口策略路由（/multi）**：无法在不调用 Sukka 内部接口的前提下以可控请求规模实现，0.2.2 未实现（入口未上线，无占位卡）。
