from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.config import HISTORY_DIR
from app.schemas import HistoryBatchDeletePayload
from app.services.history import delete_history, history_metadata, list_history, safe_id
from app.services.speech import mime_for_format

router = APIRouter(tags=["history"])


@router.get("/history")
def history() -> list[dict]:
    return list_history()


@router.get("/history/{history_id}")
def history_item(history_id: str):
    item_id = safe_id(history_id)
    audio = HISTORY_DIR / f"{item_id}.bin"
    metadata = history_metadata(item_id)
    if not metadata or not audio.exists():
        raise HTTPException(404, "不存在")
    output_format = metadata.get("format", "")
    extension = "mp3" if "mp3" in output_format else "wav"
    return FileResponse(audio, media_type=mime_for_format(output_format), filename=f"{item_id}.{extension}")


@router.delete("/history/{history_id}")
def delete_one_history(history_id: str) -> dict[str, bool]:
    delete_history([history_id])
    return {"ok": True}


@router.post("/history/batch-delete")
async def delete_history_batch(payload: HistoryBatchDeletePayload) -> dict:
    deleted, missing = delete_history(payload.ids)
    return {"ok": True, "deleted": deleted, "missing": missing}
