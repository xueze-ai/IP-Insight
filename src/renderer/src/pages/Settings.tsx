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
  AppSettings,
  UpdateStatus
} from '@shared/types'
import { AI_PROVIDER_META } from '@shared/aiProviders'
import { useTheme } from '../hooks/useTheme'
import { useLang } from '../i18n'
import type { Params, TKey } from '../i18n'

// =============================================================
// 设置页
// 分区：外观 / AI 提供商 / 检测 / 数据与隐私 / 关于
// 持久化到主进程 userData/settings.json；外观与检测设置即时联动其他页面。
// =============================================================

type Section = 'appearance' | 'ai' | 'detection' | 'privacy' | 'about'

const SECTIONS: { id: Section; icon: typeof Palette }[] = [
  { id: 'appearance', icon: Palette },
  { id: 'ai', icon: Bot },
  { id: 'detection', icon: Activity },
  { id: 'privacy', icon: Database },
  { id: 'about', icon: Info }
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
  nameEn?: string
  desc: string
  descEn?: string
  tag?: string
  tagEn?: string
  defaultBaseUrl: string
  defaultModel: string
  modelHint: string
  modelHintEn?: string
  isCustom: boolean
}

function dataSources(t: (key: TKey, params?: Params) => string): { name: string; url: string }[] {
  return [
    { name: 'Ping0', url: 'https://ping0.cc/' },
    { name: t('settings.about.sourceNames.netcoffeeHome'), url: 'https://ip.net.coffee/' },
    { name: t('settings.about.sourceNames.netcoffeeScore'), url: 'https://ip.net.coffee/ip/' },
    { name: t('settings.about.sourceNames.netcoffeeGpt'), url: 'https://ip.net.coffee/gpt/' },
    { name: t('settings.about.sourceNames.netcoffeePing'), url: 'https://ip.net.coffee/ping/' },
    { name: t('settings.about.sourceNames.netcoffeeStatus'), url: 'https://ip.net.coffee/status/' },
    { name: 'IPPure', url: 'https://ippure.com/' },
    { name: 'Cloudflare Speedtest', url: 'https://speed.cloudflare.com/' }
  ]
}

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

