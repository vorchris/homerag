const $ = id => document.getElementById(id)

async function checkHealth(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/api/health`)
    return res.ok
  } catch { return false }
}

async function loadCollections(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/api/collections`)
    return await res.json()
  } catch { return [] }
}

async function init() {
  const settings = await new Promise(r =>
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, r)
  )

  $('enabled').checked = settings.enabled
  $('topK').value = settings.topK
  $('threshold').value = settings.threshold
  $('apiUrl').value = settings.apiUrl

  // Status check
  const online = await checkHealth(settings.apiUrl)
  $('dot').className = `dot ${online ? 'online' : 'offline'}`
  $('status-text').textContent = online ? 'online' : 'offline'

  // Collections laden
  const collections = await loadCollections(settings.apiUrl)
  const sel = $('collection')
  sel.innerHTML = '<option value="default">default</option>'
  collections.forEach(c => {
    const opt = document.createElement('option')
    opt.value = c.name
    opt.textContent = c.name
    if (c.name === settings.collection) opt.selected = true
    sel.appendChild(opt)
  })

  // Save
  $('save').addEventListener('click', () => {
    chrome.storage.sync.set({
      enabled: $('enabled').checked,
      collection: $('collection').value,
      topK: parseInt($('topK').value),
      threshold: parseFloat($('threshold').value),
      apiUrl: $('apiUrl').value,
    }, () => {
      $('saved-msg').textContent = 'saved.'
      setTimeout(() => $('saved-msg').textContent = '', 1500)
    })
  })
}

init()