from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core import database
from app.modules.history import repository as history_repository
from app.modules.editor_roles import repository as editor_roles_repository
from app.modules.sound_effects import repository as sound_effects_repository
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
            short_name = "zh-CN-Mei:MAI-Voice-2.preview"
            self.assertEqual(voices_repository.add_favorite({"ShortName": short_name, "LocalName": "Mei"}), short_name)
            self.assertEqual(voices_repository.list_favorites(), [short_name])
            self.assertTrue(voices_repository.remove_favorite(short_name))
            self.assertEqual(voices_repository.list_favorites(), [])

    def test_editor_roles_round_trip_uses_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(database, "DATABASE_PATH", Path(temp_dir) / "studio.db"):
            role = editor_roles_repository.create_role("  旁白  ", {"ShortName": "zh-CN-Mei:MAI-Voice-2.preview", "LocalName": "Mei"})
            self.assertEqual(role["name"], "旁白")
            self.assertEqual(role["rate"], "medium")
            self.assertEqual(role["voice"]["ShortName"], "zh-CN-Mei:MAI-Voice-2.preview")
            self.assertEqual(editor_roles_repository.list_roles(), [role])
            updated = editor_roles_repository.update_role(role["id"], "主持人", "x-fast")
            self.assertEqual(updated["name"], "主持人")
            self.assertEqual(updated["rate"], "x-fast")
            self.assertTrue(editor_roles_repository.delete_role(role["id"]))
            self.assertEqual(editor_roles_repository.list_roles(), [])
            with self.assertRaisesRegex(ValueError, "角色名不能为空"):
                editor_roles_repository.create_role("   ", {"ShortName": "zh-CN-Mei:MAI-Voice-2"})

    def test_sound_effects_round_trip_and_batch_delete(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(database, "DATABASE_PATH", Path(temp_dir) / "studio.db"):
            first = sound_effects_repository.create_sound_effect(" 清晨鸟鸣 ", ["自然", "清晨", "自然"], "环境音", "https://example.com/birds.mp3?version=1")
            second = sound_effects_repository.create_sound_effect("转场", ["短促"], "转场", "https://example.com/transition.wav")
            self.assertEqual(first["title"], "清晨鸟鸣")
            self.assertEqual(first["tags"], ["自然", "清晨"])
            self.assertEqual(sound_effects_repository.list_sound_effects(), [second, first])
            updated = sound_effects_repository.update_sound_effect(first["id"], "森林鸟鸣", ["森林"], "环境音", "https://example.com/forest.ogg")
            self.assertEqual(updated["title"], "森林鸟鸣")
            deleted, missing = sound_effects_repository.delete_sound_effects([first["id"], second["id"], 9999])
            self.assertEqual(deleted, 2)
            self.assertEqual(missing, [9999])
            self.assertEqual(sound_effects_repository.list_sound_effects(), [])
            with self.assertRaisesRegex(ValueError, "音频文件格式无效"):
                sound_effects_repository.create_sound_effect("无效", [], "其他", "https://example.com/file.txt")
