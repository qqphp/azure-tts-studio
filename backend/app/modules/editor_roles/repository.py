"""SQLite persistence for professional editor roles."""
from __future__ import annotations

import json
import time
from typing import Any

from app.core.database import connection
from app.modules.voices.repository import clean_short_name

ALLOWED_RATES = {"x-slow", "slow", "medium", "fast", "x-fast"}


def _clean_rate(value: object) -> str:
    rate = str(value).strip()
    if rate not in ALLOWED_RATES:
        raise ValueError("请选择有效语速")
    return rate


def _serialize(row: Any) -> dict[str, Any]:
    try:
        voice = json.loads(row["voice_json"])
    except (TypeError, json.JSONDecodeError):
        voice = {"ShortName": str(row["short_name"])}
    if not isinstance(voice, dict):
        voice = {"ShortName": str(row["short_name"])}
    return {
        "id": int(row["id"]),
        "name": str(row["name"]),
        "voice": voice,
        "rate": str(row["rate"]),
        "createdAt": int(row["created_at"]),
    }


def list_roles() -> list[dict[str, Any]]:
    with connection() as db:
        rows = db.execute(
            "SELECT id, name, short_name, voice_json, rate, created_at FROM editor_roles ORDER BY created_at DESC, id DESC"
        ).fetchall()
    return [_serialize(row) for row in rows]


def create_role(name: object, voice: dict[str, Any], rate: object = "medium") -> dict[str, Any]:
    clean_name = str(name).strip()
    if not clean_name:
        raise ValueError("角色名不能为空")
    if len(clean_name) > 80:
        raise ValueError("角色名不能超过 80 个字符")
    short_name = clean_short_name(voice.get("ShortName"))
    if not short_name:
        raise ValueError("请选择有效音色")
    clean_rate = _clean_rate(rate)
    voice_snapshot = {**voice, "ShortName": short_name}
    created_at = int(time.time())
    with connection() as db:
        cursor = db.execute(
            "INSERT INTO editor_roles (name, short_name, voice_json, rate, created_at) VALUES (?, ?, ?, ?, ?)",
            (clean_name, short_name, json.dumps(voice_snapshot, ensure_ascii=False), clean_rate, created_at),
        )
        role_id = int(cursor.lastrowid)
    return {"id": role_id, "name": clean_name, "voice": voice_snapshot, "rate": clean_rate, "createdAt": created_at}


def update_role(role_id: int, name: object, rate: object, voice: dict[str, Any] | None = None) -> dict[str, Any] | None:
    clean_name = str(name).strip()
    if not clean_name:
        raise ValueError("角色名不能为空")
    if len(clean_name) > 80:
        raise ValueError("角色名不能超过 80 个字符")
    clean_rate = _clean_rate(rate)
    with connection() as db:
        if voice is None:
            result = db.execute("UPDATE editor_roles SET name = ?, rate = ? WHERE id = ?", (clean_name, clean_rate, role_id))
        else:
            short_name = clean_short_name(voice.get("ShortName"))
            if not short_name:
                raise ValueError("请选择有效音色")
            voice_snapshot = {**voice, "ShortName": short_name}
            result = db.execute(
                "UPDATE editor_roles SET name = ?, rate = ?, short_name = ?, voice_json = ? WHERE id = ?",
                (clean_name, clean_rate, short_name, json.dumps(voice_snapshot, ensure_ascii=False), role_id),
            )
        if result.rowcount == 0:
            return None
        row = db.execute(
            "SELECT id, name, short_name, voice_json, rate, created_at FROM editor_roles WHERE id = ?",
            (role_id,),
        ).fetchone()
    return _serialize(row)


def delete_role(role_id: int) -> bool:
    with connection() as db:
        result = db.execute("DELETE FROM editor_roles WHERE id = ?", (role_id,))
    return result.rowcount > 0
