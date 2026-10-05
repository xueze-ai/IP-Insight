import { Copy, RefreshCw, Settings2, Sparkles } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { JSX } from 'react'
import type { AppSettings } from '@shared/types'
import { AI_PROVIDER_META } from '@shared/aiProviders'
import { Markdown } from '../components/Markdown'
import { useDetectionContext } from '../state/DetectionContext'
import { getAi, startAnalysis, subscribeAi } from '../state/aiStore'
import { requestNav } from '../state/navStore'
import { aiPayload, } from '../utils/report'
import { buildConsistencyText, successfulResults } from '../utils/aggregate'

// =============================================================
// AI 分析页
// 把全部标准化检测数据 + 程序交叉汇总交给用户配置的模型（设置页写入），
// 流式渲染分析报告。分析状态在模块级 store 中：切换页面不丢、不重跑。
// =============================================================

export function AiAnalysis(): JSX.Element {
  const { steps, run, lastRecordId, setAiReport } = useDetectionContext()
  const ai = useSyncExternalStore(subscribeAi, getAi)
  const all = successfulResults(steps)

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // 运行中计时器（计时起点在 store 中，切页回来不归零）
  useEffect(() => {
    if (ai.phase !== 'running') return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [ai.phase])

  const elapsed = ai.startedAt
    ? Math.max(0, Math.round((now - ai.startedAt) / 1000))
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

  /* ---------- 无检测数据 ---------- */
  if (!all.length) {
    return (
      <div className="page" style={{ paddingTop: 120 }}>
        <h1 className="h1">AI 网络环境分析</h1>
        <p className="muted" style={{ marginTop: 10 }}>
          先完成一次综合检测，AI 将基于全部数据源的结果进行分析。
        </p>
        <div style={{ marginTop: 24 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              requestNav('dashboard')
              run()
            }}
          >
            开始综合检测
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
        <h1 className="h1">AI 网络环境分析</h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: 560, lineHeight: 1.75 }}>
          尚未配置 AI 提供商。检测数据已就绪（{all.length} 个数据源），
          请在设置中填写任一提供商的 API Key 后即可生成分析。
        </p>
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={() => requestNav('settings', 'ai')}
          >
            <Settings2 size={16} /> 前往设置 AI 提供商
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">AI Analysis · 基于 {all.length} 个数据源</span>
      <h1 className="h1" style={{ marginTop: 6 }}>AI 网络环境分析</h1>
      <p className="muted small" style={{ marginTop: 8, maxWidth: 640, lineHeight: 1.75 }}>
        将全部标准化检测数据与多源交叉汇总发送给 {providerName}
        {currentModel ? `（${currentModel}）` : ''}。
        AI 只进行分析、总结与解释；原始数据可在各页面逐源核对。
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
          {ai.phase === 'idle' ? '生成分析' : ai.phase === 'running' ? '分析中……' : '重新生成'}
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
            <Copy size={15} /> {copied ? '已复制' : '复制报告'}
          </button>
        )}
        <button
          className="btn btn-text"
          onClick={() => requestNav('settings', 'ai')}
        >
          模型与参数设置
        </button>
        {ai.meta && (
          <span className="caption">
            {ai.meta.provider} · {ai.meta.model} · {(ai.meta.ms / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {ai.phase === 'error' && ai.error && (
        <div className="card" style={{ marginTop: 20, borderColor: 'var(--bad)' }}>
          <span className="badge badge-bad">分析失败</span>
          <p className="small two" style={{ marginTop: 10, lineHeight: 1.7 }}>{ai.error}</p>
          <p className="caption" style={{ marginTop: 6 }}>
            常见原因：API Key 无效 / 余额不足 / 模型名错误 / 网络不可达该提供商。可在设置中「测试连接」排查。
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
                  ? `正在输出…… 已用时 ${elapsed}s · 已输出 ${ai.text.length} 字`
                  : ai.stage === 'connected'
                    ? `已连上提供商，等待模型首字…… 已用时 ${elapsed}s（推理型模型如 deepseek-reasoner 的首字前思考时间较长；期间可继续使用其他页面，分析不会中断或重跑）`
                    : `正在连接提供商并发送检测数据…… 已用时 ${elapsed}s`}
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
            报告将包含：结论速览（综合评分 / 原生性 / 风险等级 / VPN / Proxy / Tor / 住宅 /
            数据中心 / 共享出口）、【AI 综合分析】【多源一致性】【异常项目】【风险说明】【适合场景】【不建议场景】。
            多源冲突项会明确标注「当前无法确认」。切换页面不会丢失已生成的分析。
          </p>
        </div>
      )}
    </div>
  )
}
