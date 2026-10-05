import type { JSX, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun
} from 'lucide-react'
import { NAV_BOTTOM, NAV_MAIN, type PageId } from '../navigation'
import { useTheme } from '../hooks/useTheme'
import logo from '../assets/logo.png'

interface AppShellProps {
  page: PageId
  onNavigate: (p: PageId) => void
  children: ReactNode
}

export function AppShell({
  page,
  onNavigate,
  children
}: AppShellProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const { resolved, toggle } = useTheme()
  const contentRef = useRef<HTMLElement>(null)

  // 侧边栏默认折叠状态以设置为准
  useEffect(() => {
    let on = true
    window.ipInsight
      .getSettings()
      .then((r) => {
        if (on) setCollapsed(!!r.settings?.appearance?.sidebarCollapsedByDefault)
      })
      .catch(() => undefined)
    return () => {
      on = false
    }
  }, [])

  // 切换页面时回到内容顶部，避免保留上一页面的滚动位置
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [page])

  const renderItem = (item: (typeof NAV_MAIN)[number]): JSX.Element => (
    <button
      key={item.id}
      className={'nav-item' + (page === item.id ? ' active' : '')}
      onClick={() => onNavigate(item.id)}
    >
      <span className="nav-icon">
        <item.icon size={18} strokeWidth={1.9} />
      </span>
      <span className="nav-label">{item.label}</span>
    </button>
  )

  return (
    <div className={'shell' + (collapsed ? ' collapsed' : '')}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">
            <img src={logo} alt="网鉴" className="brand-logo" />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
            <span className="sidebar-brand-name">IP Insight</span>
            <span className="sidebar-brand-sub">网鉴 · IP 综合检测助手</span>
          </span>
        </div>

        <nav className="sidebar-scroll">
          <div className="sidebar-group">检测</div>
          {NAV_MAIN.map(renderItem)}

          <div style={{ flex: 1, minHeight: 12 }} />

          {NAV_BOTTOM.map(renderItem)}
        </nav>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button
            className="btn-icon"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="折叠导航"
          >
            {collapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="btn-icon"
            onClick={toggle}
            aria-label="切换主题"
          >
            {resolved === 'light' ? <Moon size={19} /> : <Sun size={19} />}
          </button>
        </header>

        <main className="content" ref={contentRef}>
          <div className="content-inner">{children}</div>
        </main>
      </div>
    </div>
  )
}
