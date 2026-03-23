from fastapi import APIRouter
from app.config import settings

router = APIRouter()

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "embedding_provider": settings.embedding_provider,
    }