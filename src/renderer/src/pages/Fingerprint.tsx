import { ChevronDown, ExternalLink, Fingerprint as FpIcon, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { Fingerprint, NormalizedIPResult } from '@shared/types'
import { useDetectionContext } from '../state/DetectionContext'
import { requestNav } from '../state/navStore'

// =============================================================
// 浏览器指纹页（文档 §16）
// 分组：Browser / Device / Graphics / Privacy / Fingerprint；
// 默认只给分组摘要，「查看详细指纹」点击后再展开 UA / 字体 / 语言 / 原始 JSON。
// 数据源：Net.Coffee GPT 源在隐藏浏览器内真实计算（固定绘制，稳定可复现）。
// 诚实标注：指纹反映的是本软件内置隐藏浏览器（Chromium）的真实环境，
//          与你日常使用的浏览器可能不同；用于评估检测出口的指纹暴露面。
// =============================================================

function Row({ k, v }: { k: string; v: ReactNode }): JSX.Element {
  return (
    <div className="kv-row">
      <div className="kv-key">{k}</div>
      <div className="kv-val">{v ?? <span className="muted">—</span>}</div>
    </div>
  )
}

function Group({
  en,
  cn,
  children
}: {
  en: string
  cn: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="card">
      <div className="card-eyebrow" style={{ marginBottom: 10 }}>
        {en} · {cn}
      </div>
      <div className="kv">{children}</div>
    </div>
  )
}

function LeakBadge({
  leak
}: {
  leak?: { status: string; exitIp?: string; country?: string }
}): JSX.Element {
  if (!leak || !leak.status) return <span className="badge badge-neutral">未检测</span>
  const bad = leak.status.includes('泄露')
  return (
    <span className={'badge ' + (bad ? 'badge-bad' : 'badge-good')} title={leak.exitIp}>
      {leak.status}
      {leak.exitIp ? ` · ${leak.exitIp}` : ''}
    </span>
  )
}

const D = <span className="muted">—</span>

export function FingerprintPage(): JSX.Element {
  const { steps, run } = useDetectionContext()
  const [open, setOpen] = useState(false)

  const gpt = steps.find((s) => s.key === 'netcoffee_gpt')?.result
  const fp: Fingerprint | undefined = gpt?.fingerprint

  if (!gpt || !fp) {
    const reason = gpt?.error
    return (
      <div className="page" style={{ paddingTop: 120 }}>
        <h1 className="h1">浏览器指纹</h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: 560, lineHeight: 1.75 }}>
          指纹数据由 Net.Coffee GPT 源在隐藏浏览器内计算。
          {reason ? `本次检测该源失败：${reason}` : '先完成一次综合检测即可查看。'}
        </p>
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              requestNav('dashboard')
              run()
            }}
          >
            开始综合检测
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void window.ipInsight.openSource('https://ippure.com/fingerprint')}
          >
            <ExternalLink size={15} /> 打开 IPPure 指纹页
          </button>
        </div>
      </div>
    )
  }

  const tzBadge =
    fp.timezoneConsistent === true ? (
      <span className="badge badge-good">与 ChatGPT 出口时区一致</span>
    ) : fp.timezoneConsistent === false ? (
      <span className="badge badge-warn">与 ChatGPT 出口时区不一致</span>
    ) : (
      <span className="badge badge-neutral">无法判断</span>
    )

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <span className="dash-kicker">Browser Fingerprint · 隐藏浏览器实测</span>
      <h1 className="h1" style={{ marginTop: 6 }}>浏览器指纹</h1>
      <p className="muted small" style={{ marginTop: 8, maxWidth: 640, lineHeight: 1.75 }}>
        以下为检测所用内置隐藏浏览器（Chromium）的环境指纹，由 Net.Coffee GPT
        源在页面内固定绘制计算、稳定可复现；用于评估检测出口的指纹暴露面，
        与你日常使用的浏览器可能不同。未采集项显示「—」。
      </p>

      <div className="ip-cols" style={{ marginTop: 26 }}>
        <Group en="Browser" cn="浏览器">
          <Row
            k="浏览器"
            v={fp.browser ? `${fp.browser}${fp.browserVersion ? ' ' + fp.browserVersion : ''}` : D}
          />
          <Row k="操作系统" v={fp.os || D} />
          <Row k="Platform" v={fp.platform ? <span className="mono">{fp.platform}</span> : D} />
          <Row k="语言" v={fp.language ? <span className="mono">{fp.language}</span> : D} />
          <Row
            k="Cookie"
            v={
              fp.cookiesEnabled == null ? (
                D
              ) : fp.cookiesEnabled ? (
                <span className="badge badge-good">已启用</span>
              ) : (
                <span className="badge badge-warn">已禁用</span>
              )
            }
          />
        </Group>

        <Group en="Device" cn="设备">
          <Row k="屏幕分辨率" v={fp.screen ? <span className="mono">{fp.screen}</span> : D} />
          <Row k="色彩深度" v={fp.colorDepth != null ? `${fp.colorDepth} bit` : D} />
          <Row k="CPU 线程数" v={fp.hardwareConcurrency != null ? `${fp.hardwareConcurrency}` : D} />
          <Row
            k="设备内存"
            v={fp.deviceMemory != null ? `${fp.deviceMemory} GB（浏览器上报上限值）` : D}
          />
        </Group>

        <Group en="Graphics" cn="图形与音频">
          <Row k="GPU 渲染器" v={fp.webglRenderer || D} />
          <Row k="WebGL 指纹" v={fp.webgl ? <span className="mono">{fp.webgl}</span> : D} />
          <Row k="Canvas 指纹" v={fp.canvas ? <span className="mono">{fp.canvas}</span> : D} />
          <Row k="音频指纹" v={fp.audio ? <span className="mono">{fp.audio}</span> : D} />
        </Group>

        <Group en="Privacy" cn="隐私一致性">
          <Row k="时区" v={fp.timezone ? <span className="mono">{fp.timezone}</span> : D} />
          <Row k="时区一致性" v={tzBadge} />
          <Row k="DNS 泄露" v={<LeakBadge leak={gpt.dnsLeak} />} />
          <Row k="WebRTC 泄露" v={<LeakBadge leak={gpt.webRTCLeak} />} />
        </Group>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-eyebrow" style={{ marginBottom: 10 }}>
          Fingerprint · 综合指纹
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="fp-id">
            <FpIcon size={18} style={{ opacity: 0.7 }} />
            {fp.visitorId ?? '—'}
          </span>
          {fp.fonts?.length != null && (
            <span className="badge badge-neutral">检出 {fp.fonts.length} 个字体</span>
          )}
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="caption" style={{ flex: '0 0 auto' }}>偏好语言</span>
          {fp.languages?.length ? (
            fp.languages.map((l) => (
              <span className="chip mono" key={l} style={{ fontSize: 12 }}>
                {l}
              </span>
            ))
          ) : (
            <span className="caption">—</span>
          )}
        </div>
        {fp.visitorId == null && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={run}>
              <RefreshCw size={14} /> 重新综合检测以获取新版指纹字段
            </button>
          </div>
        )}
        <p className="caption" style={{ marginTop: 10, lineHeight: 1.7 }}>
          综合指纹 ID 由本机对 Canvas / WebGL / 音频 / 屏幕 / 时区 / 语言 /
          线程数哈希计算，仅用于自我前后对比（例如更换代理或浏览器内核后是否变化）；
          非跨站跟踪 ID，不上传任何服务器。
          {fp.visitorId == null && '（本次检测为旧版 Adapter 结果，无该项）'}
        </p>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>
          <ChevronDown
            size={16}
            style={{
              transform: open ? 'rotate(180deg)' : undefined,
              transition: 'transform var(--dur-fast) var(--ease)'
            }}
          />
          {open ? '收起详细指纹' : '查看详细指纹'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => void window.ipInsight.openSource('https://ip.net.coffee/gpt/')}
        >
          <ExternalLink size={15} /> 查看 GPT 源原网站
        </button>
      </div>

      {open && (
        <div className="card card-subtle card-pad-sm" style={{ marginTop: 12 }}>
          <div className="caption strong" style={{ marginBottom: 6 }}>User-Agent</div>
          <pre className="mono fp-pre">{fp.userAgent ?? '—'}</pre>

          <div className="caption strong" style={{ margin: '12px 0 6px' }}>
            偏好语言列表
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {fp.languages?.length ? (
              fp.languages.map((l) => (
                <span className="chip mono" key={l} style={{ fontSize: 12 }}>
                  {l}
                </span>
              ))
            ) : (
              <span className="caption">—</span>
            )}
          </div>

          <div className="caption strong" style={{ margin: '12px 0 6px' }}>
            检出字体（宽度差异法，浏览器端计算）
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {fp.fonts?.length ? (
              fp.fonts.map((f) => (
                <span className="chip" key={f} style={{ fontSize: 12 }}>
                  {f}
                </span>
              ))
            ) : fp.fonts ? (
              <span className="caption">未检出候选字体</span>
            ) : (
              <span className="caption">本次检测未采集字体项</span>
            )}
          </div>

          <div className="caption strong" style={{ margin: '12px 0 6px' }}>
            原始指纹 JSON
          </div>
          <pre className="mono fp-pre">{JSON.stringify(fp, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
