"""Small SQLite infrastructure layer for local, single-user application data."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.core.config import ROOT

DATABASE_PATH = ROOT / "data" / "studio.db"


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    try:
        db.execute("""
            CREATE TABLE IF NOT EXISTS history_entries (
                id TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                metadata_json TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS voice_favorites (
                short_name TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL
            )
        """)
        yield db
        db.commit()
    finally:
        db.close()
