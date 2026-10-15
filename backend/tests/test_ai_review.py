from __future__ import annotations

import json
import sys
import tempfile
import unittest
from functools import partial
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import llm_bridge
from app.core import config
from app.modules.ai_review.router import router as ai_router
from app.modules.settings.router import router as settings_router


class AiReviewTests(unittest.TestCase):
    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.config_path = Path(directory.name) / "config.json"
        stored = {config.LLM_API_KEY_SECRET: "test-llm-secret"}

        def store_secret(name: str, value: str) -> bool:
            stored[name] = value
            return True

        for mock in (
            patch.object(config, "CONFIG_PATH", self.config_path),
            patch.object(config, "get_secret", side_effect=lambda name: stored.get(name, "")),
            patch.object(config, "store_secret", side_effect=store_secret),
        ):
            mock.start()
            self.addCleanup(mock.stop)
        self.write_config({"base": "https://compatible.example/v1/", "defaultModel": "test-model"})
        application = FastAPI()
        application.include_router(settings_router, prefix="/api")
        application.include_router(ai_router, prefix="/api")
        self.client = TestClient(application)
        self.addCleanup(self.client.close)
        self.requests: list[httpx.Request] = []
        self.models: list[dict[str, str]] = [{"id": "test-model"}]
        self.models_status = 200

        def respond(request: httpx.Request) -> httpx.Response:
            self.requests.append(request)
            if request.url.path == "/v1/models":
                return httpx.Response(self.models_status, json={"data": self.models})
            if request.url.path == "/v1/chat/completions":
                content = json.dumps({"tts_text": "优化后的文本", "summary": "已优化", "score": 95})
                return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
            raise AssertionError(f"Unexpected request: {request.method} {request.url}")

        # All upstream traffic is intercepted; no real credentials or network are used.
        transport = httpx.MockTransport(respond)
        client_patch = patch.object(llm_bridge.httpx, "AsyncClient", partial(httpx.AsyncClient, transport=transport))
        client_patch.start()
        self.addCleanup(client_patch.stop)

    def write_config(self, llm: dict) -> None:
        self.config_path.write_text(json.dumps({"llm": llm}), "utf-8")

    def test_provider_free_models_and_optimization_use_compatible_protocol(self) -> None:
        models = self.client.get("/api/llm/models")
        self.assertEqual(models.status_code, 200)
        self.assertEqual(models.json()[0]["id"], "test-model")
        result = self.client.post("/api/llm/check", json={"text": "需要优化"})
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()["ok"])
        self.assertEqual(result.json()["result"]["tts_text"], "优化后的文本")
        self.assertEqual([(request.method, str(request.url)) for request in self.requests], [
            ("GET", "https://compatible.example/v1/models"),
            ("POST", "https://compatible.example/v1/chat/completions"),
        ])
        self.assertTrue(all(request.headers["Authorization"] == "Bearer test-llm-secret" for request in self.requests))
        payload = json.loads(self.requests[-1].content)
        self.assertEqual(payload["model"], "test-model")
        self.assertEqual(payload["response_format"], {"type": "json_object"})

    def test_legacy_provider_settings_are_resolved_without_rewriting_file(self) -> None:
        self.write_config({"provider": "deepseek"})
        original = self.config_path.read_bytes()
        settings = self.client.get("/api/settings").json()
        self.assertEqual(settings["llm"]["base"], llm_bridge.PROVIDERS["deepseek"]["base"])
        self.assertEqual(settings["llm"]["defaultModel"], llm_bridge.PROVIDERS["deepseek"]["default_model"])
        self.assertEqual(self.config_path.read_bytes(), original)
        self.assertNotIn("test-llm-secret", json.dumps(settings))

    def test_explicit_settings_override_legacy_provider(self) -> None:
        self.write_config({"provider": "deepseek", "base": "https://compatible.example/v1", "defaultModel": "test-model"})
        settings = self.client.get("/api/settings").json()
        self.assertEqual(settings["llm"]["base"], "https://compatible.example/v1")
        self.assertEqual(settings["llm"]["defaultModel"], "test-model")

    def test_save_and_reload_keep_model_and_stored_key(self) -> None:
        for key_fields in ({}, {"apiKey": ""}):
            with self.subTest(key_fields=key_fields):
                response = self.client.post("/api/settings", json={"llm": {
                    "base": "https://compatible.example/v1", "defaultModel": "selected-model", **key_fields,
                }})
                self.assertEqual(response.status_code, 200)
                settings = response.json()
                self.assertEqual(settings["llm"]["defaultModel"], "selected-model")
                self.assertIn("***", settings["llm"]["apiKey"])
                self.assertNotIn("test-llm-secret", response.text)
                self.assertEqual(self.client.get("/api/settings").json(), settings)
                self.assertEqual(config.load_config()["llm"]["apiKey"], "test-llm-secret")
                self.assertEqual(json.loads(self.config_path.read_text("utf-8"))["llm"]["apiKey"], "")

    def test_new_key_is_stored_and_never_returned_in_plaintext(self) -> None:
        result = self.client.post("/api/settings", json={"llm": {"apiKey": "replacement-secret-key"}})
        self.assertEqual(result.status_code, 200)
        self.assertNotIn("replacement-secret-key", result.text)
        self.assertEqual(config.load_config()["llm"]["apiKey"], "replacement-secret-key")

    def test_empty_model_list_is_returned_without_inventing_a_model(self) -> None:
        self.models = []
        result = self.client.get("/api/llm/models")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json(), [])

    def test_model_request_failure_is_reported(self) -> None:
        self.models_status = 401
        result = self.client.get("/api/llm/models")
        self.assertEqual(result.status_code, 502)
        self.assertIn("HTTP 401", result.json()["detail"])
        connection = self.client.post("/api/llm/test", json={}).json()
        self.assertFalse(connection["ok"])
        self.assertIn("HTTP 401", connection["error"])

    def test_missing_key_prevents_model_request(self) -> None:
        with patch.object(config, "get_secret", return_value=""):
            result = self.client.get("/api/llm/models")
        self.assertEqual(result.status_code, 400)
        self.assertEqual(self.requests, [])
