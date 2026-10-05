import {
  Activity,
  Bot,
  Box,
  Brain,
  ChevronDown,
  Cloud,
  Coffee,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Trash2,
  Zap
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type {
  AiProviderConfig,
  AiTestResponse,
  AppSettings
} from '@shared/types'
import { AI_PROVIDER_META } from '@shared/aiProviders'
import { useTheme } from '../hooks/useTheme'

// =============================================================
// 设置页
// 分区：外观 / AI 提供商 / 检测 / 数据与隐私 / 关于
// 持久化到主进程 userData/settings.json；外观与检测设置即时联动其他页面。
// =============================================================

type Section = 'appearance' | 'ai' | 'detection' | 'privacy' | 'about'

const SECTIONS: { id: Section; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'ai', label: 'AI 提供商', icon: Bot },
  { id: 'detection', label: '检测', icon: Activity },
  { id: 'privacy', label: '数据与隐私', icon: Database },
  { id: 'about', label: '关于', icon: Info }
]

const PROVIDER_ICON: Record<string, typeof Bot> = {
  qwen: Cloud,
  deepseek: Zap,
  doubao: Coffee,
  openai: Bot,
  ollama: Box,
  zhipu: Brain,
  moonshot: Moon,
  siliconflow: Cpu,
  custom: SlidersHorizontal
}

interface ProviderItem {
  id: string
  name: string
  desc: string
  tag?: string
  defaultBaseUrl: string
  defaultModel: string
  modelHint: string
  isCustom: boolean
}

const DATA_SOURCES: { name: string; url: string }[] = [
  { name: 'Ping0', url: 'https://ping0.cc/' },
  { name: 'Net.Coffee 主页', url: 'https://ip.net.coffee/' },
  { name: 'Net.Coffee IP 评分', url: 'https://ip.net.coffee/ip/' },
  { name: 'Net.Coffee GPT 检测', url: 'https://ip.net.coffee/gpt/' },
  { name: 'Net.Coffee 全球 Ping', url: 'https://ip.net.coffee/ping/' },
  { name: 'Net.Coffee 服务状态', url: 'https://ip.net.coffee/status/' },
  { name: 'IPPure', url: 'https://ippure.com/' },
  { name: 'Cloudflare Speedtest', url: 'https://speed.cloudflare.com/' }
]

function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}): JSX.Element {
  return (
    <button
      className={'switch' + (checked ? ' on' : '')}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  )
}

