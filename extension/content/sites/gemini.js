(function () {
  let suggestions = []
  let selected = new Set()
  let barEl = null
  let spacerEl = null
  let lastQuery = ''
  let injecting = false
  let debounceTimer = null
  let pendingBadge = null

  // ─── Extension valid check ────────────────────────────────
  function isExtensionValid() {
    try { return !!chrome.runtime?.id } catch { return false }
  }

  // ─── RAG ─────────────────────────────────────────────────
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

  // ─── Helpers ─────────────────────────────────────────────
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
      document.querySelector('.send-button') ||
      [...document.querySelectorAll('button')].find(b => b.querySelector('.send-icon'))
    )
  }

  function getVisiblePromptEl() {
    const candidates = [
      // Quill editor inside rich-textarea (after conversation starts)
      ...document.querySelectorAll('rich-textarea .ql-editor[contenteditable="true"]'),
      ...document.querySelectorAll('.ql-editor[contenteditable="true"]'),
      // Initial textarea (before conversation starts)
      ...document.querySelectorAll('textarea.gds-body-l'),
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
    if (!el) { console.log('[HomeRAG gemini] setPromptText: no el'); return false }

    if (el.tagName === 'TEXTAREA') {
      el.focus()
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }

    // Prefer Quill API so internal model stays in sync with DOM.
    // Quill stores itself on .ql-container (parent of .ql-editor).
    const container = el.closest('.ql-container') || el.parentElement
    const quill = container?.__quill
    if (quill) {
      try {
        quill.setText(value)
        quill.setSelection(value.length, 0)
        console.log('[HomeRAG gemini] setPromptText via Quill API:', value.slice(0, 40))
        return true
      } catch (err) {
        console.warn('[HomeRAG gemini] Quill API failed, falling back to execCommand:', err)
      }
    }

    // Fallback: execCommand
    el.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(range)
    document.execCommand('insertText', false, value)

    try {
      const r2 = document.createRange()
      const last = el.lastChild
      if (last) {
        if (last.nodeType === Node.TEXT_NODE) { r2.setStart(last, last.length); r2.collapse(true) }
        else { r2.setStartAfter(last); r2.collapse(true) }
        sel.removeAllRanges()
        sel.addRange(r2)
      }
    } catch (_) {}

    console.log('[HomeRAG gemini] setPromptText via execCommand:', (el.textContent || '').slice(0, 40))
    return true
  }

  // ─── Shared injection logic (used by both keydown and click) ─
  async function injectAndSend(query, sendFn) {
    const files = groupByFile(suggestions)
    const selectedChunks = files.filter((_, i) => selected.has(i)).flatMap(f => f.chunks)
    if (selectedChunks.length === 0) return false

    injecting = true
    console.log('[HomeRAG gemini] injecting', selectedChunks.length, 'chunks')
    pendingBadge = { files: files.filter((_, i) => selected.has(i)).map(f => f.filename.split('/').pop()) }

    const context = selectedChunks.map(c => c.text).join('\n---\n')
    const fullPrompt = `<context>\n${context}\n</context>\n\n${query}`
    setPromptText(fullPrompt)
    await new Promise(r => setTimeout(r, 200))

    // Clear state BEFORE sendFn so that any re-intercepted click/keydown events
    // see no chunks and pass through to Gemini's native handlers
    suggestions = []; selected.clear(); lastQuery = ''
    injecting = false
    renderBar()

    sendFn()

    // Gemini doesn't always clear the editor after a programmatic send
    // (Quill state can be out of sync). Force-clear after a short delay.
    setTimeout(() => {
      const el = getVisiblePromptEl()
      if (!el || el.tagName === 'TEXTAREA') return
      const c = el.closest('.ql-container') || el.parentElement
      const q = c?.__quill
      try {
        if (q) { q.setText('') }
        else { el.focus(); document.execCommand('selectAll', false, null); document.execCommand('delete', false, null) }
      } catch (_) {}
    }, 300)

    return true
  }

  // ─── Styles (identical to chatgpt.js) ────────────────────
  function injectStyles() {
    if (document.getElementById('homerag-styles')) return
    const style = document.createElement('style')
    style.id = 'homerag-styles'
    style.textContent = `
      #homerag-spacer {
        width: 100%;
        transition: height 0.2s ease;
        height: 0px;
      }
      #homerag-bar {
        width: 100%;
        background: #111;
        border-top: 1px solid #1e1e1e;
        border-bottom: 1px solid #1e1e1e;
        padding: 6px 12px;
        display: none;
        flex-direction: column;
        gap: 0;
        font-family: 'DM Mono', monospace, sans-serif;
        font-size: 11px;
        box-sizing: border-box;
      }
      #homerag-bar.visible { display: flex; }
      #homerag-bar.loading { display: flex; }
      .homerag-spinner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 0;
      }
      .homerag-spinner-dots {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .homerag-spinner-dots span {
        display: block;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #333;
        animation: homerag-pulse 1.2s ease-in-out infinite;
      }
      .homerag-spinner-dots span:nth-child(2) { animation-delay: 0.2s; }
      .homerag-spinner-dots span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes homerag-pulse {
        0%, 80%, 100% { background: #333; transform: scale(1); }
        40% { background: #00e5b0; transform: scale(1.3); }
      }
      .homerag-spinner-label {
        color: #333;
        font-size: 9px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .homerag-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .homerag-label {
        color: #444;
        font-size: 9px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .homerag-actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .homerag-action-btn {
        color: #444;
        cursor: pointer;
        font-size: 9px;
        letter-spacing: 1px;
        text-transform: uppercase;
        background: none;
        border: none;
        padding: 0;
        font-family: inherit;
        transition: color 0.1s;
      }
      .homerag-action-btn:hover { color: #888; }
      .homerag-close-btn {
        color: #333;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        margin-left: 6px;
        transition: color 0.1s;
      }
      .homerag-close-btn:hover { color: #666; }
      .homerag-files {
        display: flex;
        flex-direction: row;
        gap: 6px;
        flex-wrap: wrap;
      }
      .homerag-file-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 20px;
        cursor: pointer;
        border: 1px solid #222;
        background: transparent;
        transition: all 0.1s;
        max-width: 220px;
        white-space: nowrap;
        overflow: hidden;
      }
      .homerag-file-chip:hover { border-color: #333; background: #1a1a1a; }
      .homerag-file-chip.selected { border-color: #00e5b0; background: #0a1f19; }
      .homerag-chip-dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: #333;
        flex-shrink: 0;
        transition: background 0.1s;
      }
      .homerag-file-chip.selected .homerag-chip-dot { background: #00e5b0; }
      .homerag-chip-name {
        color: #888;
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 0.1s;
      }
      .homerag-file-chip.selected .homerag-chip-name { color: #ccc; }
      .homerag-chip-score {
        color: #333;
        font-size: 9px;
        flex-shrink: 0;
        transition: color 0.1s;
      }
      .homerag-file-chip.selected .homerag-chip-score { color: #00e5b0; }
      .homerag-msg-badge { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 5px; }
      .homerag-msg-chip { font-family: 'DM Mono', monospace; font-size: 9px; color: #00e5b0; background: #0a1f19; border: 1px solid rgba(0,229,176,0.25); border-radius: 10px; padding: 2px 7px; letter-spacing: 0.4px; white-space: nowrap; }
    `
    document.head.appendChild(style)
  }

  // ─── Bar ─────────────────────────────────────────────────
  function findComposerContainer() {
    // After conversation: go one level ABOVE input-area so the bar sits outside the styled box
    const inputArea = document.querySelector('[data-node-type="input-area"]')
    if (inputArea?.parentElement && inputArea.parentElement !== document.body) {
      console.log('[HomeRAG gemini] composer via input-area parent:', inputArea.parentElement)
      return inputArea.parentElement
    }

    // Initial state (no conversation yet)
    const initialArea = document.querySelector('.initial-input-area')
    if (initialArea) {
      console.log('[HomeRAG gemini] composer via .initial-input-area:', initialArea)
      return initialArea
    }

    // Fallback: common ancestor of input + send button
    const promptEl = getVisiblePromptEl()
    const sendBtn = getSendButton()
    if (!promptEl) return null

    if (sendBtn) {
      let el = promptEl.parentElement
      for (let i = 0; i < 10; i++) {
        if (!el || el === document.body) break
        if (el.contains(sendBtn)) {
          console.log('[HomeRAG gemini] composer via send-button ancestor:', el)
          return el
        }
        el = el.parentElement
      }
    }

    return promptEl.parentElement ?? null
  }

  function ensureBar() {
    if (barEl && document.body.contains(barEl)) return
    injectStyles()

    spacerEl = document.createElement('div')
    spacerEl.id = 'homerag-spacer'

    barEl = document.createElement('div')
    barEl.id = 'homerag-bar'

    const composer = findComposerContainer()
    if (composer && composer.parentElement) {
      composer.parentElement.insertBefore(spacerEl, composer)
      composer.parentElement.insertBefore(barEl, composer)
    } else {
      document.body.appendChild(spacerEl)
      document.body.appendChild(barEl)
    }
  }

  function renderBar() {
    ensureBar()
    const files = groupByFile(suggestions)

    if (files.length === 0) {
      barEl.classList.remove('visible')
      if (spacerEl) spacerEl.style.height = '0px'
      return
    }

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

    requestAnimationFrame(() => {
      if (spacerEl && barEl) spacerEl.style.height = barEl.offsetHeight + 'px'
    })

    document.getElementById('homerag-close').onclick = () => {
      suggestions = []; selected.clear(); renderBar()
    }
    document.getElementById('homerag-all').onclick = () => {
      files.forEach((_, i) => selected.add(i)); renderBar()
    }
    document.getElementById('homerag-none').onclick = () => {
      selected.clear(); renderBar()
    }
    barEl.querySelectorAll('.homerag-file-chip').forEach(chip => {
      chip.onclick = () => {
        const i = parseInt(chip.dataset.index, 10)
        selected.has(i) ? selected.delete(i) : selected.add(i)
        renderBar()
      }
    })
  }

  function renderLoading() {
    ensureBar()
    barEl.classList.add('visible', 'loading')
    barEl.innerHTML = `
      <div class="homerag-spinner">
        <div class="homerag-spinner-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="homerag-spinner-label">searching</span>
      </div>
    `
    requestAnimationFrame(() => {
      if (spacerEl && barEl) spacerEl.style.height = barEl.offsetHeight + 'px'
    })
  }

  // ─── Hide context in sent messages ───────────────────────
  function hideContextInMessages() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    const candidates = []
    let node
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
      let dominated = false
      let p = el.parentElement
      while (p) { if (done.has(p)) { dominated = true; break } p = p.parentElement }
      if (dominated) continue

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

  // ─── Input Detection ─────────────────────────────────────
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
      renderLoading()
      const chunks = await fetchSuggestions(query)
      console.log('[HomeRAG gemini] query:', query, '→ chunks:', chunks.length)
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

    // Gemini: activeElement is the ql-editor OR rich-textarea or an ancestor
    const active = document.activeElement
    const inEditor = active === promptEl
      || promptEl.contains(active)
      || active?.closest('rich-textarea') != null
    if (!inEditor) {
      console.log('[HomeRAG gemini] Enter ignored, activeElement:', active?.tagName, active?.className?.slice(0,40))
      return
    }

    const query = getPromptText()
    console.log('[HomeRAG gemini] Enter pressed, query:', query?.slice(0, 50), 'suggestions:', suggestions.length)
    if (!query) return

    const files = groupByFile(suggestions)
    const selectedChunks = files.filter((_, i) => selected.has(i)).flatMap(f => f.chunks)
    if (selectedChunks.length === 0) return

    e.preventDefault()
    e.stopImmediatePropagation()

    await injectAndSend(query, () => {
      const btn = getSendButton()
      console.log('[HomeRAG gemini] send btn:', btn?.tagName, btn?.disabled)
      if (btn && !btn.disabled) {
        btn.click()
      } else {
        const activeEl = getVisiblePromptEl()
        activeEl?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true,
        }))
      }
    })
  }, true)

  // ─── Send button click interception ──────────────────────
  document.addEventListener('click', async (e) => {
    if (injecting || !isExtensionValid()) return

    const btn = getSendButton()
    if (!btn) return
    if (btn !== e.target && !btn.contains(e.target)) return

    const query = getPromptText()
    if (!query) return

    const files = groupByFile(suggestions)
    const selectedChunks = files.filter((_, i) => selected.has(i)).flatMap(f => f.chunks)
    if (selectedChunks.length === 0) return

    e.preventDefault()
    e.stopImmediatePropagation()
    console.log('[HomeRAG gemini] send button click intercepted, chunks:', selectedChunks.length)

    await injectAndSend(query, () => {
      const freshBtn = getSendButton()
      if (freshBtn && !freshBtn.disabled) freshBtn.click()
    })
  }, true)

  // ─── Debug on load ───────────────────────────────────────
  setTimeout(() => {
    const promptEl = getVisiblePromptEl()
    const composer = findComposerContainer()
    console.log('[HomeRAG gemini] promptEl:', promptEl)
    console.log('[HomeRAG gemini] composer:', composer)
    console.log('[HomeRAG gemini] composer.parentElement:', composer?.parentElement)
  }, 2000)

  console.log('HomeRAG: gemini ready')
})()
