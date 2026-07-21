from typing import Any

from fastapi import APIRouter, HTTPException

from app.modules.background_music.repository import create_background_music, delete_background_music, delete_background_music_batch, list_background_music, update_background_music
from app.schemas import SoundEffectBatchDeletePayload, SoundEffectPayload

router = APIRouter(prefix="/background-music", tags=["background-music"])


@router.get("")
def background_music() -> list[dict[str, Any]]:
    return list_background_music()


@router.post("", status_code=201)
def add_background_music(payload: SoundEffectPayload) -> dict[str, Any]:
    try:
        return create_background_music(payload.title, payload.tags, payload.category, payload.url)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/batch-delete")
def remove_background_music_batch(payload: SoundEffectBatchDeletePayload) -> dict[str, Any]:
    deleted, missing = delete_background_music_batch(payload.ids)
    return {"ok": True, "deleted": deleted, "missing": missing}


@router.patch("/{music_id}")
def edit_background_music(music_id: int, payload: SoundEffectPayload) -> dict[str, Any]:
    try:
        music = update_background_music(music_id, payload.title, payload.tags, payload.category, payload.url)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if music is None:
        raise HTTPException(404, "背景音乐不存在")
    return music


@router.delete("/{music_id}")
def remove_background_music(music_id: int) -> dict[str, bool]:
    if not delete_background_music(music_id):
        raise HTTPException(404, "背景音乐不存在")
    return {"ok": True}
