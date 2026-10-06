import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import App from './App'
import { LangProvider } from './i18n'
import './styles.css'

// 浏览器预览（Demo 模式）：无 Electron preload 注入时安装样例 API，
// 数据均为文档保留地址（203.0.113.x / 198.51.100.x / AS64512），仅用于界面预览。
async function bootstrap(): Promise<void> {
  if (!window.ipInsight) {
    const m = await import('./demo/mock')
    m.install()
  }
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <LangProvider>
        <App />
      </LangProvider>
    </React.StrictMode>
  )
}

void bootstrap()
