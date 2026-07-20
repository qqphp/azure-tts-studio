from __future__ import annotations

import json
from typing import Any

from app.core.config import HISTORY_DIR
from app.modules.history.repository import delete_metadata, get_metadata, list_metadata, save_metadata


def safe_id(value: object) -> str:
    return "".join(char for char in str(value) if char.isalnum())


def list_history() -> list[dict[str, Any]]:
    database_items = list_metadata()
    known_ids = {item.get("id") for item in database_items}
    items = []
    for path in HISTORY_DIR.glob("*.json"):
        try:
            item = json.loads(path.read_text("utf-8"))
            if item.get("id") not in known_ids:
                # One-time, non-destructive migration of pre-SQLite metadata.
                save_metadata(item)
                database_items.append(item)
        except (OSError, json.JSONDecodeError): continue
    return sorted(database_items, key=lambda item: item.get("ts", 0), reverse=True)


def history_metadata(item_id: str) -> dict[str, Any] | None:
    return get_metadata(item_id)


def delete_history(ids: list[object]) -> tuple[int, list[str]]:
    deleted, missing = 0, []
    for value in ids:
        item_id, found = safe_id(value), False
        if not item_id: continue
        for suffix in (".json", ".bin"):
            path = HISTORY_DIR / f"{item_id}{suffix}"
            if path.exists(): path.unlink(); found = True
        if found: deleted += 1
        else: missing.append(item_id)
        delete_metadata(item_id)
    return deleted, missing
