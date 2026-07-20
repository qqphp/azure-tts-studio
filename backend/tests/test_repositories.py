from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core import database
from app.modules.history import repository as history_repository
from app.modules.editor_roles import repository as editor_roles_repository
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
            self.assertEqual(voices_repository.add_favorite("zh-CN-Mei:MAI-Voice-2"), "zh-CN-Mei:MAI-Voice-2")
            self.assertEqual(voices_repository.list_favorites(), ["zh-CN-Mei:MAI-Voice-2"])
            self.assertTrue(voices_repository.remove_favorite("zh-CN-Mei:MAI-Voice-2"))
            self.assertEqual(voices_repository.list_favorites(), [])

    def test_editor_roles_round_trip_uses_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(database, "DATABASE_PATH", Path(temp_dir) / "studio.db"):
            role = editor_roles_repository.create_role("  旁白  ", {"ShortName": "zh-CN-Mei:MAI-Voice-2", "LocalName": "Mei"})
            self.assertEqual(role["name"], "旁白")
            self.assertEqual(role["rate"], "medium")
            self.assertEqual(role["voice"]["ShortName"], "zh-CN-Mei:MAI-Voice-2")
            self.assertEqual(editor_roles_repository.list_roles(), [role])
            updated = editor_roles_repository.update_role(role["id"], "主持人", "x-fast")
            self.assertEqual(updated["name"], "主持人")
            self.assertEqual(updated["rate"], "x-fast")
            self.assertTrue(editor_roles_repository.delete_role(role["id"]))
            self.assertEqual(editor_roles_repository.list_roles(), [])
            with self.assertRaisesRegex(ValueError, "角色名不能为空"):
                editor_roles_repository.create_role("   ", {"ShortName": "zh-CN-Mei:MAI-Voice-2"})
