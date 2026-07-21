"""SQLite persistence for the background music library."""
from __future__ import annotations

import json
import time
from typing import Any

from app.core.database import connection
from app.modules.sound_effects.repository import _clean_tags, _clean_text, _clean_url


def _serialize(row: Any) -> dict[str, Any]:
    try:
        tags = json.loads(row["tags_json"])
    except (TypeError, json.JSONDecodeError):
        tags = []
    return {
        "id": int(row["id"]),
        "title": str(row["title"]),
        "tags": tags if isinstance(tags, list) else [],
        "category": str(row["category"]),
        "url": str(row["url"]),
        "createdAt": int(row["created_at"]),
    }


def list_background_music() -> list[dict[str, Any]]:
    with connection() as db:
        rows = db.execute(
            "SELECT id, title, tags_json, category, url, created_at FROM background_music ORDER BY created_at DESC, id DESC"
        ).fetchall()
    return [_serialize(row) for row in rows]


def create_background_music(title: object, tags: object, category: object, url: object) -> dict[str, Any]:
    clean_title = _clean_text(title, "标题", 120)
    clean_tags = _clean_tags(tags)
    clean_category = _clean_text(category, "分类", 80)
    clean_url = _clean_url(url)
    created_at = int(time.time())
    with connection() as db:
        cursor = db.execute(
            "INSERT INTO background_music (title, tags_json, category, url, created_at) VALUES (?, ?, ?, ?, ?)",
            (clean_title, json.dumps(clean_tags, ensure_ascii=False), clean_category, clean_url, created_at),
        )
        music_id = int(cursor.lastrowid)
    return {"id": music_id, "title": clean_title, "tags": clean_tags, "category": clean_category, "url": clean_url, "createdAt": created_at}


def update_background_music(music_id: int, title: object, tags: object, category: object, url: object) -> dict[str, Any] | None:
    clean_title = _clean_text(title, "标题", 120)
    clean_tags = _clean_tags(tags)
    clean_category = _clean_text(category, "分类", 80)
    clean_url = _clean_url(url)
    with connection() as db:
        result = db.execute(
            "UPDATE background_music SET title = ?, tags_json = ?, category = ?, url = ? WHERE id = ?",
            (clean_title, json.dumps(clean_tags, ensure_ascii=False), clean_category, clean_url, music_id),
        )
        if result.rowcount == 0:
            return None
        row = db.execute(
            "SELECT id, title, tags_json, category, url, created_at FROM background_music WHERE id = ?", (music_id,)
        ).fetchone()
    return _serialize(row)


def delete_background_music(music_id: int) -> bool:
    with connection() as db:
        result = db.execute("DELETE FROM background_music WHERE id = ?", (music_id,))
    return result.rowcount > 0


def delete_background_music_batch(music_ids: list[int]) -> tuple[int, list[int]]:
    unique_ids = list(dict.fromkeys(music_ids))
    if not unique_ids:
        return 0, []
    placeholders = ",".join("?" for _ in unique_ids)
    with connection() as db:
        existing = {int(row["id"]) for row in db.execute(f"SELECT id FROM background_music WHERE id IN ({placeholders})", unique_ids).fetchall()}
        db.execute(f"DELETE FROM background_music WHERE id IN ({placeholders})", unique_ids)
    return len(existing), [music_id for music_id in unique_ids if music_id not in existing]
