from __future__ import annotations

import base64
import time
import uuid
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape as xml_escape, quoteattr

import httpx

from app.core.config import DEFAULT_CONFIG, HISTORY_DIR
from app.modules.history.repository import save_metadata


def speech_api_base(config: dict[str, Any]) -> str:
    base = (config.get("endpoint") or "").strip().rstrip("/")
    return base if ".tts.speech." in base.lower() or base.lower().endswith("/tts") else f"{base}/tts"


def voices_endpoint(config: dict[str, Any]) -> str:
    return f"{speech_api_base(config)}/cognitiveservices/voices/list"


def synthesis_endpoint(config: dict[str, Any]) -> str:
    return f"{speech_api_base(config)}/cognitiveservices/v1"


def auth_headers(config: dict[str, Any]) -> dict[str, str]:
    return {
        "Ocp-Apim-Subscription-Key": config.get("apiKey", ""),
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": config.get("outputFormat", DEFAULT_CONFIG["outputFormat"]),
        "User-Agent": "azure-tts-bridge/1.0",
    }


def build_ssml(text: str, voice: str, params: dict[str, Any]) -> str:
    def attribute(name: str, value: Any) -> str:
        return f" {name}={quoteattr(str(value))}" if value else ""

    prosody = "".join(attribute(key, params.get(key)) for key in ("rate", "pitch", "volume"))
    expression = "".join((
        attribute("style", params.get("style")),
        attribute("styledegree", params.get("styleDegree")),
        attribute("role", params.get("role")),
    ))
    expression_open = f"<mstts:express-as{expression}>" if expression else ""
    prosody_open = f"<prosody{prosody}>" if prosody else ""
    prosody_close = "</prosody>" if prosody else ""
    expression_close = "</mstts:express-as>" if expression else ""
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        'xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">'
        f"<voice name={quoteattr(voice)}>{expression_open}{prosody_open}"
        f"{xml_escape(text)}{prosody_close}{expression_close}</voice></speak>"
    )


def mime_for_format(output_format: str) -> str:
    if "mp3" in output_format: return "audio/mpeg"
    if "ogg" in output_format: return "audio/ogg"
    if "webm" in output_format: return "audio/webm"
    return "audio/wav"


async def request_audio(config: dict[str, Any], ssml: str) -> bytes:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(synthesis_endpoint(config), headers=auth_headers(config), content=ssml.encode("utf-8"))
    if response.status_code != 200:
        raise RuntimeError(f"Azure 错误: {response.text[:500]}")
    return response.content


def save_audio(audio: bytes, output_format: str, metadata: dict[str, Any]) -> dict[str, Any]:
    HISTORY_DIR.mkdir(exist_ok=True)
    meta = {"id": uuid.uuid4().hex[:12], "ts": int(time.time()), "size": len(audio), "format": output_format, **metadata}
    (HISTORY_DIR / f"{meta['id']}.bin").write_bytes(audio)
    (HISTORY_DIR / f"{meta['id']}.json").write_text(__import__("json").dumps(meta, ensure_ascii=False), "utf-8")
    save_metadata(meta)
    return {"ok": True, "id": meta["id"], "audio_base64": base64.b64encode(audio).decode("ascii"), "mime": mime_for_format(output_format), "meta": meta}
