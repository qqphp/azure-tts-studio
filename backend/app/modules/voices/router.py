from typing import Any
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.modules.dependencies import require_speech_config
from app.modules.voices.repository import add_favorite, list_favorite_voices, list_favorites, remove_favorite
from app.schemas import VoicePreviewPayload
from app.services.speech import auth_headers, voices_endpoint
from app.services.voice_previews import ensure_voice_preview, list_voice_previews, preview_file_path

router = APIRouter(tags=["voices"])


def _preview_response(entry: dict[str, Any]) -> dict[str, Any]:
    return {**entry, "url": f"/api/voices/previews/audio/{quote(str(entry['fileName']))}"}


@router.get("/voices/favorites")
def favorites() -> list[str]:
    return list_favorites()


@router.get("/voices/favorites/items")
def favorite_items() -> list[dict[str, Any]]:
    return list_favorite_voices()


@router.put("/voices/favorites/{short_name}")
async def add_voice_favorite(short_name: str, voice: dict[str, Any] | None = None) -> dict[str, object]:
    try:
        if voice is None:
            raise ValueError("请求缺少音色数据")
        return {"ok": True, "short_name": add_favorite(voice)}
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(400, str(exc)) from exc


@router.delete("/voices/favorites/{short_name}")
def remove_voice_favorite(short_name: str) -> dict[str, bool]:
    return {"ok": remove_favorite(short_name)}


@router.get("/voices/previews")
def voice_previews() -> list[dict[str, Any]]:
    return [_preview_response(entry) for entry in list_voice_previews()]


@router.post("/voices/previews")
async def create_voice_preview(payload: VoicePreviewPayload) -> dict[str, Any]:
    try:
        entry = await ensure_voice_preview(require_speech_config(), payload.voice)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from exc
    return _preview_response(entry)


@router.get("/voices/previews/audio/{file_name}")
def voice_preview_audio(file_name: str) -> FileResponse:
    path = preview_file_path(file_name)
    if not path or not path.is_file():
        raise HTTPException(404, "试听音频不存在，请重新生成")
    return FileResponse(path, media_type="audio/mpeg")


@router.get("/voices")
async def voices(locale: str | None = None) -> list[dict[str, Any]]:
    config = require_speech_config()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(voices_endpoint(config), headers={key: value for key, value in auth_headers(config).items() if key != "Content-Type"})
    if response.status_code != 200:
        raise HTTPException(response.status_code, response.text[:500])
    result = response.json()
    result.sort(key=lambda voice: (0 if voice.get("Locale", "").startswith("zh") else 1, voice.get("Locale", ""), voice.get("ShortName", "")))
    return [voice for voice in result if not locale or voice.get("Locale") == locale]
