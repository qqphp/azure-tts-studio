from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any

from app.core.config import VOICE_PREVIEW_DIR
from app.services.speech import build_ssml, request_audio

PREVIEW_VERSION = 1
PREVIEW_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"
MANIFEST_NAME = "manifest.json"

# Prefer country/region-specific copy where wording differs naturally. The
# language fallback keeps every Azure locale usable without maintaining a
# sentence for every regional variant in the voice catalog.
LOCALE_SAMPLE_TEXTS: dict[str, str] = {
    "zh-CN": "你好，欢迎试听这款自然流畅的中文声音。",
    "zh-HK": "你好，歡迎試聽呢把自然流暢嘅廣東話聲音。",
    "zh-TW": "您好，歡迎試聽這款自然流暢的中文語音。",
    "en-US": "Hello, and welcome to this natural American English voice preview.",
    "en-GB": "Hello, and welcome to this natural British English voice preview.",
    "en-AU": "Hello, and welcome to this natural Australian English voice preview.",
    "en-CA": "Hello, and welcome to this natural Canadian English voice preview.",
    "en-IN": "Hello, and welcome to this natural Indian English voice preview.",
    "en-IE": "Hello, and welcome to this natural Irish English voice preview.",
    "en-NZ": "Hello, and welcome to this natural New Zealand English voice preview.",
    "es-ES": "Hola, te damos la bienvenida a esta muestra de voz en español de España.",
    "es-MX": "Hola, te damos la bienvenida a esta muestra de voz en español de México.",
    "es-US": "Hola, te damos la bienvenida a esta muestra de voz en español de Estados Unidos.",
    "es-AR": "Hola, te damos la bienvenida a esta muestra de voz en español de Argentina.",
    "fr-FR": "Bonjour et bienvenue dans cet aperçu d'une voix française naturelle.",
    "fr-CA": "Bonjour et bienvenue dans cet aperçu d'une voix française canadienne naturelle.",
    "fr-CH": "Bonjour et bienvenue dans cet aperçu d'une voix française suisse naturelle.",
    "pt-BR": "Olá, conheça esta demonstração de uma voz natural do português brasileiro.",
    "pt-PT": "Olá, conheça esta demonstração de uma voz natural do português europeu.",
    "de-DE": "Hallo und willkommen bei dieser Hörprobe einer natürlichen deutschen Stimme.",
    "de-AT": "Hallo und willkommen bei dieser Hörprobe einer natürlichen österreichischen Stimme.",
    "de-CH": "Hallo und willkommen bei dieser Hörprobe einer natürlichen Schweizer Stimme.",
}

LANGUAGE_SAMPLE_TEXTS: dict[str, str] = {
    "ar": "مرحبًا، استمع إلى هذا النموذج لصوت طبيعي وواضح.",
    "bg": "Здравейте, чуйте тази демонстрация на естествен и ясен глас.",
    "ca": "Hola, escolta aquesta mostra d'una veu natural i clara.",
    "cs": "Dobrý den, poslechněte si ukázku přirozeného a srozumitelného hlasu.",
    "da": "Hej, lyt til denne prøve på en naturlig og tydelig stemme.",
    "de": "Hallo, hören Sie sich diese natürliche und klare Stimme an.",
    "el": "Γεια σας, ακούστε αυτό το δείγμα μιας φυσικής και καθαρής φωνής.",
    "en": "Hello, and welcome to this natural and clear voice preview.",
    "es": "Hola, escucha esta muestra de una voz natural y clara.",
    "et": "Tere, kuulake seda loomuliku ja selge hääle näidist.",
    "fi": "Hei, kuuntele tämä luonnollisen ja selkeän äänen näyte.",
    "fr": "Bonjour, écoutez cet aperçu d'une voix naturelle et claire.",
    "he": "שלום, האזינו לדוגמה של קול טבעי וברור.",
    "hi": "नमस्ते, इस स्वाभाविक और स्पष्ट आवाज़ का नमूना सुनिए।",
    "hr": "Pozdrav, poslušajte ovaj primjer prirodnog i jasnog glasa.",
    "hu": "Üdvözöljük, hallgassa meg ezt a természetes és tiszta hangmintát.",
    "id": "Halo, dengarkan contoh suara yang alami dan jelas ini.",
    "it": "Ciao, ascolta questa anteprima di una voce naturale e chiara.",
    "ja": "こんにちは。自然で聞き取りやすい音声のサンプルをお聴きください。",
    "ko": "안녕하세요. 자연스럽고 또렷한 음성 미리 듣기입니다.",
    "lt": "Sveiki, paklausykite šio natūralaus ir aiškaus balso pavyzdžio.",
    "lv": "Sveiki, noklausieties šo dabiskas un skaidras balss paraugu.",
    "ms": "Helo, dengarkan pratonton suara yang semula jadi dan jelas ini.",
    "nb": "Hei, lytt til denne prøven på en naturlig og tydelig stemme.",
    "nl": "Hallo, luister naar dit voorbeeld van een natuurlijke en heldere stem.",
    "pl": "Dzień dobry, posłuchaj próbki naturalnego i wyraźnego głosu.",
    "pt": "Olá, ouça esta amostra de uma voz natural e clara.",
    "ro": "Bună ziua, ascultați această mostră de voce naturală și clară.",
    "ru": "Здравствуйте, послушайте пример естественного и четкого голоса.",
    "sk": "Dobrý deň, vypočujte si ukážku prirodzeného a zrozumiteľného hlasu.",
    "sl": "Pozdravljeni, poslušajte ta primer naravnega in jasnega glasu.",
    "sv": "Hej, lyssna på detta prov av en naturlig och tydlig röst.",
    "ta": "வணக்கம், இயல்பான மற்றும் தெளிவான இந்தக் குரல் மாதிரியைக் கேளுங்கள்.",
    "te": "నమస్కారం, సహజమైన మరియు స్పష్టమైన ఈ స్వర నమూనాను వినండి.",
    "th": "สวัสดี โปรดลองฟังตัวอย่างเสียงที่เป็นธรรมชาติและชัดเจนนี้",
    "tr": "Merhaba, bu doğal ve anlaşılır ses örneğini dinleyin.",
    "uk": "Вітаємо, прослухайте приклад природного та чіткого голосу.",
    "ur": "السلام علیکم، اس قدرتی اور واضح آواز کا نمونہ سنیے۔",
    "vi": "Xin chào, hãy nghe thử giọng đọc tự nhiên và rõ ràng này.",
    "zh": "你好，欢迎试听这款自然流畅的中文声音。",
}

