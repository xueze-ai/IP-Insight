# 截图清单与生成方法（v0.2.3）

> 所有截图来自 **Demo 模式**（`npm run preview:web` 的浏览器预览，Electron 加载 `http://127.0.0.1:4173`）。
> 样例数据全部使用 RFC 5737 / RFC 3849 文档保留地址（203.0.113.x / 198.51.100.x / 192.0.2.x / 2001:db8::），顶栏带 Demo 徽标。
> 生成脚本：`scripts/capture-demo.cjs`（**逐张断言**：导航 / 按钮找不到、页面缺少关键文案、PNG 过小都会报错退出，绝不静默保存错图）。

## 生成与校验

```bash
npm run build
node scripts/capture-demo.cjs      # 生成 docs/images/*.png（13 张）
node scripts/check-shots.cjs       # 采样像素亮度复核（浅色主题 ≈ 240+）
```

脚本固定流程：强制浅色主题 + 中文 → 逐页导航 → 需要数据的页面先跑 Demo 检测 → 每张截图前校验页面包含预期关键文案。

## 清单

| 文件 | 用途 | 场景 | 截图前断言 |
| --- | --- | --- | --- |
| `01-dashboard.png` | README「综合检测」 | Demo 综合检测完成后的首页摘要 | 页面含「检测完成」 |
| `02-multisource.png` | README「多源结果与一致性」 | 首页展开「查看完整检测结果」 | 页面含「多源一致性」 |
| `03-network-quality.png` | README「网络质量」 | 网络质量页（新顺序：测速→全球节点→可达性→服务状态） | 页面含「服务可用性」 |
| `04-exitdiag-overview.png` | README「网络出口诊断」页首 | 出口诊断独立页（标题 / 一键检测 / 概览 / 四标签） | 页面含「本轮概况」 |
| `05-exitdiag-split.png` | README「网站分流测试」 | 默认标签，跑完一次全部检测后的分流表格 | 页面含「网站分流测试」 |
| `06-exitdiag-publicip.png` | README「本机公网 IP」 | 切到本机公网 IP 标签 | 页面含「观测点」 |
| `07-exitdiag-cdn.png` | README「CDN 命中节点」 | 切到 CDN 标签（原始节点 / 缓存信号列） | 页面含「原始节点标识」 |
| `08-exitdiag-dns.png` | README「DNS 出口查询」 | 切到 DNS 标签（系统/公共两组表格） | 页面含「系统配置解析器」 |
| `09-risk.png` | README「风险分析」 | 风险页（口径说明 / 泄露中性条目） | 页面含「综合风险等级」 |
| `10-fingerprint.png` | README「浏览器指纹」 | 指纹页分组摘要 | 页面含「浏览器」分组 |
| `11-ai.png` | README「AI 分析」 | 生成一次 Demo 报告（新结构） | 页面含「结论速览」 |
| `12-history.png` | README「历史记录」 | 历史页展开第一条 | 页面含「检测时间」 |
| `13-settings.png` | README「设置」 | 设置页外观分区 | 页面含「主题模式」 |

## 已修复的历史问题

- 旧版把 8 张缩略图挤在双列表格 → 现在**每个重点功能一张全宽截图**，且「综合检测 vs 多源结果」「指纹 vs AI」不再同图；
- 旧版命令 `npm run preview:web:web` 无效 → 正确命令 `npm run preview:web`；
- 旧截图可能残留深色主题缓存 → 脚本先清 `localStorage['ipi-theme']` 与 `data-theme` 再截图，并新增亮度复核脚本；
- 找不到按钮 / 页面不匹配时旧脚本静默保存空图 → 现在断言失败即退出非零。
