"""Persistence operations for the user's preferred Azure voice IDs."""
from __future__ import annotations

import json
import time
from typing import Any

from app.core.database import connection


def list_favorites() -> list[str]:
    with connection() as db:
        rows = db.execute("SELECT short_name, voice_json FROM voice_favorites ORDER BY created_at DESC").fetchall()
    result: list[str] = []
    for row in rows:
        try:
            voice = json.loads(row["voice_json"]) if row["voice_json"] else None
        except (TypeError, json.JSONDecodeError):
            voice = None
        value = voice.get("ShortName") if isinstance(voice, dict) else row["short_name"]
        if isinstance(value, str) and value:
            result.append(value)
    return result


def add_favorite(voice: dict[str, Any]) -> str:
    value = voice.get("ShortName")
    if not isinstance(value, str) or not value:
        raise ValueError("音色数据缺少 ShortName")
    with connection() as db:
        db.execute("INSERT OR REPLACE INTO voice_favorites (short_name, created_at, voice_json) VALUES (?, ?, ?)", (value, int(time.time()), json.dumps(voice, ensure_ascii=False)))
    return value


def list_favorite_voices() -> list[dict[str, Any]]:
    with connection() as db:
        rows = db.execute("SELECT short_name, voice_json FROM voice_favorites WHERE voice_json IS NOT NULL ORDER BY created_at DESC").fetchall()
    result: list[dict[str, Any]] = []
    repairs: list[tuple[str, str]] = []
    for row in rows:
        try:
            item = json.loads(row["voice_json"])
        except (TypeError, json.JSONDecodeError):
            continue
        if isinstance(item, dict) and item.get("ShortName"):
            result.append(item)
            if item["ShortName"] != row["short_name"]:
                repairs.append((item["ShortName"], row["short_name"]))
    if repairs:
        with connection() as db:
            for correct_value, old_value in repairs:
                existing = db.execute("SELECT 1 FROM voice_favorites WHERE short_name = ?", (correct_value,)).fetchone()
                if existing:
                    db.execute("DELETE FROM voice_favorites WHERE short_name = ?", (old_value,))
                else:
                    db.execute("UPDATE voice_favorites SET short_name = ? WHERE short_name = ?", (correct_value, old_value))
    return result


def remove_favorite(short_name: object) -> bool:
    if not isinstance(short_name, str) or not short_name:
        return False
    with connection() as db:
        result = db.execute("DELETE FROM voice_favorites WHERE short_name = ?", (short_name,))
    return result.rowcount > 0
