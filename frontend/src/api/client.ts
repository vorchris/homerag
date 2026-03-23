import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

export const api = axios.create({ baseURL: BASE })

export const getHealth = () => api.get('/health')
export const getCollections = () => api.get('/collections')
export const createCollection = (name: string, description = '') =>
  api.post(`/collections?name=${encodeURIComponent(name)}&description=${encodeURIComponent(description)}`)

export const uploadFile = (file: File, collection: string) => {
  const form = new FormData()
  form.append('file', file)
  form.append('collection', collection)
  return api.post('/upload', form)
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
export const updateConfig = (data: Record<string, string>) => api.put('/config', data)
