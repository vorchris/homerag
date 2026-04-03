const $ = id => document.getElementById(id)

const DEFAULT_SETTINGS = {
  enabled: true,
  apiUrl: 'http://localhost:8000',
  collection: 'default',
  topK: 3,
  threshold: 0.5,
  apiToken: '',
}

function sendMsg(type, payload = {}) {
  return new Promise(r => chrome.runtime.sendMessage({ type, ...payload }, r))
}

async function checkHealth() {
  const res = await sendMsg('CHECK_HEALTH')
  return res?.ok ?? false
}

async function loadCollections() {
  const res = await sendMsg('GET_COLLECTIONS')
  return res?.collections ?? []
}

function showSaved(id) {
  $(id).textContent = 'saved.'
  setTimeout(() => $(id).textContent = '', 1500)
}

async function init() {
  const settings = await new Promise(r =>
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, r)
  )

  // ── Main tab ───────────────────────────────────────────
  $('enabled').checked = settings.enabled
  $('threshold').value = settings.threshold
  $('threshold-display').textContent = parseFloat(settings.threshold).toFixed(2)

  $('threshold').addEventListener('input', () => {
    $('threshold-display').textContent = parseFloat($('threshold').value).toFixed(2)
  })

  // Status
  const online = await checkHealth()
  $('dot').className = `dot ${online ? 'online' : 'offline'}`
  $('status-text').textContent = online ? 'online' : 'offline'

  // Collections
  const collections = await loadCollections()
  const sel = $('collection')
  sel.innerHTML = '<option value="default">default</option>'
  collections.forEach(c => {
    if (c.name === 'default') return
    const opt = document.createElement('option')
    opt.value = c.name
    opt.textContent = c.name
    if (c.name === settings.collection) opt.selected = true
    sel.appendChild(opt)
  })
  if (settings.collection !== 'default') {
    sel.value = settings.collection
  }

  // ── Settings tab ──────────────────────────────────────
  $('apiUrl').value = settings.apiUrl
  $('apiToken').value = settings.apiToken

  let topK = settings.topK
  $('topK').value = topK
  $('topk-display').textContent = topK

  $('topk-up').addEventListener('click', () => {
    if (topK >= 10) return
    topK++
    $('topK').value = topK
    $('topk-display').textContent = topK
  })
  $('topk-down').addEventListener('click', () => {
    if (topK <= 1) return
    topK--
    $('topK').value = topK
    $('topk-display').textContent = topK
  })

  // Token visibility toggle
  $('toggle-token').addEventListener('click', () => {
    const inp = $('apiToken')
    inp.type = inp.type === 'password' ? 'text' : 'password'
  })

  // ── Tabs ──────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'))
      btn.classList.add('active')
      $(`tab-${btn.dataset.tab}`).classList.add('active')
    })
  })

  // ── Save: main ────────────────────────────────────────
  $('save-main').addEventListener('click', () => {
    chrome.storage.sync.set({
      enabled: $('enabled').checked,
      collection: $('collection').value,
      threshold: parseFloat($('threshold').value),
    }, () => showSaved('saved-msg-main'))
  })

  // ── Save: settings ────────────────────────────────────
  $('save-settings').addEventListener('click', () => {
    chrome.storage.sync.set({
      apiUrl: $('apiUrl').value.trim(),
      apiToken: $('apiToken').value.trim(),
      topK: parseInt($('topK').value),
    }, () => showSaved('saved-msg-settings'))
  })
}

init()
