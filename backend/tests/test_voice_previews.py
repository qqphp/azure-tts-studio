from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services import voice_previews


class VoicePreviewServiceTests(unittest.IsolatedAsyncioTestCase):
    def test_locale_specific_and_language_fallback_samples(self) -> None:
        self.assertIn("American", voice_previews.preview_text_for("en-US"))
        self.assertIn("canadienne", voice_previews.preview_text_for("fr-CA"))
        self.assertEqual(voice_previews.preview_text_for("ja-JP"), voice_previews.LANGUAGE_SAMPLE_TEXTS["ja"])
        self.assertEqual(voice_previews.preview_text_for("unknown"), voice_previews.LANGUAGE_SAMPLE_TEXTS["en"])

    async def test_preview_is_generated_once_and_then_reused(self) -> None:
        voice = {"ShortName": "zh-CN-Test:Neural.preview", "Locale": "zh-CN"}
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(voice_previews, "VOICE_PREVIEW_DIR", Path(temp_dir)), patch.object(voice_previews, "request_audio", new=AsyncMock(return_value=b"preview-audio")) as request:
            first = await voice_previews.ensure_voice_preview({"endpoint": "https://example.test", "apiKey": "secret"}, voice)
            second = await voice_previews.ensure_voice_preview({"endpoint": "https://example.test", "apiKey": "secret"}, voice)
            entries = voice_previews.list_voice_previews()

        self.assertFalse(first["cached"])
        self.assertTrue(second["cached"])
        self.assertEqual(first["fileName"], second["fileName"])
        self.assertNotIn(":", first["fileName"])
        self.assertEqual(len(entries), 1)
        request.assert_awaited_once()
        preview_config, ssml = request.await_args.args
        self.assertEqual(preview_config["outputFormat"], voice_previews.PREVIEW_OUTPUT_FORMAT)
        self.assertIn('xml:lang="zh-CN"', ssml)
        self.assertIn('voice name="zh-CN-Test:Neural.preview"', ssml)
