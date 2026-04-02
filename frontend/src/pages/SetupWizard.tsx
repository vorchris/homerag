import { useState } from 'react'

const barStyle = (state: 'done' | 'active' | 'idle'): React.CSSProperties => ({
  flex: 1, height: 2, borderRadius: 2,
  background: state === 'done' ? 'var(--accent)' : state === 'active' ? 'var(--border-2)' : 'var(--border)',
  transition: 'background 0.25s',
})

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)',
  },
  card: {
    width: 500, border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '44px 44px 40px', background: 'var(--bg-2)',
  },
  progress: { display: 'flex', gap: 6, marginBottom: 40 },
  stepLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8 },
  h2: { fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 6 },
  desc: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginBottom: 32, lineHeight: 1.6 },
  field: { marginBottom: 18 },
  label: { display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box' as const },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36 },
  btnPrimary: {
    padding: '9px 24px', borderRadius: 'var(--radius)', fontSize: 13,
    fontFamily: 'var(--font-ui)', fontWeight: 500, background: 'var(--accent)',
    color: '#000', border: 'none', cursor: 'pointer',
  },
  btnGhost: {
    padding: '9px 20px', borderRadius: 'var(--radius)', fontSize: 13,
    fontFamily: 'var(--font-mono)', background: 'transparent',
    color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer',
  },
  error: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--danger)', marginTop: 10 },
  tokenBox: {
    background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '12px 14px',
    fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)',
    wordBreak: 'break-all' as const, marginBottom: 10, letterSpacing: 0.5,
    userSelect: 'all' as const,
  },
  copyBtn: {
    padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 11,
    fontFamily: 'var(--font-mono)', background: 'transparent',
    color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer',
  },
  hint: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6 },
  divider: { borderTop: '1px solid var(--border)', margin: '24px 0' },
}

const STEPS = ['account', 'embedding', 'chunking', 'api token']

function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

interface Props {
  onComplete: () => void
}

