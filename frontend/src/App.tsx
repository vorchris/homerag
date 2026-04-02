import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import Files from './pages/Files'
import Search from './pages/Search'
import Collections from './pages/Collections'
import Settings from './pages/Settings'
import Login from './pages/Login'
import SetupWizard from './pages/SetupWizard'
import './styles/globals.css'

type AppState = 'loading' | 'setup' | 'login' | 'app'

export default function App() {
  const [state, setState] = useState<AppState>('loading')

  const init = async () => {
    try {
      const status = await fetch('/api/setup/status')
      if (status.ok) {
        const d = await status.json()
        if (!d.configured) { setState('setup'); return }
      }
    } catch {}

    // Check for existing session (cookie-based)
    try {
      const me = await fetch('/api/auth/me')
      if (me.ok) { setState('app'); return }
    } catch {}

    setState('login')
  }

  useEffect(() => { init() }, [])

  if (state === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)',
      }}>
        loading...
      </div>
    )
  }

  if (state === 'setup') return <SetupWizard onComplete={() => setState('login')} />
  if (state === 'login') return <Login onLogin={() => setState('app')} onSetup={() => setState('setup')} />

  return (
    <BrowserRouter>
      <Layout onLogout={async () => { await fetch('/api/auth/logout', { method: 'POST' }); setState('login') }}>
        <Routes>
          <Route path="/" element={<Navigate to="/files" replace />} />
          <Route path="/files" element={<Files />} />
          <Route path="/search" element={<Search />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}