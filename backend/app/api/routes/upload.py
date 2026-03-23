import tempfile, os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.core.ingestion.pipeline import IngestionPipeline

router = APIRouter()
pipeline = IngestionPipeline()

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    collection: str = Form(default="default")
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        result = pipeline.ingest_file(tmp_path, file.filename, collection)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        os.unlink(tmp_path)
    return result

@router.post("/upload/url")
async def upload_url(url: str, collection: str = "default"):
    try:
        result = pipeline.ingest_url(url, collection)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result