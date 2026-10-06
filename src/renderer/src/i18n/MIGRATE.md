# i18n 迁移规范（给迁移 agent 看）

## 目标
把指定文件里**所有用户可见的中文文案**迁到字典，页面渲染时用 `t()` 取值。
**不要改任何样式、布局、className、逻辑**，只替换文案。

## 字典位置
- 中文：`src/renderer/src/i18n/dict/zh/<模块>.ts`，格式：
  ```ts
  export const zhNetwork = {
    title: '网络质量',
    startSpeedtest: '开始测速',
    nodeCount: '共 {n} 个节点',
  } as const
  ```
- 英文：`src/renderer/src/i18n/dict/en/<模块>.ts`，格式：
  ```ts
  import type { zhNetwork } from '../zh/network'
  export const enNetwork: typeof zhNetwork = {
    title: 'Network Quality',
    startSpeedtest: 'Start speed test',
    nodeCount: '{n} nodes in total',
  }
  ```
  英文必须与中文**同构**（key 一一对应），否则编译报错。
- 模块名 → 字典变量名：`network`→`zhNetwork`/`enNetwork`，`risk`→`zhRisk`/`enRisk`，
  `fingerprint`→`zhFingerprint`，`ai`→`zhAi`，`history`→`zhHistory`，
  `dashboard`→`zhDashboard`，`ipinfo`→`zhIpinfo`，`settings`→`zhSettings`，
  `components`→`zhComponents`，`misc`→`zhMisc`。
- **不要动** `i18n/zh.ts` / `i18n/en.ts` / `i18n/index.ts`（由主 agent 最后统一接入）。

## 组件内用法
```tsx
import { useLang } from '../i18n'   // 路径按文件深度调整

export function Foo(): JSX.Element {
  const { t } = useLang()
  return (
    <div>
      <h1>{t('network.title')}</h1>
      <p>{t('network.nodeCount', { n: 20 })}</p>
      <button aria-label={t('network.startSpeedtest')}>{t('network.startSpeedtest')}</button>
      <input placeholder={t('network.searchPh')} />
    </div>
  )
}
```
- key 写法：`<模块>.<分组>.<名字>`，如 `t('risk.vpn.title')`。**写错 key 编译报错**，注意拼写。
- 变量插值：字典里写 `{n}` 占位符，调用时传参。不要在组件里做字符串拼接（如 `'共' + n + '个'`）。
- JSX 里混排（如 `<b>粗体</b>普通`）：拆成两个 key，结构保留。
- 三元/条件文案：每个分支各一个 key。
- **复用 common**：导航（`t('common.nav.dashboard')` 等）、通用按钮（`t('common.action.copy')` 等）
  已在 `dict/zh/common.ts`，不要重复建 key。
- 动态英文专有名词（如 'Cloudflare'、'DNS'、'IPv6'、品牌名）**不要翻译**，保持原文。
- 时间/数字格式保持原逻辑，只翻译 surrounding 文案。

## 非组件（utils / stores / hooks 返回字符串处）
```ts
import { tt } from '../i18n'   // 路径按深度调整
tt('misc.speedtestDone')
```
hooks 组件内优先用 `useLang()` 的 `t`；模块顶层纯函数用 `tt`。

## 不要翻译的内容
- 代码注释、console 日志（`[TAG]` 调试日志）、CSS 类名
- Demo 样例数据里的长 AI 报告正文（DEMO_AI 那种整段 mock 文本）
- URL、API 参数、枚举值

## 完成后
不要跑 typecheck（主 agent 最后统一跑）。确保：无遗留中文可见文案、无样式改动、
字典中英同构。
