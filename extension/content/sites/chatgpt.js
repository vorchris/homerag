(function () {
  let suggestions = []
  let selected = new Set()
  let barEl = null
  let spacerEl = null
  let lastQuery = ''
  let injecting = false
  let debounceTimer = null

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
    return document.querySelector('#composer-submit-button') ||
           document.querySelector('button[data-testid="send-button"]')
  }

  function getVisiblePromptEl() {
    const candidates = [...document.querySelectorAll('div[contenteditable="true"]')]
    return candidates.find(el => {
      const s = window.getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0
    }) ?? null
  }

  function getPromptText() {
    const el = getVisiblePromptEl()
    return el ? (el.innerText || el.textContent || '').trim() : ''
  }

  function setPromptText(value) {
    const el = getVisiblePromptEl()
    if (!el) return false
    el.focus()
    el.innerHTML = ''
    el.textContent = value
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }))
    return true
  }

  // ─── Styles ──────────────────────────────────────────────
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
      .homerag-msg-toggle {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-top: 6px;
        margin-bottom: 0;
        cursor: pointer;
        background: none;
        border: 1px solid #333;
        border-radius: 10px;
        padding: 2px 8px;
        font-family: 'DM Mono', monospace;
        font-size: 9px;
        color: #555;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        transition: color 0.1s, border-color 0.1s;
      }
      .homerag-msg-toggle:hover { color: #aaa; border-color: #555; }
      .homerag-msg-toggle-dot {
        width: 5px; height: 5px;
        border-radius: 50%;
        background: #444;
        flex-shrink: 0;
        transition: background 0.1s;
      }
      .homerag-msg-toggle:hover .homerag-msg-toggle-dot,
      .homerag-msg-toggle.open .homerag-msg-toggle-dot { background: #00e5b0; }
      .homerag-msg-toggle.open { color: #00e5b0; border-color: rgba(0,229,176,0.3); }
      .homerag-context-preview {
        display: none;
        margin-top: 6px;
        margin-bottom: 0;
        padding: 8px 10px;
        border-left: 2px solid #2a2a2a;
        background: #0d0d0d;
        border-radius: 4px;
        color: #666;
        font-size: 10px;
        font-family: 'DM Mono', monospace;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 160px;
        overflow-y: auto;
        line-height: 1.5;
      }
      .homerag-context-preview.open { display: block; }
    `
    document.head.appendChild(style)
  }

  // ─── Bar ─────────────────────────────────────────────────
  function findComposerContainer() {
    const sendBtn = getSendButton()
    if (!sendBtn) return null
    let el = sendBtn
    for (let i = 0; i < 10; i++) {
      el = el.parentElement
      if (!el) break
      if (el.tagName === 'FORM' || el.getAttribute('data-type') === 'unified-composer') return el
    }
    return sendBtn.closest('form') ?? null
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
      barEl.classList.remove('visible', 'loading')
      if (spacerEl) spacerEl.style.height = '0px'
      return
    }

    barEl.classList.remove('loading')
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
        if (selected.has(i)) selected.delete(i)
        else selected.add(i)
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

function hideContextInMessages() {
  document.querySelectorAll('[data-message-author-role="user"]').forEach(msg => {
    if (msg.dataset.homeragCleaned) return
    const fullText = msg.innerText || msg.textContent || ''
    if (!fullText.includes('<context>')) return

    msg.dataset.homeragCleaned = '1'

    const contextEnd = fullText.indexOf('</context>')
    if (contextEnd === -1) return

    const realQuestion = fullText
      .slice(contextEnd + '</context>'.length)
      .replace(/^\n+/, '')
      .trim()

    if (!realQuestion) return

    const textContainers = msg.querySelectorAll(
      'div[class*="whitespace"], p, .whitespace-pre-wrap, [data-message-text-content]'
    )

    let target = null
    textContainers.forEach(el => {
      const t = el.innerText || ''
      if (t.includes('<context>') && (!target || el.contains(target))) {
        target = el
      }
    })

    if (!target) {
      const walker = document.createTreeWalker(msg, NodeFilter.SHOW_ELEMENT)
      let node
      while ((node = walker.nextNode())) {
        const t = node.innerText || ''
        if (t.includes('<context>') && t.includes('</context>')) {
          if (!target || (node.innerText.length < target.innerText.length)) {
            target = node
          }
        }
      }
    }

    if (target) {
      const contextText = fullText.slice(fullText.indexOf('<context>') + '<context>'.length, fullText.indexOf('</context>')).trim()

      target.innerHTML = ''

      // Question text
      const span = document.createElement('span')
      span.textContent = realQuestion
      target.appendChild(span)

      // Collapsible context preview (above toggle, revealed upward)
      const preview = document.createElement('div')
      preview.className = 'homerag-context-preview'
      preview.textContent = contextText
      target.appendChild(preview)

      // Toggle button — sits below the question
      const toggle = document.createElement('button')
      toggle.className = 'homerag-msg-toggle'
      toggle.innerHTML = '<span class="homerag-msg-toggle-dot"></span>context'
      target.appendChild(toggle)

      toggle.addEventListener('click', () => {
        const open = preview.classList.toggle('open')
        toggle.classList.toggle('open', open)
        toggle.innerHTML = `<span class="homerag-msg-toggle-dot"></span>${open ? 'hide context' : 'context'}`
      })
    }
  })
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
    const selectedChunks = files
      .filter((_, i) => selected.has(i))
      .flatMap(f => f.chunks)

    if (selectedChunks.length === 0) return

    e.preventDefault()
    e.stopImmediatePropagation()

    injecting = true

    const context = selectedChunks.map(c => c.text).join('\n---\n')
    const fullPrompt = `<context>\n${context}\n</context>\n\n${query}`

    setPromptText(fullPrompt)
    await new Promise(r => setTimeout(r, 120))

    const btn = getSendButton()
    if (btn && !btn.disabled) btn.click()

    suggestions = []; selected.clear(); lastQuery = ''
    renderBar()

    setTimeout(() => { injecting = false }, 300)
  }, true)

  console.log('HomeRAG: chatgpt ready')
})()