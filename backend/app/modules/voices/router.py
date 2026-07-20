from typing import Any

import httpx
from fastapi import APIRouter

from app.modules.dependencies import require_speech_config
from app.modules.voices.repository import add_favorite, list_favorites, remove_favorite
from app.services.speech import auth_headers, voices_endpoint

router = APIRouter(tags=["voices"])


@router.get("/voices/favorites")
def favorites() -> list[str]:
    return list_favorites()


@router.put("/voices/favorites/{short_name}")
def add_voice_favorite(short_name: str) -> dict[str, object]:
    try:
        return {"ok": True, "short_name": add_favorite(short_name)}
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(400, str(exc)) from exc


@router.delete("/voices/favorites/{short_name}")
def remove_voice_favorite(short_name: str) -> dict[str, bool]:
    return {"ok": remove_favorite(short_name)}


@router.get("/voices")
async def voices(locale: str | None = None) -> list[dict[str, Any]]:
    config = require_speech_config()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(voices_endpoint(config), headers={key: value for key, value in auth_headers(config).items() if key != "Content-Type"})
    if response.status_code != 200:
        from fastapi import HTTPException
        raise HTTPException(response.status_code, response.text[:500])
    result = response.json()
    result.sort(key=lambda voice: (0 if voice.get("Locale", "").startswith("zh") else 1, voice.get("Locale", ""), voice.get("ShortName", "")))
    return [voice for voice in result if not locale or voice.get("Locale") == locale]
