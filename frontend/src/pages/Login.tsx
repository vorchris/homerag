import { useState } from 'react'
 
const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)',
  },
  card: {
    width: 340, border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '40px 36px', background: 'var(--bg-2)',
  },
  logo: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 },
  sub: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginBottom: 32 },
  field: { marginBottom: 16 },
  label: {
    display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10,
    color: 'var(--text-3)', textTransform: 'uppercase' as const,
    letterSpacing: 1.5, marginBottom: 6,
  },
  input: { width: '100%', boxSizing: 'border-box' as const },
  btn: {
    width: '100%', padding: '9px', borderRadius: 'var(--radius)', fontSize: 13,
    fontFamily: 'var(--font-ui)', fontWeight: 500, background: 'var(--accent)',
    color: '#000', border: 'none', cursor: 'pointer', marginTop: 8,
  },
  error: {
    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--danger)',
    marginTop: 12, textAlign: 'center' as const,
  },
  setupLink: {
    marginTop: 24, textAlign: 'center' as const,
    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)',
  },
  link: { cursor: 'pointer', color: 'var(--text-2)', textDecoration: 'underline' },
}
 
interface Props {
  onLogin: () => void
  onSetup?: () => void
}
 
export default function Login({ onLogin, onSetup }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
 
  const submit = async () => {
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      if (res.ok) {
        onLogin()
      } else {
        setError('invalid credentials')
      }
    } catch {
      setError('server not reachable')
    } finally {
      setLoading(false)
    }
  }
 
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit() }
 
  return (
    <div style={S.root}>
      <div style={S.card}>
        <div style={S.logo}>HomeRAG</div>
        <div style={S.sub}>local retrieval-augmented generation</div>
 
        <div style={S.field}>
          <label style={S.label}>username</label>
          <input style={S.input} value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={onKey} placeholder="admin" autoFocus />
        </div>
        <div style={S.field}>
          <label style={S.label}>password</label>
          <input style={S.input} type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={onKey} placeholder="••••••••" />
        </div>
 
        <button style={S.btn} onClick={submit}
          disabled={loading || !username.trim() || !password}>
          {loading ? '...' : 'sign in'}
        </button>
 
        {error && <div style={S.error}>{error}</div>}
 
        {onSetup && (
          <div style={S.setupLink}>
            first time? <span style={S.link} onClick={onSetup}>run setup wizard</span>
          </div>
        )}
      </div>
    </div>
  )
}