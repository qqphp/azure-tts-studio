from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.factory import create_app  # noqa: E402
from app import factory  # noqa: E402
from app.core import database  # noqa: E402
from app.services.speech import build_ssml, mime_for_format  # noqa: E402
from app.services.ssml import validate_document  # noqa: E402


class ApiRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(create_app())

    def test_health_endpoint_is_available(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_missing_frontend_build_returns_actionable_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(factory, "FRONTEND_DIST_DIR", Path(temp_dir) / "dist"):
            response = TestClient(create_app()).get("/")
        self.assertEqual(response.status_code, 503)
        self.assertIn("npm run build", response.json()["msg"])

    def test_settings_never_returns_plaintext_api_key(self) -> None:
        response = self.client.get("/api/settings")
        self.assertEqual(response.status_code, 200)
        key = response.json().get("apiKey", "")
        self.assertNotIn("***", key) if not key else self.assertTrue("***" in key)

    def test_ssml_validation_reports_structured_metadata(self) -> None:
        ssml = build_ssml("A & B", "zh-CN-XiaoxiaoNeural", {"rate": "+10%", "style": "cheerful"})
        response = self.client.post("/api/ssml/validate", json={"ssml": ssml})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["voiceCount"], 1)
        self.assertEqual(response.json()["textLength"], 5)

    def test_ssml_rejects_doctype(self) -> None:
        response = self.client.post("/api/ssml/validate", json={"ssml": "<!DOCTYPE speak>"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("DOCTYPE", response.json()["detail"])

    def test_schema_rejects_missing_ssml_before_service_layer(self) -> None:
        response = self.client.post("/api/ssml/validate", json={})
        self.assertEqual(response.status_code, 422)

    def test_schema_rejects_non_list_history_ids(self) -> None:
        response = self.client.post("/api/history/batch-delete", json={"ids": "invalid"})
        self.assertEqual(response.status_code, 422)

    def test_llm_configuration_endpoints_are_available(self) -> None:
        providers = self.client.get("/api/llm/providers")
        status = self.client.get("/api/llm/status")
        self.assertEqual(providers.status_code, 200)
        self.assertIsInstance(providers.json(), list)
        self.assertEqual(status.status_code, 200)
        self.assertIn("configured", status.json())

    def test_editor_role_is_validated_and_saved_to_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(database, "DATABASE_PATH", Path(temp_dir) / "studio.db"):
            invalid = self.client.post("/api/editor/roles", json={"name": "   ", "voice": {"ShortName": "zh-CN-Mei:MAI-Voice-2"}})
            self.assertEqual(invalid.status_code, 400)
            created = self.client.post("/api/editor/roles", json={"name": "旁白", "voice": {"ShortName": "zh-CN-Mei:MAI-Voice-2.preview", "LocalName": "Mei"}})
            self.assertEqual(created.status_code, 201)
            self.assertEqual(created.json()["name"], "旁白")
            self.assertEqual(created.json()["voice"]["ShortName"], "zh-CN-Mei:MAI-Voice-2.preview")
            self.assertEqual(created.json()["rate"], "medium")
            updated = self.client.patch(f"/api/editor/roles/{created.json()['id']}", json={"name": "主持人", "rate": "fast"})
            self.assertEqual(updated.status_code, 200)
            self.assertEqual(updated.json()["name"], "主持人")
            self.assertEqual(updated.json()["rate"], "fast")
            roles = self.client.get("/api/editor/roles")
            self.assertEqual(roles.status_code, 200)
            self.assertEqual(roles.json(), [updated.json()])
            deleted = self.client.delete(f"/api/editor/roles/{created.json()['id']}")
            self.assertEqual(deleted.status_code, 200)
            self.assertEqual(self.client.get("/api/editor/roles").json(), [])

    def test_sound_effect_crud_and_batch_delete(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(database, "DATABASE_PATH", Path(temp_dir) / "studio.db"):
            invalid = self.client.post("/api/sound-effects", json={"title": "无效", "tags": [], "category": "其他", "url": "https://example.com/file.txt"})
            self.assertEqual(invalid.status_code, 400)
            first = self.client.post("/api/sound-effects", json={"title": "鸟鸣", "tags": ["自然"], "category": "环境音", "url": "https://example.com/birds.mp3"})
            second = self.client.post("/api/sound-effects", json={"title": "转场", "tags": ["短促"], "category": "转场", "url": "https://example.com/switch.wav"})
            self.assertEqual(first.status_code, 201)
            updated = self.client.patch(f"/api/sound-effects/{first.json()['id']}", json={"title": "森林鸟鸣", "tags": ["自然", "森林"], "category": "环境音", "url": "https://example.com/birds.ogg"})
            self.assertEqual(updated.status_code, 200)
            self.assertEqual(updated.json()["title"], "森林鸟鸣")
            listed = self.client.get("/api/sound-effects")
            self.assertEqual(listed.status_code, 200)
            self.assertEqual(len(listed.json()), 2)
            deleted = self.client.post("/api/sound-effects/batch-delete", json={"ids": [first.json()["id"], second.json()["id"]]})
            self.assertEqual(deleted.json()["deleted"], 2)
            self.assertEqual(self.client.get("/api/sound-effects").json(), [])

    def test_background_music_crud_and_batch_delete(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(database, "DATABASE_PATH", Path(temp_dir) / "studio.db"):
            first = self.client.post("/api/background-music", json={"title": "轻柔钢琴", "tags": ["钢琴"], "category": "轻音乐", "url": "https://example.com/piano.mp3"})
            second = self.client.post("/api/background-music", json={"title": "片头音乐", "tags": ["片头"], "category": "影视", "url": "https://example.com/opening.wav"})
            self.assertEqual(first.status_code, 201)
            updated = self.client.patch(f"/api/background-music/{first.json()['id']}", json={"title": "夜晚钢琴", "tags": ["钢琴", "舒缓"], "category": "氛围", "url": "https://example.com/night.ogg"})
            self.assertEqual(updated.status_code, 200)
            self.assertEqual(updated.json()["title"], "夜晚钢琴")
            self.assertEqual(len(self.client.get("/api/background-music").json()), 2)
            deleted = self.client.post("/api/background-music/batch-delete", json={"ids": [first.json()["id"], second.json()["id"]]})
            self.assertEqual(deleted.json()["deleted"], 2)
            self.assertEqual(self.client.get("/api/background-music").json(), [])


class ServiceRegressionTests(unittest.TestCase):
    def test_built_ssml_escapes_text_and_keeps_expression(self) -> None:
        ssml = build_ssml("A & B", "zh-CN-XiaoxiaoNeural", {"style": "cheerful"})
        self.assertIn("A &amp; B", ssml)
        self.assertIn("mstts:express-as", ssml)
        self.assertEqual(validate_document(ssml)["voices"], ["zh-CN-XiaoxiaoNeural"])

    def test_audio_mime_mapping(self) -> None:
        self.assertEqual(mime_for_format("audio-16khz-128kbitrate-mono-mp3"), "audio/mpeg")
        self.assertEqual(mime_for_format("ogg-24khz-16bit-mono-opus"), "audio/ogg")
        self.assertEqual(mime_for_format("riff-16khz-16bit-mono-pcm"), "audio/wav")