_generation_lock = asyncio.Lock()


def preview_text_for(locale: str) -> str:
    normalized = (locale or "").strip()
    language = normalized.split("-", 1)[0].lower()
    return LOCALE_SAMPLE_TEXTS.get(normalized) or LANGUAGE_SAMPLE_TEXTS.get(language) or LANGUAGE_SAMPLE_TEXTS["en"]


def preview_filename(voice: dict[str, Any]) -> str:
    short_name = str(voice.get("ShortName") or "").strip()
    locale = str(voice.get("Locale") or "").strip()
    text = preview_text_for(locale)
    fingerprint = hashlib.sha256(f"{PREVIEW_VERSION}|{short_name}|{locale}|{text}".encode("utf-8")).hexdigest()[:16]
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", short_name).strip("._-")[:80] or "voice"
    return f"{safe_name}--{fingerprint}.mp3"


def _manifest_path() -> Path:
    return VOICE_PREVIEW_DIR / MANIFEST_NAME


def _read_manifest() -> dict[str, dict[str, Any]]:
    path = _manifest_path()
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text("utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_manifest(manifest: dict[str, dict[str, Any]]) -> None:
    VOICE_PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    target = _manifest_path()
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), "utf-8")
    temporary.replace(target)


def preview_file_path(file_name: str) -> Path | None:
    if Path(file_name).name != file_name or not re.fullmatch(r"[A-Za-z0-9._-]+\.mp3", file_name):
        return None
    return VOICE_PREVIEW_DIR / file_name


def list_voice_previews() -> list[dict[str, Any]]:
    entries = []
    for entry in _read_manifest().values():
        file_name = str(entry.get("fileName") or "")
        path = preview_file_path(file_name)
        if path and path.is_file():
            entries.append(entry)
    return sorted(entries, key=lambda entry: str(entry.get("shortName") or ""))


async def ensure_voice_preview(config: dict[str, Any], voice: dict[str, Any]) -> dict[str, Any]:
    short_name = str(voice.get("ShortName") or "").strip()
    if not short_name:
        raise ValueError("音色缺少 ShortName")
    locale = str(voice.get("Locale") or "").strip() or short_name[:5]
    file_name = preview_filename({**voice, "Locale": locale})
    path = VOICE_PREVIEW_DIR / file_name
    text = preview_text_for(locale)

    async with _generation_lock:
        manifest = _read_manifest()
        cached = path.is_file()
        if not cached:
            preview_config = {**config, "outputFormat": PREVIEW_OUTPUT_FORMAT}
            audio = await request_audio(preview_config, build_ssml(text, short_name, {}, locale=locale))
            VOICE_PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
            path.write_bytes(audio)
        entry = {
            "shortName": short_name,
            "locale": locale,
            "text": text,
            "fileName": file_name,
            "createdAt": int(path.stat().st_mtime),
            "version": PREVIEW_VERSION,
        }
        manifest[short_name] = entry
        _write_manifest(manifest)
    return {**entry, "cached": cached}
