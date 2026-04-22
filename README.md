# HomeRAG

> Inject your personal knowledge base into ChatGPT, Claude, and Gemini.

Upload documents, organize them in collections, and let the browser extension automatically pull relevant context into your prompts — without copy-pasting.

---

## ✦ Features

- 📄 **Document ingestion** — PDF, DOCX, TXT, MD, CSV and web URLs
- 🗂 **Collections** — organize documents into namespaces, each with its own embedding model
- 🧠 **Embedding providers** — local (sentence-transformers) or OpenAI
- 🔍 **Vector search** — Qdrant for fast similarity search
- 🧩 **Browser extension** — auto-injects context into ChatGPT, Claude, and Gemini
- 🖥 **Web interface** — upload, search, manage collections and settings
- 🔐 **Auth** — session login for the UI, Bearer token for the extension

---

## ⚡ Install

### One-liner

```bash
git clone https://github.com/vorchris/homerag && cd homerag && ./install.sh
```

The script will:
1. Check that Docker and Docker Compose are installed
2. Create a `.env` file if one doesn't exist
3. Build and start all containers
4. Add `homerag.local` to `/etc/hosts` (requires sudo once)

### Manual

```bash
git clone <repository-url>
cd homerag

# Optional: add API key for OpenAI embeddings
cp .env.example .env   # then edit .env

docker compose up --build -d

# Add local hostname (optional, requires sudo)
echo "127.0.0.1 homerag.local" | sudo tee -a /etc/hosts
```

### Services

| Service | URL |
|---------|-----|
| Web UI | http://homerag.local · http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| Qdrant dashboard | http://localhost:6333/dashboard |

Open the web UI — the setup wizard walks you through initial configuration (username, password, embedding model).

> Config and data are stored in Docker volumes and survive container restarts.

### Browser Extension

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. Open the extension popup → set API URL to `http://homerag.local` (or `http://localhost:8000`) and paste your API token from the web UI settings

### Supported File Types

Upload any text-based file:

| Category | Extensions |
|----------|-----------|
| Documents | `.pdf` `.txt` `.md` `.csv` `.rst` `.tex` |
| Code | `.py` `.js` `.ts` `.tsx` `.cpp` `.c` `.h` `.java` `.cs` `.go` `.rs` `.rb` `.php` `.swift` `.kt` `.sql` `.sh` … |
| Config | `.json` `.yaml` `.toml` `.ini` `.env` `.xml` `.html` `.css` |

---

## 🛠 Architecture

```
browser extension
      │
      ▼
frontend (React)  ──▶  nginx  ──▶  backend (FastAPI)  ──▶  Qdrant
                                         │
                                     SQLite (metadata)
                                     /app/storage (files)
                                     homerag_config.json
```

| Layer | Stack |
|-------|-------|
| Backend | Python · FastAPI · SQLAlchemy · Qdrant client |
| Frontend | React · TypeScript · Vite · nginx |
| Extension | Chrome Manifest V3 |
| Databases | SQLite (metadata) · Qdrant (vectors) |

---

## 🧩 Browser Extension

**Install:** `chrome://extensions/` → Developer mode → Load unpacked → select `extension/`

The extension watches your input as you type, queries the backend for relevant chunks, and shows them as chips above the send button. On **Enter**, selected chunks are prepended to your prompt as `<context>…</context>` — invisible in the chat history.

**Supported:** `chatgpt.com` · `claude.ai` · `gemini.google.com`

**Popup tabs:**

| Tab | Controls |
|-----|----------|
| **main** | Enabled toggle · Collection · Threshold slider |
| **settings** | API URL · API token · Top-K |

---

## 🗂 Collections & Embedding Models

Each collection has its own **locked embedding model**, so different collections can use different providers side by side.

- The global model in **Settings** is the default for new collections
- Changing the global model does **not** affect existing collections
- To switch a collection's model: update the dropdowns on the collection card and click **apply** — all chunks are re-embedded automatically, no re-upload needed

> ⚠️ Mixing models causes a vector dimension mismatch (e.g. 384 vs 1536 dims). HomeRAG detects this and returns a clear error with instructions.

---

## 🔌 API

Authentication: `Authorization: Bearer <token>` (extension) or session cookie (web UI).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/setup/status` | Check if setup is complete |
| `POST` | `/api/setup` | First-time setup |
| `POST` | `/api/auth/login` | Login → session cookie |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/collections` | List collections |
| `POST` | `/api/collections` | Create collection |
| `POST` | `/api/collections/{name}/reembed` | Re-embed collection *(SSE stream)* |
| `GET` | `/api/files` | List files in collection |
| `DELETE` | `/api/files/{id}` | Delete file + vectors |
| `POST` | `/api/upload` | Upload file *(SSE stream)* |
| `POST` | `/api/upload/url` | Ingest web URL |
| `POST` | `/api/query` | Query knowledge base |
| `GET` | `/api/config` | Get config |
| `PUT` | `/api/config` | Update config |

Interactive docs: **http://localhost:8000/docs**

---

## 💻 Local Development

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

export QDRANT_HOST=localhost
export QDRANT_PORT=6333
export DB_PATH=./data/homerag.db
export STORAGE_PATH=./storage
export HOMERAG_CONFIG=./homerag_config.json

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # :5173, proxies /api → :8000
```

### Extension

Load unpacked from `extension/` in `chrome://extensions/`. Reload after any JS change.
