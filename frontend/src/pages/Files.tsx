import { useEffect, useRef, useState } from 'react'
import { getCollections, uploadFileStream, getFiles, deleteFile } from '../api/client'

const S: Record<string, React.CSSProperties> = {
  page: { padding: '40px 48px', maxWidth: 900 },
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 },
  sub: { color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 32 },
  row: { display: 'flex', gap: 12, marginBottom: 32, alignItems: 'center' },
  select: { width: 180, flexShrink: 0 },
  btn: {
    padding: '8px 18px', borderRadius: 'var(--radius)', fontSize: 13,
    fontFamily: 'var(--font-ui)', fontWeight: 500, cursor: 'pointer',
    background: 'var(--accent)', color: '#000', border: 'none',
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap' as const,
  },
  btnGhost: {
    padding: '6px 12px', borderRadius: 'var(--radius)', fontSize: 12,
    fontFamily: 'var(--font-mono)', cursor: 'pointer',
    background: 'transparent', color: 'var(--danger)',
    border: '1px solid var(--border)', transition: 'all 0.15s',
  },
  dropzone: {
    border: '1px dashed var(--border-2)', borderRadius: 'var(--radius)',
    padding: '40px 24px', textAlign: 'center' as const, cursor: 'pointer',
    color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13,
    marginBottom: 32, transition: 'border-color 0.15s',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase' as const, letterSpacing: 1 },
  td: { padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', borderBottom: '1px solid var(--border)' },
  tag: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-2)' },
}

export default function Files() {
  const [collections, setCollections] = useState<any[]>([])
  const [selected, setSelected] = useState('default')
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number; file?: string; fileIndex?: number; fileCount?: number } | null>(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getCollections().then(r => {
      setCollections(r.data)
      if (r.data.length > 0) setSelected(r.data[0].name)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) return
    getFiles(selected).then(r => setFiles(r.data)).catch(() => setFiles([]))
  }, [selected])

  const uploadFiles = async (toUpload: File[]) => {
    if (!toUpload.length) return
    setLoading(true)
    const errors: string[] = []
    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i]
      setUploadProgress({ done: 0, total: 0, file: file.name, fileIndex: i + 1, fileCount: toUpload.length })
      try {
        await uploadFileStream(file, selected, (done, total) =>
          setUploadProgress({ done, total, file: file.name, fileIndex: i + 1, fileCount: toUpload.length })
        )
      } catch (e: any) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
    const r = await getFiles(selected)
    setFiles(r.data)
    setLoading(false)
    setUploadProgress(null)
    if (errors.length) alert(errors.join('\n'))
  }

  const remove = async (id: string) => {
    if (!confirm('Dokument löschen?')) return
    await deleteFile(id).catch(() => {})
    setFiles(f => f.filter(x => x.id !== id))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) uploadFiles(files)
  }

  return (
    <div style={S.page}>
      <div style={S.h1}>files</div>
      <div style={S.sub}>upload · manage · delete</div>

      <div style={S.row}>
        <select style={S.select} value={selected} onChange={e => setSelected(e.target.value)}>
          {collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          <option value="default">default</option>
        </select>
      </div>

      {/* Dropzone */}
      <div
        style={{ ...S.dropzone, borderColor: drag ? 'var(--accent)' : undefined, color: drag ? 'var(--accent)' : undefined }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        {loading && uploadProgress ? (
          <>
            <div style={{ marginBottom: 10, fontSize: 12 }}>
              {uploadProgress.fileCount && uploadProgress.fileCount > 1
                ? `[${uploadProgress.fileIndex}/${uploadProgress.fileCount}] ${uploadProgress.file} — `
                : ''}
              {uploadProgress.total === 0 ? 'uploading...' : `embedding ${uploadProgress.done} / ${uploadProgress.total} chunks`}
            </div>
            <div style={{ width: '100%', background: 'var(--border)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, background: 'var(--accent)',
                transition: 'width 0.2s ease',
                width: uploadProgress.total > 0
                  ? `${Math.round(uploadProgress.done / uploadProgress.total * 100)}%`
                  : '8%',
              }} />
            </div>
          </>
        ) : (
          <>
            drop files here or click to upload
            <br />
            <span style={{ fontSize: 11, opacity: 0.5 }}>pdf · txt · md · csv · code · config · … (multiple files supported)</span>
          </>
        )}
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }}
          accept=".pdf,.txt,.md,.csv,.rst,.tex,.py,.js,.ts,.jsx,.tsx,.cpp,.cc,.cxx,.c,.h,.hpp,.java,.cs,.go,.rs,.rb,.php,.swift,.kt,.scala,.lua,.r,.sql,.sh,.bash,.zsh,.ps1,.json,.yaml,.yml,.toml,.ini,.conf,.env,.xml,.html,.htm,.css,.scss,.log"
          onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) uploadFiles(files) }} />
      </div>

      {/* Table */}
      {files.length > 0 ? (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>filename</th>
              <th style={S.th}>type</th>
              <th style={S.th}>chunks</th>
              <th style={S.th}>ingested</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => (
              <tr key={f.id}>
                <td style={{ ...S.td, color: 'var(--text)' }}>{f.filename}</td>
                <td style={S.td}><span style={S.tag}>{f.source_type}</span></td>
                <td style={S.td}>{f.chunk_count}</td>
                <td style={S.td}>{new Date(f.ingested_at).toLocaleDateString()}</td>
                <td style={S.td}>
                  <button style={S.btnGhost} onClick={() => remove(f.id)}>delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          no files in this collection yet
        </div>
      )}
    </div>
  )
}
