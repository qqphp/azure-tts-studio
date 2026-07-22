"""SQLite metadata repository; audio bytes remain local files for efficient streaming."""
from __future__ import annotations

import json
from typing import Any

from app.core.database import connection


def save_metadata(metadata: dict[str, Any]) -> None:
    with connection() as db:
        db.execute(
            "INSERT OR REPLACE INTO history_entries (id, created_at, metadata_json) VALUES (?, ?, ?)",
            (metadata["id"], int(metadata.get("ts") or 0), json.dumps(metadata, ensure_ascii=False)),
        )


def list_metadata() -> list[dict[str, Any]]:
    with connection() as db:
        rows = db.execute("SELECT metadata_json FROM history_entries ORDER BY created_at DESC").fetchall()
    results: list[dict[str, Any]] = []
    for row in rows:
        try:
            results.append(json.loads(row["metadata_json"]))
        except (TypeError, json.JSONDecodeError):
            continue
    return results


def get_metadata(item_id: str) -> dict[str, Any] | None:
    with connection() as db:
        row = db.execute("SELECT metadata_json FROM history_entries WHERE id = ?", (item_id,)).fetchone()
    if not row:
        return None
    try:
        return json.loads(row["metadata_json"])
    except (TypeError, json.JSONDecodeError):
        return None


def delete_metadata(item_id: str) -> None:
    with connection() as db:
        db.execute("DELETE FROM history_entries WHERE id = ?", (item_id,))
