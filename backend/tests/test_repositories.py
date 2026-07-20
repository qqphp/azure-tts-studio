from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core import database
from app.modules.history import repository as history_repository
from app.modules.voices import repository as voices_repository


class LocalRepositoryTests(unittest.TestCase):
    def test_history_metadata_round_trip_uses_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(database, "DATABASE_PATH", Path(temp_dir) / "studio.db"):
            history_repository.save_metadata({"id": "record-1", "ts": 20, "voice": "voice-a"})
            history_repository.save_metadata({"id": "record-2", "ts": 30, "voice": "voice-b"})
            self.assertEqual([item["id"] for item in history_repository.list_metadata()], ["record-2", "record-1"])
            self.assertEqual(history_repository.get_metadata("record-1")["voice"], "voice-a")
            history_repository.delete_metadata("record-1")
            self.assertIsNone(history_repository.get_metadata("record-1"))

    def test_voice_favorites_round_trip_uses_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(database, "DATABASE_PATH", Path(temp_dir) / "studio.db"):
            self.assertEqual(voices_repository.add_favorite("zh-CN-XiaoxiaoNeural"), "zh-CN-XiaoxiaoNeural")
            self.assertEqual(voices_repository.list_favorites(), ["zh-CN-XiaoxiaoNeural"])
            self.assertTrue(voices_repository.remove_favorite("zh-CN-XiaoxiaoNeural"))
            self.assertEqual(voices_repository.list_favorites(), [])
