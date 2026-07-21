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
                created_at INTEGER NOT NULL,
                voice_json TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS editor_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                short_name TEXT NOT NULL,
                voice_json TEXT NOT NULL,
                rate TEXT NOT NULL DEFAULT 'medium',
                created_at INTEGER NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS sound_effects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                tags_json TEXT NOT NULL DEFAULT '[]',
                category TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS background_music (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                tags_json TEXT NOT NULL DEFAULT '[]',
                category TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)
        role_columns = {row[1] for row in db.execute("PRAGMA table_info(editor_roles)").fetchall()}
        if "rate" not in role_columns:
            db.execute("ALTER TABLE editor_roles ADD COLUMN rate TEXT NOT NULL DEFAULT 'medium'")
        db.execute("""
            UPDATE editor_roles
            SET rate = CASE rate
                WHEN '0.8x' THEN 'slow'
                WHEN '0.9x' THEN 'slow'
                WHEN '1.0x' THEN 'medium'
                WHEN '1.1x' THEN 'fast'
                WHEN '1.2x' THEN 'fast'
                ELSE rate
            END
            WHERE rate IN ('0.8x', '0.9x', '1.0x', '1.1x', '1.2x')
        """)
        columns = {row[1] for row in db.execute("PRAGMA table_info(voice_favorites)").fetchall()}
        if "voice_json" not in columns:
            db.execute("ALTER TABLE voice_favorites ADD COLUMN voice_json TEXT")
        yield db
        db.commit()
    finally:
        db.close()
