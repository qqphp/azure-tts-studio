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
            created = self.client.post("/api/editor/roles", json={"name": "旁白", "voice": {"ShortName": "zh-CN-Mei:MAI-Voice-2", "LocalName": "Mei"}})
            self.assertEqual(created.status_code, 201)
            self.assertEqual(created.json()["name"], "旁白")
            self.assertEqual(created.json()["voice"]["ShortName"], "zh-CN-Mei:MAI-Voice-2")
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
