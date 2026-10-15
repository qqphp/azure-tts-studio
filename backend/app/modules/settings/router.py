from typing import Any

import httpx
import llm_bridge
from fastapi import APIRouter, Request

from app.core.config import DEFAULT_CONFIG, load_config, masked_config, save_config
from app.schemas import SettingsPayload
from app.services.speech import auth_headers, voices_endpoint

router = APIRouter(tags=["settings"])


def settings_response(config: dict[str, Any]) -> dict[str, Any]:
    result = masked_config(config)
    result["llm"]["base"] = llm_bridge.resolve_base(config)
    result["llm"]["defaultModel"] = llm_bridge.resolve_default_model(config)
    return result


@router.get("/settings")
def get_settings() -> dict[str, Any]:
    return settings_response(load_config())


@router.post("/settings")
async def set_settings(payload: SettingsPayload) -> dict[str, Any]:
    return settings_response(save_config(payload.model_dump()))


@router.post("/test")
async def test_connection(request: Request) -> dict[str, Any]:
    body = await request.json()
    config = load_config()
    if isinstance(body, dict):
        config.update({key: value for key, value in body.items() if key in DEFAULT_CONFIG and value is not None})
    if not config.get("apiKey") or not config.get("endpoint"):
        return {"ok": False, "error": "endpoint 与 apiKey 必填"}
    url = voices_endpoint(config)
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers={key: value for key, value in auth_headers(config).items() if key != "Content-Type"})
        if response.status_code != 200:
            return {"ok": False, "error": f"HTTP {response.status_code}: {response.text[:200]}", "url": url, "status": response.status_code}
        voices = response.json()
        chinese = [voice for voice in voices if voice.get("Locale", "").startswith("zh")]
        sample = (chinese or voices or [None])[0]
        return {"ok": True, "count": len(voices), "zh_count": len(chinese), "sample_voice": sample.get("ShortName") if sample else None, "url": url}
    except httpx.HTTPError as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "url": url}
