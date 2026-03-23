import { useEffect, useState } from 'react'
import { getCollections, createCollection } from '../api/client'

const S: Record<string, React.CSSProperties> = {
  page: { padding: '40px 48px', maxWidth: 900 },
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 },
  sub: { color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 32 },
  form: { display: 'flex', gap: 10, marginBottom: 40 },
  btn: {
    padding: '8px 18px', borderRadius: 'var(--radius)', fontSize: 13,
    fontFamily: 'var(--font-ui)', fontWeight: 500, background: 'var(--accent)',
    color: '#000', border: 'none', cursor: 'pointer', flexShrink: 0,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  card: {
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '20px', background: 'var(--bg-2)', cursor: 'default',
    transition: 'border-color 0.15s',
  },
  cardName: { fontWeight: 600, fontSize: 15, marginBottom: 6 },
  cardDesc: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginBottom: 12 },
  cardDate: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' },
}

export default function Collections() {
  const [collections, setCollections] = useState<any[]>([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => getCollections().then(r => setCollections(r.data)).catch(() => {})

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await createCollection(name.trim(), desc.trim())
      setName(''); setDesc('')
      await load()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.h1}>collections</div>
      <div style={S.sub}>knowledge bases · namespaces</div>

      <div style={S.form}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="collection name" style={{ maxWidth: 200 }}
          onKeyDown={e => e.key === 'Enter' && create()} />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="description (optional)"
          onKeyDown={e => e.key === 'Enter' && create()} />
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
