import { useState } from 'react'

const S: Record<string, React.CSSProperties> = {
  page: { padding: '40px 48px', maxWidth: 700 },
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 },
  sub: { color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 40 },
  section: { marginBottom: 36 },
  sectionLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 14 },
  row: { display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', gap: 16, marginBottom: 14 },
  label: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' },
  btn: {
    padding: '8px 18px', borderRadius: 'var(--radius)', fontSize: 13,
    fontFamily: 'var(--font-ui)', fontWeight: 500, background: 'var(--accent)',
    color: '#000', border: 'none', cursor: 'pointer', marginTop: 8,
  },
  divider: { borderTop: '1px solid var(--border)', marginBottom: 36 },
  saved: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', marginLeft: 12 },
}

export default function Settings() {
  const [embProvider, setEmbProvider] = useState('local')
  const [embModel, setEmbModel] = useState('all-MiniLM-L6-v2')
  const [apiKey, setApiKey] = useState('')
  const [chunkSize, setChunkSize] = useState('512')
  const [overlap, setOverlap] = useState('64')
  const [authToken, setAuthToken] = useState('')
  const [saved, setSaved] = useState(false)

  const save = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={S.page}>
      <div style={S.h1}>settings</div>
      <div style={S.sub}>configure embedding · chunking · auth</div>

      {/* Embedding */}
      <div style={S.section}>
        <div style={S.sectionLabel}>embedding</div>
        <div style={S.row}>
          <span style={S.label}>provider</span>
          <select value={embProvider} onChange={e => setEmbProvider(e.target.value)}>
            <option value="local">local (sentence-transformers)</option>
            <option value="openai">openai</option>
            <option value="cohere">cohere</option>
          </select>
        </div>
        <div style={S.row}>
          <span style={S.label}>model</span>
          <input value={embModel} onChange={e => setEmbModel(e.target.value)} placeholder="all-MiniLM-L6-v2" />
        </div>
        {embProvider !== 'local' && (
          <div style={S.row}>
            <span style={S.label}>api key</span>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." />
          </div>
        )}
      </div>

      <div style={S.divider} />

      {/* Chunking */}
      <div style={S.section}>
        <div style={S.sectionLabel}>chunking</div>
        <div style={S.row}>
          <span style={S.label}>chunk size</span>
          <input value={chunkSize} onChange={e => setChunkSize(e.target.value)} placeholder="512" />
        </div>
        <div style={S.row}>
          <span style={S.label}>overlap</span>
          <input value={overlap} onChange={e => setOverlap(e.target.value)} placeholder="64" />
        </div>
      </div>

      <div style={S.divider} />

      {/* Auth */}
      <div style={S.section}>
        <div style={S.sectionLabel}>auth</div>
        <div style={S.row}>
          <span style={S.label}>api token</span>
          <input type="password" value={authToken} onChange={e => setAuthToken(e.target.value)} placeholder="changeme" />
        </div>
      </div>

      <button style={S.btn} onClick={save}>save</button>
      {saved && <span style={S.saved}>saved.</span>}
    </div>
  )
}
