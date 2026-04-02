import { useEffect, useState } from 'react'
import { getCollections, createCollection, reembedCollectionStream } from '../api/client'

const PROVIDER_DEFAULTS: Record<string, string> = {
  local: 'all-MiniLM-L6-v2',
  openai: 'text-embedding-3-small',
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '40px 48px', maxWidth: 900 },
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 },
  sub: { color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 32 },
  form: { display: 'flex', gap: 10, marginBottom: 40, alignItems: 'center' },
  btn: {
    padding: '8px 18px', borderRadius: 'var(--radius)', fontSize: 13,
    fontFamily: 'var(--font-ui)', fontWeight: 500, background: 'var(--accent)',
    color: '#000', border: 'none', cursor: 'pointer', flexShrink: 0,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 },
  card: {
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '20px', background: 'var(--bg-2)', transition: 'border-color 0.15s',
  },
  cardName: { fontWeight: 600, fontSize: 15, marginBottom: 4 },
  cardDesc: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginBottom: 12 },
  divider: { borderTop: '1px solid var(--border)', margin: '12px 0' },
  modelRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const },
  modelLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: 1, textTransform: 'uppercase' as const, marginRight: 2 },
  select: { fontSize: 11, padding: '3px 6px', fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', cursor: 'pointer' },
  modelInput: { fontSize: 11, padding: '3px 6px', fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', width: 160 },
  reembedBtn: {
    padding: '3px 10px', borderRadius: 4, fontSize: 10,
    fontFamily: 'var(--font-mono)', cursor: 'pointer',
    background: 'var(--accent)', color: '#000', border: 'none',
    letterSpacing: 0.5, transition: 'opacity 0.15s', marginLeft: 'auto',
  },
  progressWrap: { marginTop: 10, background: 'var(--bg-3)', borderRadius: 4, height: 4, overflow: 'hidden' },
  progressBar: { height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.2s ease' },
  progressLabel: { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 4, letterSpacing: 0.5 },
  cardDate: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 8 },
}

export default function Collections() {
  const [collections, setCollections] = useState<any[]>([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  // per-card model editing state
  const [cardModels, setCardModels] = useState<Record<string, { provider: string, model: string }>>({})
  const [reembedding, setReembedding] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const load = async () => {
    const r = await getCollections().catch(() => ({ data: [] }))
    setCollections(r.data)
    const init: Record<string, { provider: string, model: string }> = {}
    r.data.forEach((c: any) => {
      init[c.name] = {
        provider: c.embedding_provider || 'local',
        model: c.embedding_model || PROVIDER_DEFAULTS.local,
      }
    })
    setCardModels(init)
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await createCollection(name.trim(), desc.trim())
      setName(''); setDesc('')
      await load()
    } finally { setLoading(false) }
  }

  const updateCardModel = (colName: string, field: 'provider' | 'model', value: string) => {
    setCardModels(prev => {
      const next = { ...prev[colName], [field]: value }
      if (field === 'provider') next.model = PROVIDER_DEFAULTS[value] ?? ''
      return { ...prev, [colName]: next }
    })
  }

  const reembed = async (col: any) => {
    const m = cardModels[col.name]
    const changed = m.provider !== col.embedding_provider || m.model !== col.embedding_model
    const msg = changed
      ? `Switch "${col.name}" to ${m.provider} · ${m.model} and re-embed all chunks?`
      : `Re-embed all chunks in "${col.name}" with the current model?`
    if (!confirm(msg)) return

    setReembedding(col.name)
    setProgress({ done: 0, total: 0 })
    try {
      await reembedCollectionStream(
        col.name,
        (done, total) => setProgress({ done, total }),
        changed ? m.provider : undefined,
        changed ? m.model : undefined,
      )
      await load()
    } catch (e: any) {
      alert(e instanceof Error ? e.message : 'Re-embed failed')
    } finally {
      setReembedding(null)
      setProgress(null)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.h1}>collections</div>
      <div style={S.sub}>knowledge bases · namespaces</div>

      <div style={S.form}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="collection name"
          style={{ maxWidth: 200 }} onKeyDown={e => e.key === 'Enter' && create()} />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="description (optional)"
          onKeyDown={e => e.key === 'Enter' && create()} />
        <button style={S.btn} onClick={create} disabled={loading || !name.trim()}>
          {loading ? '...' : 'create'}
        </button>
      </div>

      <div style={S.grid}>
        {collections.map(c => {
          const cm = cardModels[c.name] ?? { provider: 'local', model: PROVIDER_DEFAULTS.local }
          const isDirty = cm.provider !== (c.embedding_provider || 'local') || cm.model !== (c.embedding_model || PROVIDER_DEFAULTS.local)
          return (
            <div key={c.id} style={S.card}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={S.cardName}>{c.name}</div>
              <div style={S.cardDesc}>{c.description || 'no description'}</div>

              <div style={S.divider} />

              <div style={S.modelRow}>
                <span style={S.modelLabel}>model</span>
                <select style={S.select} value={cm.provider} onChange={e => updateCardModel(c.name, 'provider', e.target.value)}>
                  <option value="local">local</option>
                  <option value="openai">openai</option>
                </select>
                <input style={S.modelInput} value={cm.model} onChange={e => updateCardModel(c.name, 'model', e.target.value)} />
                <button
                  style={{ ...S.reembedBtn, opacity: reembedding === c.name ? 0.5 : 1 }}
                  disabled={reembedding === c.name}
                  onClick={() => reembed(c)}
                  title={isDirty ? 'Switch model & re-embed' : 'Re-embed with current model'}
                >
                  {reembedding === c.name ? '...' : isDirty ? 'apply' : 're-embed'}
                </button>
              </div>

              {reembedding === c.name && progress && (
                <>
                  <div style={S.progressWrap}>
                    <div style={{
                      ...S.progressBar,
                      width: progress.total > 0 ? `${Math.round(progress.done / progress.total * 100)}%` : '5%',
                    }} />
                  </div>
                  <div style={S.progressLabel}>
                    {progress.total > 0
                      ? `${progress.done} / ${progress.total} chunks`
                      : 'starting...'}
                  </div>
                </>
              )}

              <div style={S.cardDate}>{new Date(c.created_at).toLocaleDateString()}</div>
            </div>
          )
        })}
        {collections.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            no collections yet
          </div>
        )}
      </div>
    </div>
  )
}
