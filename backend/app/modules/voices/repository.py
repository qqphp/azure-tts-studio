"""Persistence operations for the user's preferred Azure voice IDs."""
from __future__ import annotations

import re
import json
import time
from typing import Any

from app.core.database import connection


def clean_short_name(value: object) -> str:
    return re.sub(r"[^A-Za-z0-9_:-]", "", str(value))


def list_favorites() -> list[str]:
    with connection() as db:
        rows = db.execute("SELECT short_name FROM voice_favorites ORDER BY created_at DESC").fetchall()
    return [str(row["short_name"]) for row in rows]


def add_favorite(short_name: object, voice: dict[str, Any] | None = None) -> str:
    value = clean_short_name(short_name)
    if not value:
        raise ValueError("无效音色 ID")
    with connection() as db:
        db.execute("INSERT OR REPLACE INTO voice_favorites (short_name, created_at, voice_json) VALUES (?, ?, ?)", (value, int(time.time()), json.dumps(voice, ensure_ascii=False) if voice else None))
    return value


def list_favorite_voices() -> list[dict[str, Any]]:
    with connection() as db:
        rows = db.execute("SELECT voice_json FROM voice_favorites WHERE voice_json IS NOT NULL ORDER BY created_at DESC").fetchall()
    result: list[dict[str, Any]] = []
    for row in rows:
        try:
            item = json.loads(row["voice_json"])
        except (TypeError, json.JSONDecodeError):
            continue
        if isinstance(item, dict) and item.get("ShortName"):
            result.append(item)
    return result


def remove_favorite(short_name: object) -> bool:
    value = clean_short_name(short_name)
    if not value:
        return False
    with connection() as db:
        result = db.execute("DELETE FROM voice_favorites WHERE short_name = ?", (value,))
    return result.rowcount > 0
