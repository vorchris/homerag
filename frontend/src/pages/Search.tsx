import { useEffect, useState } from 'react'
import { queryRag, getCollections } from '../api/client'

const S: Record<string, React.CSSProperties> = {
  page: { padding: '40px 48px', maxWidth: 900 },
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 },
  sub: { color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 32 },
  bar: { display: 'flex', gap: 10, marginBottom: 24 },
  btn: {
    padding: '8px 18px', borderRadius: 'var(--radius)', fontSize: 13,
    fontFamily: 'var(--font-ui)', fontWeight: 500, background: 'var(--accent)',
    color: '#000', border: 'none', cursor: 'pointer', flexShrink: 0,
  },
  select: { width: 160, flexShrink: 0 },
  chunk: {
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '16px 20px', marginBottom: 12, background: 'var(--bg-2)',
    transition: 'border-color 0.15s',
  },
  score: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', marginBottom: 8 },
  text: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 },
  meta: { marginTop: 10, display: 'flex', gap: 8 },
  tag: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)' },
  context: {
    border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)',
    padding: '16px 20px', marginBottom: 28, background: 'var(--accent-dim)',
  },
  contextLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 1 },
}

export default function Search() {
  const [collections, setCollections] = useState<any[]>([])
  const [selected, setSelected] = useState('default')
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(5)
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getCollections().then(r => {
      setCollections(r.data)
      if (r.data.length > 0) setSelected(r.data[0].name)
    }).catch(() => {})
  }, [])

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const r = await queryRag(query, selected, topK)
      setResults(r.data)
    } catch (e) {
      alert('Query fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); search() }
  }

  return (
    <div style={S.page}>
      <div style={S.h1}>search</div>
      <div style={S.sub}>semantic · hybrid · retrieval</div>

      <div style={S.bar}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="query your knowledge base..."
        />
        <select style={S.select} value={selected} onChange={e => setSelected(e.target.value)}>
          {collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          <option value="default">default</option>
        </select>
        <select style={{ ...S.select, width: 80 }} value={topK} onChange={e => setTopK(Number(e.target.value))}>
          {[3,5,8,10].map(n => <option key={n} value={n}>top {n}</option>)}
        </select>
        <button style={S.btn} onClick={search} disabled={loading}>
          {loading ? '...' : 'search'}
        </button>
      </div>

      {results && (
        <>
          {/* Context block */}
          <div style={S.context}>
            <div style={S.contextLabel}>context (injected into llm)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {results.context || '—'}
            </div>
          </div>

          {/* Chunks */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            {results.chunks.length} chunks found
          </div>
          {results.chunks.map((c: any, i: number) => (
            <div key={i} style={S.chunk}>
              <div style={S.score}>score: {c.score.toFixed(4)}</div>
              <div style={S.text}>{c.text}</div>
              <div style={S.meta}>
                <span style={S.tag}>{c.payload?.filename ?? c.payload?.url ?? '—'}</span>
                <span style={S.tag}>chunk {c.payload?.chunk_index ?? i}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {results && results.chunks.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          no results found
        </div>
      )}
    </div>
  )
}
