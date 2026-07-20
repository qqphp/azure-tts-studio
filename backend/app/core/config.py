from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.core.secrets import get_secret, store_secret

ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = ROOT / "config.json"
HISTORY_DIR = ROOT / "history"
STATIC_DIR = ROOT / "static"
FRONTEND_DIST_DIR = ROOT / "frontend" / "dist"

DEFAULT_CONFIG: dict[str, Any] = {
    "endpoint": "",
    "apiKey": "",
    "defaultVoice": "zh-CN-XiaoxiaoNeural",
    "defaultStyle": "",
    "defaultRate": "",
    "defaultPitch": "",
    "defaultVolume": "",
    "outputFormat": "audio-16khz-128kbitrate-mono-mp3",
    "llm": {
        "provider": "", "base": "", "apiKey": "", "defaultModel": "", "timeout": 60,
    },
}

AZURE_API_KEY_SECRET = "azure-api-key"
LLM_API_KEY_SECRET = "llm-api-key"


def default_config() -> dict[str, Any]:
    return {**deepcopy(DEFAULT_CONFIG), "llm": dict(DEFAULT_CONFIG["llm"])}


def _read_config_file() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {}
    try:
        value = json.loads(CONFIG_PATH.read_text("utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_config_file(data: dict[str, Any]) -> None:
    CONFIG_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")


def load_config() -> dict[str, Any]:
    """Load user configuration while preserving defaults added by newer releases."""
    data = _read_config_file()
    merged = default_config()
    merged.update({key: value for key, value in data.items() if key in DEFAULT_CONFIG})
    if isinstance(data.get("llm"), dict):
        merged["llm"].update(data["llm"])
    # Credential Manager values take precedence; plaintext values remain only
    # as a backward-compatible fallback until startup migration succeeds.
    merged["apiKey"] = get_secret(AZURE_API_KEY_SECRET) or str(merged.get("apiKey") or "")
    merged["llm"]["apiKey"] = get_secret(LLM_API_KEY_SECRET) or str(merged["llm"].get("apiKey") or "")
    return merged


def save_config(data: dict[str, Any]) -> dict[str, Any]:
    """Persist non-secret settings and store supplied credentials in keyring."""
    merged = load_config()
    for key in DEFAULT_CONFIG:
        if key in data and key not in {"llm", "apiKey"} and data[key] is not None:
            merged[key] = data[key]
    supplied_azure_key = str(data.get("apiKey") or "").strip()
    if supplied_azure_key and "***" not in supplied_azure_key:
        if store_secret(AZURE_API_KEY_SECRET, supplied_azure_key):
            merged["apiKey"] = supplied_azure_key
        else:
            merged["apiKey"] = supplied_azure_key
    if isinstance(data.get("llm"), dict):
        llm = dict(merged["llm"])
        llm.update({key: value for key, value in data["llm"].items() if key != "apiKey" and value not in (None, "")})
        supplied_llm_key = str(data["llm"].get("apiKey") or "").strip()
        if supplied_llm_key and "***" not in supplied_llm_key:
            llm["apiKey"] = supplied_llm_key
            store_secret(LLM_API_KEY_SECRET, supplied_llm_key)
        merged["llm"] = llm
    serialized = deepcopy(merged)
    # Never write keys when Credential Manager has accepted them. If keyring is
    # unavailable, the legacy field remains as the local-only fallback.
    if get_secret(AZURE_API_KEY_SECRET):
        serialized["apiKey"] = ""
    if get_secret(LLM_API_KEY_SECRET):
        serialized["llm"]["apiKey"] = ""
    _write_config_file(serialized)
    return merged


def migrate_legacy_secrets() -> None:
    """Move existing plaintext keys out of config.json when keyring is usable."""
    data = _read_config_file()
    changed = False
    azure_key = str(data.get("apiKey") or "").strip()
    if azure_key and not get_secret(AZURE_API_KEY_SECRET) and store_secret(AZURE_API_KEY_SECRET, azure_key):
        data["apiKey"] = ""
        changed = True
    llm = data.get("llm")
    llm_key = str(llm.get("apiKey") or "").strip() if isinstance(llm, dict) else ""
    if llm_key and not get_secret(LLM_API_KEY_SECRET) and store_secret(LLM_API_KEY_SECRET, llm_key):
        llm["apiKey"] = ""
        changed = True
    if changed:
        _write_config_file(data)


def masked_config(config: dict[str, Any]) -> dict[str, Any]:
    """Return a copy safe to return to the browser."""
    result = dict(config)
    for container, key in ((result, "apiKey"),):
        secret = container.get(key)
        if secret:
            container[key] = f"{secret[:4]}***{secret[-4:]}" if len(secret) > 10 else "***"
    llm = dict(result.get("llm") or {})
    if llm.get("apiKey"):
        secret = llm["apiKey"]
        llm["apiKey"] = f"{secret[:4]}***{secret[-4:]}" if len(secret) > 10 else "***"
    result["llm"] = llm
    return result