function Row({
  title,
  desc,
  children
}: {
  title: string
  desc?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="set-row">
      <div style={{ minWidth: 0 }}>
        <div className="title" style={{ fontSize: 13.5 }}>{title}</div>
        {desc && (
          <p className="caption" style={{ marginTop: 3, lineHeight: 1.6 }}>{desc}</p>
        )}
      </div>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

export function Settings({
  initialSection = 'appearance'
}: {
  initialSection?: Section
}): JSX.Element {
  const [section, setSection] = useState<Section>(initialSection)
  const [local, setLocal] = useState<AppSettings | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [testState, setTestState] = useState<
    Record<string, { loading?: boolean; result?: AiTestResponse }>
  >({})
  const [version, setVersion] = useState('')
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setSection(initialSection)
  }, [initialSection])

  useEffect(() => {
    let on = true
    window.ipInsight
      .getSettings()
      .then((r) => {
        if (on) setLocal(r.settings)
      })
      .catch(() => undefined)
    window.ipInsight
      .appVersion()
      .then((v) => {
        if (on) setVersion(v)
      })
      .catch(() => undefined)
    return () => {
      on = false
    }
  }, [])

  if (!local) {
    return (
      <div className="page" style={{ paddingTop: 60 }}>
        <div className="skeleton" style={{ height: 24, width: 160 }} />
        <div className="skeleton" style={{ height: 200, marginTop: 20 }} />
      </div>
    )
  }

  const commit = (next: AppSettings): void => {
    setLocal(next)
    void window.ipInsight.setSettings(next).catch(() => undefined)
  }

  const providerList: ProviderItem[] = [
    ...AI_PROVIDER_META.filter((m) => !local.ai.hiddenProviders.includes(m.id)).map(
      (m) => ({ ...m, isCustom: false })
    ),
    ...Object.entries(local.ai.customProviders ?? {}).map(([id, c]) => ({
      id,
      name: c.name || id,
      desc: '自定义 OpenAI 兼容提供商',
      tag: '自定义',
      defaultBaseUrl: '',
      defaultModel: '',
      modelHint: '自行填写 Base URL 与模型名',
      isCustom: true
    }))
  ]

  const providerCfg = (id: string): (AiProviderConfig & { name?: string }) | undefined =>
    (local.ai.providers as Record<string, AiProviderConfig>)[id] ??
    local.ai.customProviders?.[id]

  const setProvider = (id: string, patch: Partial<AiProviderConfig & { name: string }>): void => {
    if (local.ai.customProviders?.[id]) {
      const cur = local.ai.customProviders[id]
      const nextCfg = { ...cur, ...patch }
      commit({
        ...local,
        ai: {
          ...local.ai,
          customProviders: { ...local.ai.customProviders, [id]: nextCfg }
        }
      })
    } else {
      const cur = (local.ai.providers as Record<string, AiProviderConfig>)[id]
      const nextCfg = { ...cur, ...patch }
      commit({
        ...local,
        ai: {
          ...local.ai,
          providers: { ...local.ai.providers, [id]: nextCfg } as AppSettings['ai']['providers']
        }
      })
    }
  }

  const testProvider = async (id: string): Promise<void> => {
    setTestState((s) => ({ ...s, [id]: { loading: true } }))
    const r = await window.ipInsight.testAi(id)
    setTestState((s) => ({ ...s, [id]: { loading: false, result: r } }))
  }

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">Settings · 偏好设置</span>
      <h1 className="h1" style={{ marginTop: 6 }}>设置</h1>

      <div className="set-cols" style={{ marginTop: 24 }}>
        {/* ---------- 左：分区导航 ---------- */}
        <nav className="set-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={'set-nav-item' + (section === s.id ? ' active' : '')}
              onClick={() => setSection(s.id)}
            >
              <s.icon size={16} strokeWidth={1.9} />
              {s.label}
            </button>
          ))}
        </nav>

        {/* ---------- 右：内容 ---------- */}
        <div style={{ minWidth: 0 }}>
          {section === 'appearance' && (
            <div className="card">
              <div className="card-eyebrow" style={{ marginBottom: 8 }}>外观</div>
              <Row title="主题模式" desc="浅色 / 深色 / 跟随系统；顶栏按钮可快速切换浅深。">
                <div style={{ display: 'flex', gap: 6 }}>
                  {(
                    [
                      { v: 'light', label: '浅色', icon: Sun },
                      { v: 'dark', label: '深色', icon: Moon },
                      { v: 'system', label: '跟随系统', icon: Monitor }
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      className={'btn btn-sm ' + (theme === o.v ? 'btn-tonal' : 'btn-ghost')}
                      onClick={() => setTheme(o.v)}
                    >
                      <o.icon size={14} /> {o.label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row
                title="默认折叠侧边栏"
                desc="下次启动时侧边栏以折叠状态开始（本次会话可用顶栏按钮随时切换）。"
              >
                <Switch
                  checked={local.appearance.sidebarCollapsedByDefault}
                  label="默认折叠侧边栏"
                  onChange={(v) =>
                    commit({
                      ...local,
                      appearance: { ...local.appearance, sidebarCollapsedByDefault: v }
                    })
                  }
                />
              </Row>
              <Row title="界面字号" desc="标准 14px / 大 15.5px，即时生效。">
                <div style={{ display: 'flex', gap: 6 }}>
                  {(
                    [
                      { v: 'standard', label: '标准' },
                      { v: 'large', label: '大' }
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      className={
                        'btn btn-sm ' +
                        (local.appearance.fontSize === o.v ? 'btn-tonal' : 'btn-ghost')
                      }
                      onClick={() => {
                        commit({
                          ...local,
                          appearance: { ...local.appearance, fontSize: o.v }
                        })
                        document.documentElement.style.fontSize =
                          o.v === 'large' ? '15.5px' : ''
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Row>
            </div>
          )}

          {section === 'ai' && (
            <>
              <div className="card">
                <div className="card-head" style={{ marginBottom: 8 }}>
                  <div className="card-eyebrow">AI 提供商</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const id = `custom-${Date.now().toString(36)}`
                      const next = {
                        ...local,
                        ai: {
                          ...local.ai,
                          customProviders: {
                            ...local.ai.customProviders,
                            [id]: { name: `自定义 ${Object.keys(local.ai.customProviders ?? {}).length + 1}`, apiKey: '', baseUrl: '', model: '' }
                          }
                        }
                      }
                      commit(next)
                      setExpanded(id)
                    }}
                  >
                    + 添加自定义提供商
                  </button>
                </div>
                <p className="caption" style={{ lineHeight: 1.7, marginBottom: 12 }}>
                  所有提供商均通过 OpenAI 兼容接口调用；API Key 仅保存在本机
                  settings.json，不会上传到任何第三方。分析时只发送标准化检测数据。
                  内置提供商可隐藏，自定义提供商可删除。
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {providerList.map((m) => {
                    const cfg = providerCfg(m.id)
                    const isCurrent = local.ai.current === m.id
                    const isOpen = expanded === m.id
                    const Icon = PROVIDER_ICON[m.id] ?? SlidersHorizontal
                    const ts = testState[m.id]
                    return (
                      <div
                        key={m.id}
                        className={'prov-card' + (isCurrent ? ' current' : '')}
                      >
                        <div className="prov-head">
                          <span className="prov-icon">
                            <Icon size={16} />
                          </span>
                          <span className="prov-name">{m.name}</span>
                          {m.tag && <span className="badge badge-info">{m.tag}</span>}
                          {isCurrent && <span className="badge badge-good">使用中</span>}
                          {!isCurrent && cfg?.apiKey.trim() && (
                            <span className="badge badge-neutral">已配置</span>
                          )}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                            {!isCurrent && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  commit({ ...local, ai: { ...local.ai, current: m.id } })
                                }
                              >
                                设为当前
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--bad)' }}
                              title={m.isCustom ? '删除该自定义提供商' : '从列表中隐藏'}
                              onClick={() => {
                                const label = m.isCustom ? '删除' : '隐藏'
                                if (
                                  !window.confirm(
                                    `${label}「${m.name}」？${m.isCustom ? '其配置将被移除。' : '可随时在 README 说明中恢复（重置设置或在隐藏列表中管理）。'}`
                                  )
                                )
                                  return
                                if (m.isCustom) {
                                  const cp = { ...local.ai.customProviders }
                                  delete cp[m.id]
                                  const ai = { ...local.ai, customProviders: cp }
                                  if (local.ai.current === m.id) ai.current = 'qwen'
                                  commit({ ...local, ai })
                                } else {
                                  commit({
                                    ...local,
                                    ai: {
                                      ...local.ai,
                                      hiddenProviders: [...local.ai.hiddenProviders, m.id],
                                      current: local.ai.current === m.id ? 'qwen' : local.ai.current
                                    }
                                  })
                                }
                              }}
                            >
                              <Trash2 size={13} /> {m.isCustom ? '删除' : '隐藏'}
                            </button>
                            <button
                              className="btn-icon"
                              style={{ width: 30, height: 30 }}
                              onClick={() => setExpanded(isOpen ? null : m.id)}
                              title={isOpen ? '收起配置' : '配置'}
                            >
                              <ChevronDown
                                size={16}
                                style={{
                                  transform: isOpen ? 'rotate(180deg)' : undefined,
                                  transition: 'transform var(--dur-fast) var(--ease)'
                                }}
                              />
                            </button>
                          </div>
                        </div>
                        <p className="caption" style={{ marginTop: 6, lineHeight: 1.6 }}>
                          {m.desc}
                        </p>

                        {isOpen && (
                          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {m.isCustom && (
                              <div>
                                <label className="field-label">显示名称</label>
                                <input
                                  className="input"
                                  value={cfg?.name ?? ''}
                                  onChange={(e) => setProvider(m.id, { name: e.target.value })}
                                />
                              </div>
                            )}
                            <div>
                              <label className="field-label">
                                API Key{m.id === 'ollama' ? '（本地 Ollama 可留空）' : ''}
                              </label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  className="input mono"
                                  type={showKey[m.id] ? 'text' : 'password'}
                                  placeholder="粘贴你的 API Key"
                                  value={cfg?.apiKey ?? ''}
                                  onChange={(e) => setProvider(m.id, { apiKey: e.target.value })}
                                  style={{ flex: 1 }}
                                />
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() =>
                                    setShowKey((s) => ({ ...s, [m.id]: !s[m.id] }))
                                  }
                                  title={showKey[m.id] ? '隐藏' : '显示'}
                                >
                                  {showKey[m.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="field-label">Base URL</label>
                              <input
                                className="input mono"
                                value={cfg?.baseUrl ?? ''}
                                placeholder={m.defaultBaseUrl || 'https://…/v1'}
                                onChange={(e) => setProvider(m.id, { baseUrl: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="field-label">模型</label>
                              <input
                                className="input mono"
                                value={cfg?.model ?? ''}
                                placeholder={m.defaultModel || 'model-name'}
                                onChange={(e) => setProvider(m.id, { model: e.target.value })}
                              />
                              <p className="caption" style={{ marginTop: 4 }}>{m.modelHint}</p>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={ts?.loading}
                                onClick={() => void testProvider(m.id)}
                              >
                                <RefreshCw size={14} className={ts?.loading ? 'spin' : undefined} />
                                测试连接
                              </button>
                              {ts?.result &&
                                (ts.result.ok ? (
                                  <span className="badge badge-good">
                                    连接成功 · {ts.result.ms} ms{ts.result.reply ? ` · 回复「${ts.result.reply}」` : ''}
                                  </span>
                                ) : (
                                  <span className="badge badge-bad" title={ts.result.error}>
                                    失败：{(ts.result.error ?? '').slice(0, 60)}
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {local.ai.hiddenProviders.length > 0 && (
                  <p className="caption" style={{ marginTop: 12 }}>
                    已隐藏：{local.ai.hiddenProviders.join('、')}　
                    <button
                      className="btn btn-text"
                      style={{ height: 22, padding: 0 }}
                      onClick={() =>
                        commit({ ...local, ai: { ...local.ai, hiddenProviders: [] } })
                      }
                    >
                      全部恢复
                    </button>
                  </p>
                )}
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-eyebrow" style={{ marginBottom: 8 }}>生成参数</div>
                <Row
                  title="温度 Temperature"
                  desc="越低越稳定克制；分析报告建议 0.2 – 0.5。"
                >
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={local.ai.temperature}
                    onChange={(e) =>
                      commit({
                        ...local,
                        ai: { ...local.ai, temperature: Number(e.target.value) }
                      })
                    }
                    style={{ width: 160 }}
                  />
                  <span className="mono small" style={{ minWidth: 30 }}>
                    {local.ai.temperature.toFixed(1)}
                  </span>
                </Row>
                <Row
                  title="单次最大输出 Token"
                  desc="上限 65536；若仍被模型截断，软件会自动续写直至完成（最多续 3 次）。"
                >
                  <input
                    className="input mono"
                    type="number"
                    min={256}
                    max={65536}
                    step={256}
                    value={local.ai.maxTokens}
                    onChange={(e) =>
                      commit({
                        ...local,
                        ai: {
                          ...local.ai,
                          maxTokens: Math.min(65536, Math.max(256, Number(e.target.value) || 8192))
                        }
                      })
                    }
                    style={{ width: 110 }}
                  />
                </Row>
                <Row
                  title="附加分析要求"
                  desc="追加到 AI 系统提示词末尾，例如「重点评估 TikTok 运营适用性」。"
                >
                  <textarea
                    className="input"
                    style={{ height: 64, width: 300, resize: 'vertical', padding: '8px 12px' }}
                    placeholder="可选"
                    value={local.ai.extraPrompt}
                    onChange={(e) =>
                      commit({ ...local, ai: { ...local.ai, extraPrompt: e.target.value } })
                    }
                  />
                </Row>
              </div>
            </>
          )}

          {section === 'detection' && (
            <div className="card">
              <div className="card-eyebrow" style={{ marginBottom: 8 }}>检测</div>
              <Row
                title="单源超时（秒）"
                desc="综合检测中每个数据源的等待上限；各源内置下限保护（Ping0/IPPure ≥30s、GPT ≥45s、Net.Coffee ≥60s），测速固定 150s 不受此项影响。"
              >
                <input
                  className="input mono"
                  type="number"
                  min={15}
                  max={120}
                  step={5}
                  value={local.detection.timeoutSec}
                  onChange={(e) =>
                    commit({
                      ...local,
                      detection: {
                        ...local.detection,
                        timeoutSec: Math.min(120, Math.max(15, Number(e.target.value) || 40))
                      }
                    })
                  }
                  style={{ width: 110 }}
                />
              </Row>
              <Row
                title="启动时自动综合检测"
                desc="打开软件后自动开始一次综合检测。"
              >
                <Switch
                  checked={local.detection.autoRunOnStart}
                  label="启动时自动综合检测"
                  onChange={(v) =>
                    commit({ ...local, detection: { ...local.detection, autoRunOnStart: v } })
                  }
                />
              </Row>
              <Row
                title="并行检测"
                desc="四个数据源同时检测（约最快单源耗时）；关闭则依次检测（过程更直观）。"
              >
                <Switch
                  checked={local.detection.parallel}
                  label="并行检测"
                  onChange={(v) =>
                    commit({ ...local, detection: { ...local.detection, parallel: v } })
                  }
                />
              </Row>
            </div>
          )}

          {section === 'privacy' && (
            <div className="card">
              <div className="card-eyebrow" style={{ marginBottom: 8 }}>数据与隐私</div>
              <Row
                title="保存历史记录"
                desc="每次检测完成后在本地保存记录（供历史记录页使用）；关闭后不再写入。"
              >
                <Switch
                  checked={local.privacy.historyEnabled}
                  label="保存历史记录"
                  onChange={(v) =>
                    commit({ ...local, privacy: { ...local.privacy, historyEnabled: v } })
                  }
                />
              </Row>
              <Row title="历史保留天数" desc="超期记录在下次写入时自动清理。">
                <input
                  className="input mono"
                  type="number"
                  min={1}
                  max={365}
                  value={local.privacy.historyRetentionDays}
                  onChange={(e) =>
                    commit({
                      ...local,
                      privacy: {
                        ...local.privacy,
                        historyRetentionDays: Math.min(365, Math.max(1, Number(e.target.value) || 30))
                      }
                    })
                  }
                  style={{ width: 110 }}
                />
              </Row>
              <Row
                title="退出时清除历史"
                desc="下次启动时自动清空上一次会话的历史记录（适合共用电脑）。"
              >
                <Switch
                  checked={local.privacy.clearHistoryOnExit}
                  label="退出时清除历史"
                  onChange={(v) =>
                    commit({ ...local, privacy: { ...local.privacy, clearHistoryOnExit: v } })
                  }
                />
              </Row>
              <Row
                title="重置全部设置"
                desc="恢复默认值并清空已保存的 API Key（不可撤销）。"
              >
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--bad)' }}
                  onClick={() => {
                    if (window.confirm('确定重置全部设置？已保存的 API Key 将被清空。')) {
                      window.ipInsight
                        .resetSettings()
                        .then((r) => setLocal(r.settings))
                        .catch(() => undefined)
                    }
                  }}
                >
                  <RotateCcw size={14} /> 重置
                </button>
              </Row>
            </div>
          )}

          {section === 'about' && (
            <>
              <div className="card">
                <div className="card-eyebrow" style={{ marginBottom: 8 }}>关于</div>
                <div className="kv">
                  <div className="kv-row">
                    <div className="kv-key">软件名称</div>
                    <div className="kv-val">网鉴 · IP Insight（IP 综合检测助手）</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">版本</div>
                    <div className="kv-val mono">{version || '0.1.0'}</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">作者</div>
                    <div className="kv-val">薛泽（Xue Ze）</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">版权</div>
                    <div className="kv-val">Copyright © 2026 薛泽（Xue Ze）· 网鉴 IP Insight</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">项目仓库</div>
                    <div className="kv-val" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 12.5 }}>
                        github.com/xueze-ai
                      </span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          void window.ipInsight.openSource(
                            'https://github.com/xueze-ai?tab=repositories'
                          )
                        }
                      >
                        <ExternalLink size={13} /> 打开
                      </button>
                    </div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">架构</div>
                    <div className="kv-val">Electron + React + TypeScript · 内置 Chromium 隐藏页渲染</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">数据原则</div>
                    <div className="kv-val">所有数据来自上述数据源与本机测量的实时检测；不内置 IP 数据库</div>
                  </div>
                </div>
              </div>
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-eyebrow" style={{ marginBottom: 8 }}>数据源</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {DATA_SOURCES.map((d) => (
                    <div className="set-row" key={d.url} style={{ padding: '9px 0' }}>
                      <span className="small two mono">{d.url}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void window.ipInsight.openSource(d.url)}
                      >
                        <ExternalLink size={13} /> 打开
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card card-subtle" style={{ marginTop: 16 }}>
                <p className="caption" style={{ lineHeight: 1.8 }}>
                  合规边界：仅做正常浏览器访问、读取用户可见内容、调用站点前端自身使用的公开接口；
                  不破解验证码、不绕过 Cloudflare 挑战、不绕过登录与访问控制、不伪造请求、规避反爬一律不做；
                  遇到人机验证直接提示「该数据源需要人工验证 / 暂不可自动获取」。
                  网站改版时仅需修改对应 Provider Adapter。
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
