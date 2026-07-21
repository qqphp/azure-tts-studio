from typing import Any

from fastapi import APIRouter, HTTPException

from app.modules.sound_effects.repository import create_sound_effect, delete_sound_effect, delete_sound_effects, list_sound_effects, update_sound_effect
from app.schemas import SoundEffectBatchDeletePayload, SoundEffectPayload

router = APIRouter(prefix="/sound-effects", tags=["sound-effects"])


@router.get("")
def sound_effects() -> list[dict[str, Any]]:
    return list_sound_effects()


@router.post("", status_code=201)
def add_sound_effect(payload: SoundEffectPayload) -> dict[str, Any]:
    try:
        return create_sound_effect(payload.title, payload.tags, payload.category, payload.url)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/batch-delete")
def remove_sound_effects(payload: SoundEffectBatchDeletePayload) -> dict[str, Any]:
    deleted, missing = delete_sound_effects(payload.ids)
    return {"ok": True, "deleted": deleted, "missing": missing}


@router.patch("/{effect_id}")
def edit_sound_effect(effect_id: int, payload: SoundEffectPayload) -> dict[str, Any]:
    try:
        effect = update_sound_effect(effect_id, payload.title, payload.tags, payload.category, payload.url)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if effect is None:
        raise HTTPException(404, "音效不存在")
    return effect


@router.delete("/{effect_id}")
def remove_sound_effect(effect_id: int) -> dict[str, bool]:
    if not delete_sound_effect(effect_id):
        raise HTTPException(404, "音效不存在")
    return {"ok": True}
