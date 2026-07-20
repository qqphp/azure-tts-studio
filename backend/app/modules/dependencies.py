"""Shared dependency functions used by business modules."""
from typing import Any

from fastapi import HTTPException

from app.core.config import load_config


def require_speech_config() -> dict[str, Any]:
    config = load_config()
    if not config.get("apiKey"):
        raise HTTPException(401, "未配置 apiKey")
    if not config.get("endpoint"):
        raise HTTPException(400, "未配置 endpoint")
    return config
