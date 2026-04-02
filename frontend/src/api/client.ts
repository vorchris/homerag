import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

export const api = axios.create({ baseURL: BASE, withCredentials: true })

export const getHealth = () => api.get('/health')
export const getCollections = () => api.get('/collections')
export const createCollection = (name: string, description = '', embedding_provider = 'local', embedding_model = '') =>
  api.post('/collections', { name, description, embedding_provider, embedding_model })
export const reembedCollectionStream = (
  name: string,
  onProgress: (done: number, total: number) => void,
  embedding_provider?: string,
  embedding_model?: string,
): Promise<void> => {
  const base = (import.meta.env.VITE_API_URL ?? '/api')
  return fetch(`${base}/collections/${encodeURIComponent(name)}/reembed`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embedding_provider, embedding_model }),
  }).then(res => {
    if (!res.ok) return res.json().then(d => Promise.reject(new Error(d.detail ?? 'Failed')))
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    const read = (): Promise<void> => reader.read().then(({ done, value }) => {
      if (done) return
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = JSON.parse(line.slice(6))
        if (payload.done === true) return
        onProgress(payload.done, payload.total)
      }
      return read()
    })
    return read()
  })
}

export const uploadFileStream = (
  file: File,
  collection: string,
  onProgress: (done: number, total: number) => void,
): Promise<{ document_id: string }> => {
  const base = import.meta.env.VITE_API_URL ?? '/api'
  const form = new FormData()
  form.append('file', file)
  form.append('collection', collection)

  return fetch(`${base}/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  }).then(res => {
    if (!res.ok) return res.json().then(d => Promise.reject(new Error(d.detail ?? 'Upload failed')))
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let result: { document_id: string } = { document_id: '' }

    const read = (): Promise<{ document_id: string }> => reader.read().then(({ done, value }) => {
      if (done) return result
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = JSON.parse(line.slice(6))
        if (payload.stage === 'error') return Promise.reject(new Error(payload.detail))
        if (payload.stage === 'done') { result = { document_id: payload.document_id }; return result }
        if (payload.stage === 'embedding') onProgress(payload.done, payload.total)
      }
      return read()
    })
    return read()
  })
}

export const uploadUrl = (url: string, collection: string) =>
  api.post(`/upload/url?url=${encodeURIComponent(url)}&collection=${encodeURIComponent(collection)}`)

export const queryRag = (query: string, collection: string, top_k = 5) =>
  api.post('/query', { query, collection, top_k })

export const getFiles = (collection: string) =>
  api.get(`/files?collection=${encodeURIComponent(collection)}`)

export const deleteFile = (id: string) =>
  api.delete(`/files/${id}`)

export const getConfig = () => api.get('/config')
export const updateConfig = (data: Record<string, string | number>) => api.put('/config', data)
