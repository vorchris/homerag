import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getHealth } from '../api/client'

const NAV = [
  { path: '/files',       label: 'files' },
  { path: '/search',      label: 'search' },
  { path: '/collections', label: 'collections' },
  { path: '/settings',    label: 'settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false))
    const iv = setInterval(() => {
      getHealth().then(() => setOnline(true)).catch(() => setOnline(false))
    }, 10000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 200,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 0',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '0 24px 32px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)', letterSpacing: 2, textTransform: 'uppercase' }}>home</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: -1 }}>RAG</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {NAV.map(({ path, label }) => (
            <NavLink key={path} to={path} style={({ isActive }) => ({
              display: 'block',
              padding: '9px 24px',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: isActive ? 'var(--accent)' : 'var(--text-2)',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              transition: 'all 0.1s',
            })}>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Status */}
        <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: online === null ? 'var(--text-3)' : online ? 'var(--accent)' : 'var(--danger)',
            boxShadow: online ? '0 0 6px var(--accent)' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
            {online === null ? 'checking' : online ? 'online' : 'offline'}
          </span>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
