import json
import tempfile
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from app.core.ingestion.pipeline import IngestionPipeline

router = APIRouter()
pipeline = IngestionPipeline()


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    collection: str = Form(default="default"),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    def event_stream():
        try:
            for progress in pipeline.ingest_file_stream(tmp_path, file.filename, collection):
                yield f"data: {json.dumps(progress)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'stage': 'error', 'detail': str(e)})}\n\n"
        finally:
            os.unlink(tmp_path)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/upload/url")
async def upload_url(url: str, collection: str = "default"):
    try:
        result = pipeline.ingest_url(url, collection)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result
