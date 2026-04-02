(function () {
  let suggestions = []
  let selected = new Set()
  let barEl = null
  let lastQuery = ''
  let injecting = false
  let debounceTimer = null
  let pendingBadge = null

  function isExtensionValid() {
    try { return !!chrome.runtime?.id } catch { return false }
  }

  async function fetchSuggestions(query) {
    if (!isExtensionValid()) return []
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'QUERY_RAG', query }, (res) => {
          if (chrome.runtime.lastError) { resolve([]); return }
          resolve(res?.chunks ?? [])
        })
      } catch { resolve([]) }
    })
  }

  function groupByFile(chunks) {
    const map = new Map()
    chunks.forEach((chunk) => {
      const key = chunk.payload?.filename ?? chunk.payload?.url ?? 'unknown'
      if (!map.has(key)) map.set(key, { filename: key, score: chunk.score, chunks: [] })
      const e = map.get(key)
      e.chunks.push(chunk)
      if (chunk.score > e.score) e.score = chunk.score
    })
    return Array.from(map.values())
  }

  function getSendButton() {
    return (
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button[aria-label="Nachricht senden"]') ||
      document.querySelector('button[aria-label="Senden"]') ||
      [...document.querySelectorAll('button')].find(b => b.querySelector('.send-icon'))
    )
  }

  function getVisiblePromptEl() {
    const candidates = [
      ...document.querySelectorAll('rich-textarea .ql-editor[contenteditable="true"]'),
      ...document.querySelectorAll('div.ql-editor[contenteditable="true"]'),
      ...document.querySelectorAll('.initial-input-area-container textarea'),
      ...document.querySelectorAll('textarea[placeholder]'),
    ]
    return candidates.find(el => {
      const s = window.getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0
    }) ?? null
  }

  function getPromptText() {
    const el = getVisiblePromptEl()
    if (!el) return ''
    return (el.tagName === 'TEXTAREA' ? el.value : (el.innerText || el.textContent || '')).trim()
  }

  function setPromptText(value) {
    const el = getVisiblePromptEl()
    if (!el) return false
    el.focus()
    if (el.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      document.execCommand('selectAll', false, null)
      document.execCommand('insertText', false, value)
    }
    return true
  }

  // ─── Styles ──────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('homerag-styles')) return
    const style = document.createElement('style')
    style.id = 'homerag-styles'
    style.textContent = `
      #homerag-bar {
        position: fixed; left: 0; right: 0; z-index: 99999;
        background: #111; border-top: 1px solid #1e1e1e; border-bottom: 1px solid #1e1e1e;
        padding: 6px 12px; display: none; flex-direction: column; gap: 0;
        font-family: 'DM Mono', monospace, sans-serif; font-size: 11px; box-sizing: border-box;
      }
      #homerag-bar.visible { display: flex; }
      .homerag-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
      .homerag-label { color: #444; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; }
      .homerag-actions { display: flex; gap: 10px; align-items: center; }
      .homerag-action-btn {
        color: #444; cursor: pointer; font-size: 9px; letter-spacing: 1px;
        text-transform: uppercase; background: none; border: none; padding: 0;
        font-family: inherit; transition: color 0.1s;
      }
      .homerag-action-btn:hover { color: #888; }
      .homerag-close-btn { color: #333; cursor: pointer; font-size: 16px; line-height: 1; margin-left: 6px; transition: color 0.1s; }
      .homerag-close-btn:hover { color: #666; }
      .homerag-files { display: flex; flex-direction: row; gap: 6px; flex-wrap: wrap; }
      .homerag-file-chip {
        display: flex; align-items: center; gap: 6px; padding: 4px 10px;
        border-radius: 20px; cursor: pointer; border: 1px solid #222;
        background: transparent; transition: all 0.1s; max-width: 220px;
        white-space: nowrap; overflow: hidden;
      }
      .homerag-file-chip:hover { border-color: #333; background: #1a1a1a; }
      .homerag-file-chip.selected { border-color: #00e5b0; background: #0a1f19; }
      .homerag-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: #333; flex-shrink: 0; transition: background 0.1s; }
      .homerag-file-chip.selected .homerag-chip-dot { background: #00e5b0; }
      .homerag-chip-name { color: #888; font-size: 11px; overflow: hidden; text-overflow: ellipsis; transition: color 0.1s; }
      .homerag-file-chip.selected .homerag-chip-name { color: #ccc; }
      .homerag-chip-score { color: #333; font-size: 9px; flex-shrink: 0; transition: color 0.1s; }
      .homerag-file-chip.selected .homerag-chip-score { color: #00e5b0; }
      .homerag-msg-badge { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 5px; }
      .homerag-msg-chip { font-family: 'DM Mono', monospace; font-size: 9px; color: #00e5b0; background: #0a1f19; border: 1px solid rgba(0,229,176,0.25); border-radius: 10px; padding: 2px 7px; letter-spacing: 0.4px; white-space: nowrap; }
    `
    document.head.appendChild(style)
  }

  // ─── Bar (position: fixed, anchored just above input) ────
  function ensureBar() {
    if (barEl && document.body.contains(barEl)) return
    injectStyles()
    barEl = document.createElement('div')
    barEl.id = 'homerag-bar'
    document.body.appendChild(barEl)
  }

  function updateBarPosition() {
    if (!barEl) return
    const promptEl = getVisiblePromptEl()
    if (!promptEl) { barEl.style.bottom = '80px'; return }

    // Walk up to find the top of the input container
    let topY = promptEl.getBoundingClientRect().top
    let el = promptEl.parentElement
    for (let i = 0; i < 10 && el && el !== document.body; i++) {
      const rect = el.getBoundingClientRect()
      const pos = window.getComputedStyle(el).position
      if (pos === 'sticky' || pos === 'fixed') { topY = rect.top; break }
      if (rect.width > window.innerWidth * 0.5 && rect.top > window.innerHeight * 0.4) topY = rect.top
      el = el.parentElement
    }
    barEl.style.bottom = (window.innerHeight - topY) + 'px'
    barEl.style.top = 'auto'
  }

  function renderBar() {
    ensureBar()
    const files = groupByFile(suggestions)
    if (files.length === 0) { barEl.classList.remove('visible'); return }
    barEl.classList.add('visible')
    barEl.innerHTML = `
      <div class="homerag-header">
        <span class="homerag-label">homerag</span>
        <div class="homerag-actions">
          <button class="homerag-action-btn" id="homerag-all">all</button>
          <button class="homerag-action-btn" id="homerag-none">none</button>
          <span class="homerag-close-btn" id="homerag-close">×</span>
        </div>
      </div>
      <div class="homerag-files">
        ${files.map((file, i) => `
          <div class="homerag-file-chip ${selected.has(i) ? 'selected' : ''}" data-index="${i}">
            <div class="homerag-chip-dot"></div>
            <span class="homerag-chip-name">${file.filename.split('/').pop()}</span>
            <span class="homerag-chip-score">${(file.score * 100).toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>
    `
    requestAnimationFrame(updateBarPosition)
    document.getElementById('homerag-close').onclick = () => { suggestions = []; selected.clear(); renderBar() }
    document.getElementById('homerag-all').onclick = () => { files.forEach((_, i) => selected.add(i)); renderBar() }
    document.getElementById('homerag-none').onclick = () => { selected.clear(); renderBar() }
    barEl.querySelectorAll('.homerag-file-chip').forEach(chip => {
      chip.onclick = () => {
        const i = parseInt(chip.dataset.index, 10)
        selected.has(i) ? selected.delete(i) : selected.add(i)
        renderBar()
      }
    })
  }

  // ─── Hide context + show badge above message ─────────────
  function hideContextInMessages() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    let node
    const candidates = []
    while ((node = walker.nextNode())) {
      if (node.dataset?.homeragCleaned) continue
      if (node.closest('rich-textarea, [contenteditable="true"], textarea')) continue
      const t = node.textContent || ''
      if (t.includes('<context>') && t.includes('</context>')) candidates.push(node)
    }
    if (!candidates.length) return

    candidates.sort((a, b) => (a.textContent?.length || 0) - (b.textContent?.length || 0))
    const done = new Set()
    for (const el of candidates) {
      let skip = false
      let p = el.parentElement
      while (p) { if (done.has(p)) { skip = true; break } p = p.parentElement }
      if (skip) continue

      el.dataset.homeragCleaned = '1'
      done.add(el)

      const text = el.textContent || ''
      const end = text.indexOf('</context>')
      if (end === -1) continue
      const realQuestion = text.slice(end + '</context>'.length).replace(/^\s+/, '').trim()
      if (!realQuestion) continue

      el.innerHTML = ''

      if (pendingBadge?.files?.length) {
        const badge = document.createElement('div')
        badge.className = 'homerag-msg-badge'
        badge.innerHTML = pendingBadge.files.map(f => `<span class="homerag-msg-chip">${f}</span>`).join('')
        el.appendChild(badge)
        pendingBadge = null
      }

      const span = document.createElement('span')
      span.textContent = realQuestion
      el.appendChild(span)
    }
  }

  const msgObserver = new MutationObserver(() => hideContextInMessages())
  msgObserver.observe(document.body, { childList: true, subtree: true })
  hideContextInMessages()

  // ─── Input detection ─────────────────────────────────────
  document.addEventListener('input', () => {
    if (injecting || !isExtensionValid()) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      const query = getPromptText()
      if (query.length < 5) {
        if (query !== lastQuery) { suggestions = []; selected.clear(); renderBar() }
        lastQuery = query
        return
      }
      if (query === lastQuery) return
      lastQuery = query
      const chunks = await fetchSuggestions(query)
      suggestions = chunks
      selected = new Set(groupByFile(chunks).map((_, i) => i))
      renderBar()
    }, 500)
  }, true)

  // ─── Submit ──────────────────────────────────────────────
  document.addEventListener('keydown', async (e) => {
    if (injecting || !isExtensionValid()) return
    if (e.key !== 'Enter' || e.shiftKey) return
    const promptEl = getVisiblePromptEl()
    if (!promptEl) return
    if (document.activeElement !== promptEl && !promptEl.contains(document.activeElement)) return
    const query = getPromptText()
    if (!query) return
    const files = groupByFile(suggestions)
    const selectedChunks = files.filter((_, i) => selected.has(i)).flatMap(f => f.chunks)
    if (selectedChunks.length === 0) return

    e.preventDefault()
    e.stopImmediatePropagation()
    injecting = true

    pendingBadge = { files: files.filter((_, i) => selected.has(i)).map(f => f.filename.split('/').pop()) }

    const context = selectedChunks.map(c => c.text).join('\n---\n')
    const fullPrompt = `<context>\n${context}\n</context>\n\n${query}`
    setPromptText(fullPrompt)
    await new Promise(r => setTimeout(r, 150))

    const btn = getSendButton()
    if (btn && !btn.disabled) btn.click()

    suggestions = []; selected.clear(); lastQuery = ''
    renderBar()
    setTimeout(() => { injecting = false }, 300)
  }, true)

  console.log('HomeRAG: gemini ready')
})()
