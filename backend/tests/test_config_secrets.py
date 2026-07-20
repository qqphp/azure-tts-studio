from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core import config


class ConfigSecretTests(unittest.TestCase):
    def test_legacy_plaintext_keys_migrate_to_credential_store(self) -> None:
        stored: dict[str, str] = {}

        def get_secret(name: str) -> str:
            return stored.get(name, "")

        def store_secret(name: str, value: str) -> bool:
            stored[name] = value
            return True

        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "config.json"
            path.write_text(json.dumps({"apiKey": "azure-secret", "llm": {"apiKey": "llm-secret"}}), "utf-8")
            with patch.object(config, "CONFIG_PATH", path), patch.object(config, "get_secret", side_effect=get_secret), patch.object(config, "store_secret", side_effect=store_secret):
                config.migrate_legacy_secrets()
                persisted = json.loads(path.read_text("utf-8"))
                loaded = config.load_config()
        self.assertEqual(stored[config.AZURE_API_KEY_SECRET], "azure-secret")
        self.assertEqual(stored[config.LLM_API_KEY_SECRET], "llm-secret")
        self.assertEqual(persisted["apiKey"], "")
        self.assertEqual(persisted["llm"]["apiKey"], "")
        self.assertEqual(loaded["apiKey"], "azure-secret")
        self.assertEqual(loaded["llm"]["apiKey"], "llm-secret")
