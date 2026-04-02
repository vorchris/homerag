from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import health, upload, query, collections, files, auth  # ← auth hinzufügen
from app.db.session import init_db

app = FastAPI(title="HomeRAG", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://homerag.local"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router,      prefix="/api", tags=["health"])
app.include_router(auth.router,        prefix="/api", tags=["auth"])   # ← neu
app.include_router(upload.router,      prefix="/api", tags=["upload"])
app.include_router(query.router,       prefix="/api", tags=["query"])
app.include_router(collections.router, prefix="/api", tags=["collections"])
app.include_router(files.router,       prefix="/api", tags=["files"])

@app.on_event("startup")
async def startup():
    init_db()
    print("HomeRAG ready.")