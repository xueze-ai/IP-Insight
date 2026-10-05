import { useState, useEffect } from 'react'
import type { JSX } from 'react'
import { AppShell } from './shell/AppShell'
import { Dashboard } from './pages/Dashboard'
import { IpInfo } from './pages/IpInfo'
import { NetworkQuality } from './pages/NetworkQuality'
import { RiskAnalysis } from './pages/RiskAnalysis'
import { FingerprintPage } from './pages/Fingerprint'
import { History } from './pages/History'
import { AiAnalysis } from './pages/AiAnalysis'
import { Settings } from './pages/Settings'
import { DetectionProvider } from './state/DetectionContext'
import { subscribeNav } from './state/navStore'
import type { PageId } from './navigation'

export default function App(): JSX.Element {
  const [page, setPage] = useState<PageId>('dashboard')
  const [settingsSection, setSettingsSection] =
    useState<'appearance' | 'ai' | 'detection' | 'privacy' | 'about'>('appearance')
  const [demo] = useState(
    () => !!(window as unknown as { __IPI_DEMO__?: boolean }).__IPI_DEMO__
  )

  // 子页面请求跳转（如 AI 页引导去设置的 AI 分区）
  useEffect(
    () =>
      subscribeNav((p, section) => {
        setPage(p)
        if (section) setSettingsSection(section)
      }),
    []
  )

  // 设置联动：界面字号
  useEffect(() => {
    let on = true
    window.ipInsight
      .getSettings()
      .then((r) => {
        if (!on) return
        document.documentElement.style.fontSize =
          r.settings?.appearance?.fontSize === 'large' ? '15.5px' : ''
      })
      .catch(() => undefined)
    return () => {
      on = false
    }
  }, [page])

  return (
    <DetectionProvider>
      <AppShell page={page} onNavigate={setPage}>
        {demo && (
          <div
            className="badge badge-warn"
            style={{ position: 'fixed', top: 10, right: 56, zIndex: 80, boxShadow: 'var(--shadow-md)' }}
          >
            Demo 模式 · 样例数据（浏览器预览）
          </div>
        )}
        {page === 'dashboard' ? (
          <Dashboard />
        ) : page === 'ipInfo' ? (
          <IpInfo />
        ) : page === 'networkQuality' ? (
          <NetworkQuality />
        ) : page === 'risk' ? (
          <RiskAnalysis />
        ) : page === 'fingerprint' ? (
          <FingerprintPage />
        ) : page === 'history' ? (
          <History />
        ) : page === 'ai' ? (
          <AiAnalysis />
        ) : page === 'settings' ? (
          <Settings initialSection={settingsSection} />
        ) : page === 'about' ? (
          <Settings initialSection="about" />
        ) : null}
      </AppShell>
    </DetectionProvider>
  )
}
