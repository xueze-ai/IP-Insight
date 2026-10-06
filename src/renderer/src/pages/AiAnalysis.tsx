import { Copy, RefreshCw, Settings2, Sparkles } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { JSX } from 'react'
import type { AppSettings } from '@shared/types'
import { AI_PROVIDER_META } from '@shared/aiProviders'
import { Markdown } from '../components/Markdown'
import { useDetectionContext } from '../state/DetectionContext'
import { getAi, startAnalysis, subscribeAi } from '../state/aiStore'
import { getAsk, subscribeAsk, setAskQuestion, askQuestion } from '../state/askStore'
import { requestNav } from '../state/navStore'
import { aiPayload, } from '../utils/report'
import { buildConsistencyText, successfulResults } from '../utils/aggregate'
import { useLang } from '../i18n'

// =============================================================
// AI 分析页
// 把全部标准化检测数据 + 程序交叉汇总交给用户配置的模型（设置页写入），
// 流式渲染分析报告。分析状态在模块级 store 中：切换页面不丢、不重跑。
// =============================================================

export function AiAnalysis(): JSX.Element {
  const { steps, run, lastRecordId, setAiReport } = useDetectionContext()
  const ai = useSyncExternalStore(subscribeAi, getAi)
  // 场景咨询状态在模块级 store：输入草稿 / 流式回答 / 错误切页不丢
  const ask = useSyncExternalStore(subscribeAsk, getAsk)
  const all = successfulResults(steps)
  const { t } = useLang()

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // 运行中计时器（计时起点在 store 中，切页回来不归零）
  useEffect(() => {
    if (ai.phase !== 'running' && ask.phase !== 'asking') return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [ai.phase, ask.phase])

  const elapsed = ai.startedAt
    ? Math.max(0, Math.round((now - ai.startedAt) / 1000))
    : 0
  const askElapsed = ask.startedAt
    ? Math.max(0, Math.round((now - ask.startedAt) / 1000))
    : 0

  // 设置仅用于显示当前提供商名称
  useEffect(() => {
    let on = true
    window.ipInsight
      .getSettings()
      .then((r) => {
        if (on) setSettings(r.settings)
      })
      .catch(() => undefined)
    return () => {
      on = false
    }
  }, [])

  const currentMeta = settings
    ? AI_PROVIDER_META.find((m) => m.id === settings.ai.current)
    : undefined
  const currentCustom = settings?.ai.customProviders?.[settings.ai.current]
  const providerName =
    currentMeta?.name ?? currentCustom?.name ?? settings?.ai.current ?? 'AI'
  const currentModel =
    settings?.ai.providers[settings.ai.current as keyof typeof settings.ai.providers]
      ?.model ||
    currentCustom?.model ||
    currentMeta?.defaultModel ||
    ''

  const generate = async (): Promise<void> => {
    if (!all.length) return
    const res = await startAnalysis(aiPayload(all), buildConsistencyText(all))
    if (res.ok && res.text) {
      setAiReport(res.text)
      if (lastRecordId) {
        void window.ipInsight
          .updateHistoryAi(lastRecordId, res.text)
          .catch(() => undefined)
      }
    }
  }

  // 场景咨询：问「这个 IP 适不适合某用途」，流式回答结论 + 依据 + 换节点建议。
  // 状态在 askStore（模块级）：切页不丢草稿、不中断流式、不丢结果。
  const doAsk = (): void => {
    if (!all.length || ask.phase === 'asking') return
    void askQuestion(all, buildConsistencyText(all), ask.question)
  }

  /* ---------- 无检测数据 ---------- */
  if (!all.length) {
    return (
      <div className="page" style={{ paddingTop: 120 }}>
        <h1 className="h1">{t('ai.title')}</h1>
        <p className="muted" style={{ marginTop: 10 }}>
          {t('ai.emptyDesc')}
        </p>
        <div style={{ marginTop: 24 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              requestNav('dashboard')
              run()
            }}
          >
            {t('ai.startDetection')}
          </button>
        </div>
      </div>
    )
  }

  const configured = settings
    ? !!(
        settings.ai.providers[settings.ai.current as keyof typeof settings.ai.providers]
          ?.apiKey ||
        currentCustom?.apiKey ||
        settings.ai.current === 'ollama'
      )
    : null

  /* ---------- 未配置 AI ---------- */
  if (configured === false) {
    return (
      <div className="page" style={{ paddingTop: 120 }}>
        <h1 className="h1">{t('ai.title')}</h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: 560, lineHeight: 1.75 }}>
          {t('ai.notConfigured', { n: all.length })}
        </p>
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={() => requestNav('settings', 'ai')}
          >
            <Settings2 size={16} /> {t('ai.goSettings')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">{t('ai.kicker', { n: all.length })}</span>
      <h1 className="h1" style={{ marginTop: 6 }}>{t('ai.title')}</h1>
      <p className="muted small" style={{ marginTop: 8, maxWidth: 640, lineHeight: 1.75 }}>
        {t('ai.desc', {
          provider: providerName,
          model: currentModel ? t('ai.modelSuffix', { model: currentModel }) : ''
        })}
      </p>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {all.map((r) => (
          <span className="chip" key={r.provider.id}>
            {r.provider.name}
            <span className="mono muted" style={{ fontSize: 11.5 }}>{r.ip}</span>
          </span>
        ))}
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={() => void generate()}
          disabled={ai.phase === 'running'}
        >
          {ai.phase === 'running' ? (
            <RefreshCw size={16} className="spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {ai.phase === 'idle' ? t('ai.generate') : ai.phase === 'running' ? t('ai.analyzing') : t('ai.regenerate')}
        </button>
        {ai.text && ai.phase !== 'running' && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              void navigator.clipboard.writeText(ai.text)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            <Copy size={15} /> {copied ? t('common.action.copied') : t('ai.copyReport')}
          </button>
        )}
        <button
          className="btn btn-text"
          onClick={() => requestNav('settings', 'ai')}
        >
          {t('ai.modelSettings')}
        </button>
        {ai.meta && (
          <span className="caption">
            {ai.meta.provider} · {ai.meta.model} · {(ai.meta.ms / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {ai.phase === 'error' && ai.error && (
        <div className="card" style={{ marginTop: 20, borderColor: 'var(--bad)' }}>
          <span className="badge badge-bad">{t('ai.failed')}</span>
          <p className="small two" style={{ marginTop: 10, lineHeight: 1.7 }}>{ai.error}</p>
          <p className="caption" style={{ marginTop: 6 }}>
            {t('ai.failedHint')}
          </p>
        </div>
      )}

      {(ai.phase === 'running' || ai.text) && (
        <div className="card ai-card" style={{ marginTop: 20 }}>
          {ai.phase === 'running' && (
            <div style={{ marginBottom: ai.text ? 14 : 0 }}>
              <div className="indet-bar">
                <span />
              </div>
              <p className="caption" style={{ marginTop: 8, lineHeight: 1.7 }}>
                {ai.stage === 'streaming'
                  ? t('ai.stage.streaming', { elapsed, chars: ai.text.length })
                  : ai.stage === 'connected'
                    ? t('ai.stage.connected', { elapsed })
                    : t('ai.stage.connecting', { elapsed })}
              </p>
            </div>
          )}
          {ai.text ? (
            <Markdown text={ai.text} />
          ) : ai.phase !== 'running' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="skeleton" style={{ height: 18, width: '46%' }} />
              <div className="skeleton" style={{ height: 14, width: '88%' }} />
              <div className="skeleton" style={{ height: 14, width: '72%' }} />
              <div className="skeleton" style={{ height: 14, width: '80%' }} />
            </div>
          ) : null}
        </div>
      )}

      {ai.phase === 'idle' && (
        <div className="card card-subtle" style={{ marginTop: 20 }}>
          <p className="small two" style={{ lineHeight: 1.8 }}>
            {t('ai.reportHint')}
          </p>
        </div>
      )}

      {/* ---------- 场景咨询（状态在 askStore，切页不丢） ---------- */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-eyebrow" style={{ marginBottom: 8 }}>{t('ai.ask.title')}</div>
        <p className="caption" style={{ lineHeight: 1.7, marginBottom: 12 }}>
          {t('ai.ask.desc')}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {(
            [
              { label: t('ai.ask.scNetflix'), q: t('ai.ask.qNetflix') },
              { label: t('ai.ask.scGaming'), q: t('ai.ask.qGaming') },
              { label: t('ai.ask.scChatgpt'), q: t('ai.ask.qChatgpt') },
              { label: t('ai.ask.scEcommerce'), q: t('ai.ask.qEcommerce') }
            ]
          ).map((s) => (
            <button
              key={s.label}
              className="btn btn-sm btn-ghost"
              disabled={ask.phase === 'asking'}
              onClick={() => setAskQuestion(s.q)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder={t('ai.ask.placeholder')}
            value={ask.question}
            disabled={ask.phase === 'asking'}
            onChange={(e) => setAskQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doAsk()
            }}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={ask.phase === 'asking' || !ask.question.trim()}
            onClick={() => doAsk()}
          >
            {ask.phase === 'asking' ? (
              <RefreshCw size={14} className="spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {ask.phase === 'asking' ? t('ai.ask.asking') : t('ai.ask.button')}
          </button>
        </div>
        {ask.phase === 'error' && ask.error && (
          <p style={{ marginTop: 12 }}>
            <span className="badge badge-bad">
              {t('ai.ask.error', { message: ask.error })}
            </span>
          </p>
        )}
        {(ask.phase === 'asking' || ask.phase === 'done') && (
          <div style={{ marginTop: 14 }}>
            {ask.phase === 'asking' && (
              <div style={{ marginBottom: ask.answer ? 14 : 0 }}>
                <div className="indet-bar">
                  <span />
                </div>
                <p className="caption" style={{ marginTop: 8, lineHeight: 1.7 }}>
                  {ask.answer
                    ? t('ai.ask.streaming', { elapsed: askElapsed })
                    : t('ai.ask.waiting', { elapsed: askElapsed })}
                </p>
              </div>
            )}
            {ask.answer ? (
              <Markdown text={ask.answer} />
            ) : ask.phase === 'asking' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton" style={{ height: 18, width: '42%' }} />
                <div className="skeleton" style={{ height: 14, width: '92%' }} />
                <div className="skeleton" style={{ height: 14, width: '78%' }} />
                <div className="skeleton" style={{ height: 14, width: '85%' }} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