export default function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Step 0 – Account
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  // Step 1 – Embedding
  const [embProvider, setEmbProvider] = useState('local')
  const [embModel, setEmbModel] = useState('all-MiniLM-L6-v2')
  const [embApiKey, setEmbApiKey] = useState('')

  // Step 2 – Chunking
  const [chunkSize, setChunkSize] = useState('512')
  const [overlap, setOverlap] = useState('64')

  // Step 3 – API Token
  const [token, setToken] = useState(generateToken())

  const next = () => { setError(''); setStep(s => s + 1) }
  const back = () => { setError(''); setStep(s => s - 1) }

  const validateStep = () => {
    if (step === 0) {
      if (!username.trim()) return 'username required'
      if (username.trim().length < 3) return 'username must be at least 3 chars'
      if (password.length < 8) return 'password must be at least 8 characters'
      if (password !== confirm) return 'passwords do not match'
    }
    if (step === 1) {
      if (!embModel.trim()) return 'model name required'
      if (embProvider !== 'local' && !embApiKey.trim()) return 'api key required for this provider'
    }
    if (step === 2) {
      if (isNaN(Number(chunkSize)) || Number(chunkSize) < 64) return 'chunk size must be ≥ 64'
      if (isNaN(Number(overlap)) || Number(overlap) < 0) return 'overlap must be ≥ 0'
    }
    return null
  }

  const handleNext = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    if (step < STEPS.length - 1) next()
  }

  const finish = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          embedding_provider: embProvider,
          embedding_model: embModel.trim(),
          embedding_api_key: embApiKey.trim() || null,
          chunk_size: Number(chunkSize),
          chunk_overlap: Number(overlap),
          api_token: token,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail ?? 'Setup fehlgeschlagen')
      }
      localStorage.setItem('homerag_token', token)
      onComplete()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyToken = () => {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const stepState = (i: number): 'done' | 'active' | 'idle' =>
    i < step ? 'done' : i === step ? 'active' : 'idle'

  return (
    <div style={S.root}>
      <div style={S.card}>
        {/* Progress */}
        <div style={S.progress}>
          {STEPS.map((_, i) => <div key={i} style={barStyle(stepState(i))} />)}
        </div>

        <div style={S.stepLabel}>step {step + 1} / {STEPS.length} — {STEPS[step]}</div>

        {/* ── Step 0: Account ── */}
        {step === 0 && (
          <>
            <div style={S.h2}>create admin account</div>
            <div style={S.desc}>
              this account is used to log into HomeRAG.<br />
              credentials are stored locally and hashed.
            </div>

            <div style={S.field}>
              <label style={S.label}>username</label>
              <input style={S.input} value={username} onChange={e => setUsername(e.target.value)}
                placeholder="admin" autoFocus />
            </div>
            <div style={S.row2}>
              <div style={S.field}>
                <label style={S.label}>password</label>
                <input style={S.input} type="password" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="min. 8 chars" />
              </div>
              <div style={S.field}>
                <label style={S.label}>confirm password</label>
                <input style={S.input} type="password" value={confirm}
                  onChange={e => setConfirm(e.target.value)} placeholder="repeat" />
              </div>
            </div>
          </>
        )}

        {/* ── Step 1: Embedding ── */}
        {step === 1 && (
          <>
            <div style={S.h2}>embedding provider</div>
            <div style={S.desc}>
              choose how documents get vectorized.<br />
              local runs offline, openai/cohere need an api key.
            </div>

            <div style={S.field}>
              <label style={S.label}>provider</label>
              <select style={S.input} value={embProvider} onChange={e => {
                setEmbProvider(e.target.value)
                if (e.target.value === 'openai') setEmbModel('text-embedding-3-small')
                else if (e.target.value === 'cohere') setEmbModel('embed-multilingual-v3.0')
                else setEmbModel('all-MiniLM-L6-v2')
              }}>
                <option value="local">local (sentence-transformers)</option>
                <option value="openai">openai</option>
                <option value="cohere">cohere</option>
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>model</label>
              <input style={S.input} value={embModel} onChange={e => setEmbModel(e.target.value)}
                placeholder="all-MiniLM-L6-v2" />
            </div>
            {embProvider !== 'local' && (
              <div style={S.field}>
                <label style={S.label}>api key</label>
                <input style={S.input} type="password" value={embApiKey}
                  onChange={e => setEmbApiKey(e.target.value)} placeholder="sk-..." />
              </div>
            )}
          </>
        )}

        {/* ── Step 2: Chunking ── */}
        {step === 2 && (
          <>
            <div style={S.h2}>chunking settings</div>
            <div style={S.desc}>
              controls how documents are split before embedding.<br />
              smaller chunks = more precise, larger = more context.
            </div>

            <div style={S.row2}>
              <div style={S.field}>
                <label style={S.label}>chunk size (tokens)</label>
                <input style={S.input} value={chunkSize} onChange={e => setChunkSize(e.target.value)}
                  placeholder="512" />
              </div>
              <div style={S.field}>
                <label style={S.label}>overlap (tokens)</label>
                <input style={S.input} value={overlap} onChange={e => setOverlap(e.target.value)}
                  placeholder="64" />
              </div>
            </div>

            <div style={{ ...S.hint, marginTop: 8 }}>
              recommended: chunk_size 256–1024 · overlap 10–20% of chunk size
            </div>
          </>
        )}

        {/* ── Step 3: API Token ── */}
        {step === 3 && (
          <>
            <div style={S.h2}>api token</div>
            <div style={S.desc}>
              this token is used to authenticate against the HomeRAG API<br />
              and to log in to the web interface. store it somewhere safe.
            </div>

            <div style={S.field}>
              <label style={S.label}>generated token</label>
              <div style={S.tokenBox}>{token}</div>
              <button style={S.copyBtn} onClick={copyToken}>
                {copied ? 'copied ✓' : 'copy to clipboard'}
              </button>
            </div>

            <div style={S.divider} />

            <div style={S.field}>
              <label style={S.label}>or enter your own token</label>
              <input style={S.input} type="password" value={token}
                onChange={e => setToken(e.target.value)} placeholder="custom token..." />
            </div>

            <div style={S.hint}>
              you will need this token every time you log in.<br />
              it can be changed later in settings.
            </div>
          </>
        )}

        {/* Error */}
        {error && <div style={S.error}>⚠ {error}</div>}

        {/* Nav */}
        <div style={S.nav}>
          {step > 0
            ? <button style={S.btnGhost} onClick={back}>back</button>
            : <span />
          }
          {step < STEPS.length - 1
            ? <button style={S.btnPrimary} onClick={handleNext}>continue →</button>
            : <button style={S.btnPrimary} onClick={finish} disabled={loading}>
                {loading ? 'saving...' : 'finish setup'}
              </button>
          }
        </div>
      </div>
    </div>
  )
}