import { useEffect, useState } from 'react'
import { getCollections, createCollection, reembedCollection } from '../api/client'

const PROVIDER_DEFAULTS: Record<string, string> = {
  local: 'all-MiniLM-L6-v2',
  openai: 'text-embedding-3-small',
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '40px 48px', maxWidth: 900 },
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 },
  sub: { color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 32 },
  form: { display: 'flex', gap: 10, marginBottom: 40, flexWrap: 'wrap' as const, alignItems: 'flex-end' },
  formGroup: { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  formLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: 1 },
  btn: {
    padding: '8px 18px', borderRadius: 'var(--radius)', fontSize: 13,
    fontFamily: 'var(--font-ui)', fontWeight: 500, background: 'var(--accent)',
    color: '#000', border: 'none', cursor: 'pointer', flexShrink: 0, height: 36,
  },
  btnGhost: {
    padding: '4px 10px', borderRadius: 'var(--radius)', fontSize: 11,
    fontFamily: 'var(--font-mono)', cursor: 'pointer',
    background: 'transparent', color: 'var(--text-3)',
    border: '1px solid var(--border)', transition: 'all 0.15s',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 },
  card: {
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '20px', background: 'var(--bg-2)',
    transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column' as const, gap: 4,
  },
  cardName: { fontWeight: 600, fontSize: 15, marginBottom: 2 },
  cardDesc: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' },
  cardDate: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 4 },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  badge: {
    padding: '2px 8px', borderRadius: 4, background: 'var(--bg-3)',
    border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
    fontSize: 10, color: 'var(--accent)',
  },
  badgeEmpty: {
    padding: '2px 8px', borderRadius: 4, background: 'var(--bg-3)',
    border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
    fontSize: 10, color: 'var(--text-3)',
  },
}

export default function Collections() {
  const [collections, setCollections] = useState<any[]>([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [provider, setProvider] = useState('local')
  const [model, setModel] = useState(PROVIDER_DEFAULTS.local)
  const [loading, setLoading] = useState(false)
  const [reembedding, setReembedding] = useState<string | null>(null)

  const load = () => getCollections().then(r => setCollections(r.data)).catch(() => {})

  useEffect(() => { load() }, [])

  const onProviderChange = (p: string) => {
    setProvider(p)
    setModel(PROVIDER_DEFAULTS[p] ?? '')
  }

  const create = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await createCollection(name.trim(), desc.trim(), provider, model)
      setName(''); setDesc('')
      await load()
    } finally {
      setLoading(false)
    }
  }

  const reembed = async (colName: string) => {
    if (!confirm(`Re-embed all chunks in "${colName}" with its locked model?\nThis may take a while.`)) return
    setReembedding(colName)
    try {
      const r = await reembedCollection(colName)
      alert(`Done. Re-embedded ${r.data.reembedded} chunks.`)
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Re-embed failed')
    } finally {
      setReembedding(null)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.h1}>collections</div>
      <div style={S.sub}>knowledge bases · namespaces</div>

      <div style={S.form}>
        <div style={S.formGroup}>
          <span style={S.formLabel}>name</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="my-collection"
            style={{ width: 180 }} onKeyDown={e => e.key === 'Enter' && create()} />
        </div>
        <div style={S.formGroup}>
          <span style={S.formLabel}>description</span>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="optional"
            style={{ width: 160 }} onKeyDown={e => e.key === 'Enter' && create()} />
        </div>
        <div style={S.formGroup}>
          <span style={S.formLabel}>embedding</span>
          <select value={provider} onChange={e => onProviderChange(e.target.value)} style={{ width: 100 }}>
            <option value="local">local</option>
            <option value="openai">openai</option>
          </select>
        </div>
        <div style={S.formGroup}>
          <span style={S.formLabel}>model</span>
          <input value={model} onChange={e => setModel(e.target.value)} placeholder="model name"
            style={{ width: 200 }} />
        </div>
        <button style={S.btn} onClick={create} disabled={loading || !name.trim()}>
          {loading ? '...' : 'create'}
        </button>
      </div>

      <div style={S.grid}>
        {collections.map(c => (
          <div key={c.id} style={S.card}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
            <div style={S.cardName}>{c.name}</div>
            <div style={S.cardDesc}>{c.description || 'no description'}</div>
            <div style={S.cardDate}>{new Date(c.created_at).toLocaleDateString()}</div>
            <div style={S.cardFooter}>
              {c.embedding_model
                ? <span style={S.badge}>{c.embedding_provider} · {c.embedding_model}</span>
                : <span style={S.badgeEmpty}>no model yet</span>
              }
              {c.embedding_model && (
                <button
                  style={S.btnGhost}
                  disabled={reembedding === c.name}
                  onClick={() => reembed(c.name)}
                >
                  {reembedding === c.name ? '...' : 're-embed'}
                </button>
              )}
            </div>
          </div>
        ))}
        {collections.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            no collections yet
          </div>
        )}
      </div>
    </div>
  )
}
