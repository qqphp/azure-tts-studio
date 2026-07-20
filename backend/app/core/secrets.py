"""System credential-store adapter.

On Windows, keyring uses Credential Manager. The functions deliberately return
safe fallbacks so a local app stays usable on systems without a credential
backend, while retaining legacy config values until they can be migrated.
"""
from __future__ import annotations

try:
    import keyring
except ImportError:  # pragma: no cover - guarded by requirements.txt
    keyring = None

SERVICE_NAME = "Azure-TTS-Studio"


def get_secret(name: str) -> str:
    if not keyring:
        return ""
    try:
        return keyring.get_password(SERVICE_NAME, name) or ""
    except Exception:
        return ""


def store_secret(name: str, value: str) -> bool:
    if not value or not keyring:
        return False
    try:
        keyring.set_password(SERVICE_NAME, name, value)
        return True
    except Exception:
        return False
