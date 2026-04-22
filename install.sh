#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[homerag]${NC} $1"; }
warn()    { echo -e "${YELLOW}[homerag]${NC} $1"; }
error()   { echo -e "${RED}[homerag]${NC} $1"; exit 1; }

echo ""
echo "  HomeRAG — Install"
echo "  ──────────────────────────────────────"
echo ""

# ── Prerequisites ──────────────────────────────────────────────────────────────
command -v docker  >/dev/null 2>&1 || error "Docker not found. Install it from https://docs.docker.com/get-docker/"
command -v docker  >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || \
  error "Docker Compose (v2) not found. Make sure Docker Desktop is up to date."

info "Docker OK"

# ── .env ───────────────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  warn ".env not found — creating from .env.example"
  if [ -f ".env.example" ]; then
    cp .env.example .env
  else
    cat > .env <<'EOF'
# HomeRAG environment
# Add your OpenAI API key here if you want to use OpenAI embeddings (optional)
# OPENAI_API_KEY=sk-...
EOF
  fi
  info ".env created"
else
  info ".env already exists — skipping"
fi

# ── Build & start ──────────────────────────────────────────────────────────────
info "Building and starting containers (this may take a few minutes on first run)…"
docker compose up --build -d

# ── homerag.local ──────────────────────────────────────────────────────────────
HOSTS_FILE="/etc/hosts"
HOSTS_ENTRY="127.0.0.1 homerag.local"

if grep -q "homerag.local" "$HOSTS_FILE" 2>/dev/null; then
  info "homerag.local already in $HOSTS_FILE — skipping"
else
  warn "Adding homerag.local to $HOSTS_FILE (requires sudo)…"
  echo "$HOSTS_ENTRY" | sudo tee -a "$HOSTS_FILE" > /dev/null
  info "homerag.local added"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}Done!${NC}"
echo ""
echo "  Web UI   →  http://homerag.local"
echo "  Web UI   →  http://localhost:3000"
echo "  API docs →  http://localhost:8000/docs"
echo ""
echo "  Extension: chrome://extensions/ → Developer mode → Load unpacked → extension/"
echo ""
