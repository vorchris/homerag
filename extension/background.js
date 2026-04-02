const DEFAULT_SETTINGS = {
  enabled: true,
  apiUrl: 'http://localhost:8000',
  collection: 'default',
  topK: 3,
  threshold: 0.5,
  apiToken: '',
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...stored })
  })
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'QUERY_RAG') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, async (settings) => {
      if (!settings.enabled) {
        sendResponse({ context: null, chunks: [] })
        return
      }

      if (!settings.apiToken) {
        console.warn('HomeRAG: no API token set')
        sendResponse({ context: null, chunks: [], error: 'no_token' })
        return
      }

      try {
        const res = await fetch(`${settings.apiUrl}/api/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiToken}`,
          },
          body: JSON.stringify({
            query: msg.query,
            collection: settings.collection,
            top_k: settings.topK,
          }),
        })

        if (res.status === 401) {
          console.error('HomeRAG: invalid API token')
          sendResponse({ context: null, chunks: [], error: 'unauthorized' })
          return
        }

        const data = await res.json()
        const chunks = data.chunks ?? []
        const filtered = chunks.filter(c => c.score >= settings.threshold)

        sendResponse({ context: data.context, chunks: filtered })
      } catch (e) {
        console.error('HomeRAG background error:', e)
        sendResponse({ context: null, chunks: [] })
      }
    })
    return true
  }

  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, sendResponse)
    return true
  }
})