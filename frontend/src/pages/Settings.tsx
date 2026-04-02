import { useEffect, useState } from 'react'
import { getConfig, updateConfig } from '../api/client'

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
  error: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--danger)', marginLeft: 12 },
  warning: {
    marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius)',
    border: '1px solid #7a5c00', background: '#1a1400',
    fontFamily: 'var(--font-mono)', fontSize: 11, color: '#f5c400', lineHeight: 1.5,
  },
}

export default function Settings() {
  const [embProvider, setEmbProvider] = useState('local')
  const [embModel, setEmbModel] = useState('all-MiniLM-L6-v2')
  const [apiKey, setApiKey] = useState('')
  const [chunkSize, setChunkSize] = useState('512')
  const [overlap, setOverlap] = useState('64')
  const [authToken, setAuthToken] = useState('')
  const [savedProvider, setSavedProvider] = useState('local')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getConfig().then(r => {
      const d = r.data
      setEmbProvider(d.embedding_provider ?? 'local')
      setSavedProvider(d.embedding_provider ?? 'local')
      setEmbModel(d.embedding_model ?? 'all-MiniLM-L6-v2')
      setApiKey(d.embedding_api_key ?? '')
      setChunkSize(String(d.chunk_size ?? 512))
      setOverlap(String(d.chunk_overlap ?? 64))
      setAuthToken(d.api_token ?? '')
    }).catch(() => {})
  }, [])

  const save = async () => {
    setError('')
    try {
      await updateConfig({
        embedding_provider: embProvider,
        embedding_model: embModel,
        embedding_api_key: apiKey,
        chunk_size: chunkSize,
        chunk_overlap: overlap,
        api_token: authToken,
      })
      setSavedProvider(embProvider)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Save failed')
    }
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
          </select>
        </div>
        <div style={S.row}>
          <span style={S.label}>model</span>
          <input
            value={embModel}
            onChange={e => setEmbModel(e.target.value)}
            placeholder={embProvider === 'openai' ? 'text-embedding-3-small' : 'all-MiniLM-L6-v2'}
          />
        </div>
        {embProvider !== 'local' && (
          <div style={S.row}>
            <span style={S.label}>api key</span>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." />
          </div>
        )}
        {embProvider !== savedProvider && (
          <div style={S.warning}>
            ⚠ Changing the embedding model only affects new collections.<br />
            Existing collections keep their locked model. To switch an existing collection,
            delete all its files and re-upload them.
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
      {error && <span style={S.error}>{error}</span>}
    </div>
  )
}