function updateStatusText(
  t: (key: TKey, params?: Params) => string,
  s: UpdateStatus | null
): string {
  if (!s || s.state === 'idle') return t('settings.about.updateCheckDesc')
  switch (s.state) {
    case 'checking':
      return t('settings.about.updateChecking')
    case 'available':
      return t('settings.about.updateAvailable', { version: s.version ?? '' })
    case 'downloading':
      return t('settings.about.updateDownloading', { percent: s.percent ?? 0 })
    case 'downloaded':
      return t('settings.about.updateDownloaded', { version: s.version ?? '' })
    case 'up-to-date':
      return t('settings.about.updateUptodate')
    case 'error':
      return t('settings.about.updateError', { message: s.message ?? '' })
  }
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
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const { theme, setTheme } = useTheme()
  const { t, lang, setLang } = useLang()

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
    const offUpdate = window.ipInsight.onUpdateStatus((s) => {
      if (on) setUpdateStatus(s)
    })
    return () => {
      on = false
      offUpdate()
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

  // 按当前语言取提供商文案（内置项走元数据的 En 字段，自定义项走字典）
  const L = (zhText: string, enText?: string): string =>
    lang === 'en' && enText ? enText : zhText

  const providerList: ProviderItem[] = [
    ...AI_PROVIDER_META.filter((m) => !local.ai.hiddenProviders.includes(m.id)).map(
      (m) => ({ ...m, isCustom: false })
    ),
    ...Object.entries(local.ai.customProviders ?? {}).map(([id, c]) => ({
      id,
      name: c.name || id,
      desc: t('settings.ai.customDesc'),
      tag: t('settings.ai.customTag'),
      defaultBaseUrl: '',
      defaultModel: '',
      modelHint: t('settings.ai.customModelHint'),
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
      <span className="dash-kicker">{t('settings.kicker')}</span>
      <h1 className="h1" style={{ marginTop: 6 }}>{t('common.nav.settings')}</h1>

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
              {t(`settings.sections.${s.id}`)}
            </button>
          ))}
        </nav>

        {/* ---------- 右：内容 ---------- */}
        <div style={{ minWidth: 0 }}>
          {section === 'appearance' && (
            <div className="card">
              <div className="card-eyebrow" style={{ marginBottom: 8 }}>{t('settings.sections.appearance')}</div>
              <Row title={t('settings.appearance.themeTitle')} desc={t('settings.appearance.themeDesc')}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(
                    [
                      { v: 'light', labelKey: 'settings.appearance.themeLight', icon: Sun },
                      { v: 'dark', labelKey: 'settings.appearance.themeDark', icon: Moon },
                      { v: 'system', labelKey: 'settings.appearance.themeSystem', icon: Monitor }
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      className={'btn btn-sm ' + (theme === o.v ? 'btn-tonal' : 'btn-ghost')}
                      onClick={() => setTheme(o.v)}
                    >
                      <o.icon size={14} /> {t(o.labelKey)}
                    </button>
                  ))}
                </div>
              </Row>
              <Row
                title={t('settings.appearance.collapseTitle')}
                desc={t('settings.appearance.collapseDesc')}
              >
                <Switch
                  checked={local.appearance.sidebarCollapsedByDefault}
                  label={t('settings.appearance.collapseTitle')}
                  onChange={(v) =>
                    commit({
                      ...local,
                      appearance: { ...local.appearance, sidebarCollapsedByDefault: v }
                    })
                  }
                />
              </Row>
              <Row title={t('settings.appearance.fontTitle')} desc={t('settings.appearance.fontDesc')}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(
                    [
                      { v: 'standard', labelKey: 'settings.appearance.fontStandard' },
                      { v: 'large', labelKey: 'settings.appearance.fontLarge' }
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
                      {t(o.labelKey)}
                    </button>
                  ))}
                </div>
              </Row>
              <Row title={t('settings.appearance.langTitle')} desc={t('settings.appearance.langDesc')}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(
                    [
                      { v: 'zh', labelKey: 'settings.appearance.langZh' },
                      { v: 'en', labelKey: 'settings.appearance.langEn' }
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      className={
                        'btn btn-sm ' +
                        (lang === o.v ? 'btn-tonal' : 'btn-ghost')
                      }
                      onClick={() => setLang(o.v)}
                    >
                      {t(o.labelKey)}
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
                  <div className="card-eyebrow">{t('settings.sections.ai')}</div>
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
                            [id]: { name: t('settings.ai.customName', { n: Object.keys(local.ai.customProviders ?? {}).length + 1 }), apiKey: '', baseUrl: '', model: '' }
                          }
                        }
                      }
                      commit(next)
                      setExpanded(id)
                    }}
                  >
                    {t('settings.ai.addCustom')}
                  </button>
                </div>
                <p className="caption" style={{ lineHeight: 1.7, marginBottom: 12 }}>
                  {t('settings.ai.intro')}
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
                          <span className="prov-name">{L(m.name, m.nameEn)}</span>
                          {m.tag && <span className="badge badge-info">{L(m.tag, m.tagEn)}</span>}
                          {isCurrent && <span className="badge badge-good">{t('settings.ai.inUse')}</span>}
                          {!isCurrent && cfg?.apiKey.trim() && (
                            <span className="badge badge-neutral">{t('settings.ai.configured')}</span>
                          )}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                            {!isCurrent && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  commit({ ...local, ai: { ...local.ai, current: m.id } })
                                }
                              >
                                {t('settings.ai.setCurrent')}
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--bad)' }}
                              title={m.isCustom ? t('settings.ai.deleteTitle') : t('settings.ai.hideTitle')}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    t(m.isCustom ? 'settings.ai.deleteConfirm' : 'settings.ai.hideConfirm', {
                                      name: L(m.name, m.nameEn)
                                    })
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
                              <Trash2 size={13} /> {m.isCustom ? t('settings.ai.delete') : t('settings.ai.hide')}
                            </button>
                            <button
                              className="btn-icon"
                              style={{ width: 30, height: 30 }}
                              onClick={() => setExpanded(isOpen ? null : m.id)}
                              title={isOpen ? t('settings.ai.collapseTitle') : t('settings.ai.expandTitle')}
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
                          {L(m.desc, m.descEn)}
                        </p>

                        {isOpen && (
                          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {m.isCustom && (
                              <div>
                                <label className="field-label">{t('settings.ai.fieldName')}</label>
                                <input
                                  className="input"
                                  value={cfg?.name ?? ''}
                                  onChange={(e) => setProvider(m.id, { name: e.target.value })}
                                />
                              </div>
                            )}
                            <div>
                              <label className="field-label">
                                {m.id === 'ollama' ? t('settings.ai.fieldKeyOllama') : t('settings.ai.fieldKey')}
                              </label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  className="input mono"
                                  type={showKey[m.id] ? 'text' : 'password'}
                                  placeholder={t('settings.ai.keyPlaceholder')}
                                  value={cfg?.apiKey ?? ''}
                                  onChange={(e) => setProvider(m.id, { apiKey: e.target.value })}
                                  style={{ flex: 1 }}
                                />
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() =>
                                    setShowKey((s) => ({ ...s, [m.id]: !s[m.id] }))
                                  }
                                  title={showKey[m.id] ? t('settings.ai.hideKey') : t('settings.ai.showKey')}
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
                              <label className="field-label">{t('settings.ai.fieldModel')}</label>
                              <input
                                className="input mono"
                                value={cfg?.model ?? ''}
                                placeholder={m.defaultModel || 'model-name'}
                                onChange={(e) => setProvider(m.id, { model: e.target.value })}
                              />
                              <p className="caption" style={{ marginTop: 4 }}>{L(m.modelHint, m.modelHintEn)}</p>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={ts?.loading}
                                onClick={() => void testProvider(m.id)}
                              >
                                <RefreshCw size={14} className={ts?.loading ? 'spin' : undefined} />
                                {t('settings.ai.test')}
                              </button>
                              {ts?.result &&
                                (ts.result.ok ? (
                                  <span className="badge badge-good">
                                    {ts.result.reply
                                      ? t('settings.ai.testOkReply', { ms: ts.result.ms ?? 0, reply: ts.result.reply })
                                      : t('settings.ai.testOk', { ms: ts.result.ms ?? 0 })}
                                  </span>
                                ) : (
                                  <span className="badge badge-bad" title={ts.result.error}>
                                    {t('settings.ai.testFail', { error: (ts.result.error ?? '').slice(0, 60) })}
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
                    {t('settings.ai.hidden', { list: local.ai.hiddenProviders.join('、') })}　
                    <button
                      className="btn btn-text"
                      style={{ height: 22, padding: 0 }}
                      onClick={() =>
                        commit({ ...local, ai: { ...local.ai, hiddenProviders: [] } })
                      }
                    >
                      {t('settings.ai.restoreAll')}
                    </button>
                  </p>
                )}
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-eyebrow" style={{ marginBottom: 8 }}>{t('settings.ai.params')}</div>
                <Row
                  title={t('settings.ai.tempTitle')}
                  desc={t('settings.ai.tempDesc')}
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
                  title={t('settings.ai.tokenTitle')}
                  desc={t('settings.ai.tokenDesc')}
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
                  title={t('settings.ai.extraTitle')}
                  desc={t('settings.ai.extraDesc')}
                >
                  <textarea
                    className="input"
                    style={{ height: 64, width: 300, resize: 'vertical', padding: '8px 12px' }}
                    placeholder={t('settings.ai.extraPlaceholder')}
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
              <div className="card-eyebrow" style={{ marginBottom: 8 }}>{t('settings.sections.detection')}</div>
              <Row
                title={t('settings.detection.timeoutTitle')}
                desc={t('settings.detection.timeoutDesc')}
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
                title={t('settings.detection.autoRunTitle')}
                desc={t('settings.detection.autoRunDesc')}
              >
                <Switch
                  checked={local.detection.autoRunOnStart}
                  label={t('settings.detection.autoRunTitle')}
                  onChange={(v) =>
                    commit({ ...local, detection: { ...local.detection, autoRunOnStart: v } })
                  }
                />
              </Row>
              <Row
                title={t('settings.detection.parallelTitle')}
                desc={t('settings.detection.parallelDesc')}
              >
                <Switch
                  checked={local.detection.parallel}
                  label={t('settings.detection.parallelTitle')}
                  onChange={(v) =>
                    commit({ ...local, detection: { ...local.detection, parallel: v } })
                  }
                />
              </Row>
            </div>
          )}

          {section === 'privacy' && (
            <div className="card">
              <div className="card-eyebrow" style={{ marginBottom: 8 }}>{t('settings.sections.privacy')}</div>
              <Row
                title={t('settings.privacy.historyTitle')}
                desc={t('settings.privacy.historyDesc')}
              >
                <Switch
                  checked={local.privacy.historyEnabled}
                  label={t('settings.privacy.historyTitle')}
                  onChange={(v) =>
                    commit({ ...local, privacy: { ...local.privacy, historyEnabled: v } })
                  }
                />
              </Row>
              <Row title={t('settings.privacy.retentionTitle')} desc={t('settings.privacy.retentionDesc')}>
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
                title={t('settings.privacy.clearTitle')}
                desc={t('settings.privacy.clearDesc')}
              >
                <Switch
                  checked={local.privacy.clearHistoryOnExit}
                  label={t('settings.privacy.clearTitle')}
                  onChange={(v) =>
                    commit({ ...local, privacy: { ...local.privacy, clearHistoryOnExit: v } })
                  }
                />
              </Row>
              <Row
                title={t('settings.privacy.resetTitle')}
                desc={t('settings.privacy.resetDesc')}
              >
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--bad)' }}
                  onClick={() => {
                    if (window.confirm(t('settings.privacy.resetConfirm'))) {
                      window.ipInsight
                        .resetSettings()
                        .then((r) => setLocal(r.settings))
                        .catch(() => undefined)
                    }
                  }}
                >
                  <RotateCcw size={14} /> {t('settings.privacy.resetBtn')}
                </button>
              </Row>
            </div>
          )}

          {section === 'about' && (
            <>
              <div className="card">
                <div className="card-eyebrow" style={{ marginBottom: 8 }}>{t('settings.sections.about')}</div>
                <div className="kv">
                  <div className="kv-row">
                    <div className="kv-key">{t('settings.about.appName')}</div>
                    <div className="kv-val">{t('settings.about.appNameValue')}</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">{t('settings.about.version')}</div>
                    <div className="kv-val mono">{version || '0.1.0'}</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">{t('settings.about.author')}</div>
                    <div className="kv-val">{t('settings.about.authorValue')}</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">{t('settings.about.copyright')}</div>
                    <div className="kv-val">{t('settings.about.copyrightValue')}</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">{t('settings.about.repo')}</div>
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
                        <ExternalLink size={13} /> {t('common.action.open')}
                      </button>
                    </div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">{t('settings.about.arch')}</div>
                    <div className="kv-val">{t('settings.about.archValue')}</div>
                  </div>
                  <div className="kv-row">
                    <div className="kv-key">{t('settings.about.principle')}</div>
                    <div className="kv-val">{t('settings.about.principleValue')}</div>
                  </div>
                </div>
              </div>
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-eyebrow" style={{ marginBottom: 8 }}>{t('settings.about.updateEyebrow')}</div>
                <Row
                  title={t('settings.about.updateAutoTitle')}
                  desc={t('settings.about.updateAutoDesc')}
                >
                  <Switch
                    checked={local.updates.autoCheck}
                    label={t('settings.about.updateAutoTitle')}
                    onChange={(v) =>
                      commit({ ...local, updates: { autoCheck: v } })
                    }
                  />
                </Row>
                <Row title={t('settings.about.updateCheckTitle')} desc={updateStatusText(t, updateStatus)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={
                        updateStatus?.state === 'checking' ||
                        updateStatus?.state === 'downloading'
                      }
                      onClick={() => {
                        setUpdateStatus({ state: 'checking' })
                        window.ipInsight.checkForUpdates().catch(() => undefined)
                      }}
                    >
                      <RefreshCw size={14} /> {t('settings.about.updateCheckBtn')}
                    </button>
                    {updateStatus?.state === 'downloaded' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => void window.ipInsight.quitAndInstall()}
                      >
                        {t('settings.about.updateRestartBtn')}
                      </button>
                    )}
                  </div>
                </Row>
              </div>
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-eyebrow" style={{ marginBottom: 8 }}>{t('settings.about.sources')}</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {dataSources(t).map((d) => (
                    <div className="set-row" key={d.url} style={{ padding: '9px 0' }}>
                      <span className="small two mono">{d.url}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void window.ipInsight.openSource(d.url)}
                      >
                        <ExternalLink size={13} /> {t('common.action.open')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card card-subtle" style={{ marginTop: 16 }}>
                <p className="caption" style={{ lineHeight: 1.8 }}>
                  {t('settings.about.compliance')}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
