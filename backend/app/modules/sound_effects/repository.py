"""SQLite persistence and validation for the sound effects library."""
from __future__ import annotations

import json
import time
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import urlparse

from app.core.database import connection

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".opus", ".ogg", ".flac", ".wma"}


def _clean_text(value: object, label: str, maximum: int) -> str:
    clean = str(value).strip()
    if not clean:
        raise ValueError(f"{label}不能为空")
    if len(clean) > maximum:
        raise ValueError(f"{label}不能超过 {maximum} 个字符")
    return clean


def _clean_tags(values: object) -> list[str]:
    if not isinstance(values, list):
        raise ValueError("标签必须是列表")
    tags: list[str] = []
    for value in values:
        tag = str(value).strip()
        if not tag or tag in tags:
            continue
        if len(tag) > 40:
            raise ValueError("单个标签不能超过 40 个字符")
        tags.append(tag)
    if len(tags) > 20:
        raise ValueError("标签不能超过 20 个")
    return tags


def _clean_url(value: object) -> str:
    url = _clean_text(value, "链接", 2048)
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("链接必须是有效的 HTTP 或 HTTPS 地址")
    extension = PurePosixPath(parsed.path).suffix.lower()
    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        allowed = "、".join(sorted(ALLOWED_AUDIO_EXTENSIONS))
        raise ValueError(f"音频文件格式无效，仅支持 {allowed}")
    return url


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


def list_sound_effects() -> list[dict[str, Any]]:
    with connection() as db:
        rows = db.execute(
            "SELECT id, title, tags_json, category, url, created_at FROM sound_effects ORDER BY created_at DESC, id DESC"
        ).fetchall()
    return [_serialize(row) for row in rows]


def create_sound_effect(title: object, tags: object, category: object, url: object) -> dict[str, Any]:
    clean_title = _clean_text(title, "标题", 120)
    clean_tags = _clean_tags(tags)
    clean_category = _clean_text(category, "分类", 80)
    clean_url = _clean_url(url)
    created_at = int(time.time())
    with connection() as db:
        cursor = db.execute(
            "INSERT INTO sound_effects (title, tags_json, category, url, created_at) VALUES (?, ?, ?, ?, ?)",
            (clean_title, json.dumps(clean_tags, ensure_ascii=False), clean_category, clean_url, created_at),
        )
        effect_id = int(cursor.lastrowid)
    return {"id": effect_id, "title": clean_title, "tags": clean_tags, "category": clean_category, "url": clean_url, "createdAt": created_at}


def update_sound_effect(effect_id: int, title: object, tags: object, category: object, url: object) -> dict[str, Any] | None:
    clean_title = _clean_text(title, "标题", 120)
    clean_tags = _clean_tags(tags)
    clean_category = _clean_text(category, "分类", 80)
    clean_url = _clean_url(url)
    with connection() as db:
        result = db.execute(
            "UPDATE sound_effects SET title = ?, tags_json = ?, category = ?, url = ? WHERE id = ?",
            (clean_title, json.dumps(clean_tags, ensure_ascii=False), clean_category, clean_url, effect_id),
        )
        if result.rowcount == 0:
            return None
        row = db.execute(
            "SELECT id, title, tags_json, category, url, created_at FROM sound_effects WHERE id = ?", (effect_id,)
        ).fetchone()
    return _serialize(row)


def delete_sound_effect(effect_id: int) -> bool:
    with connection() as db:
        result = db.execute("DELETE FROM sound_effects WHERE id = ?", (effect_id,))
    return result.rowcount > 0


def delete_sound_effects(effect_ids: list[int]) -> tuple[int, list[int]]:
    unique_ids = list(dict.fromkeys(effect_ids))
    if not unique_ids:
        return 0, []
    placeholders = ",".join("?" for _ in unique_ids)
    with connection() as db:
        existing = {int(row["id"]) for row in db.execute(f"SELECT id FROM sound_effects WHERE id IN ({placeholders})", unique_ids).fetchall()}
        db.execute(f"DELETE FROM sound_effects WHERE id IN ({placeholders})", unique_ids)
    return len(existing), [effect_id for effect_id in unique_ids if effect_id not in existing]
