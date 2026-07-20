from fastapi import APIRouter, HTTPException

from app.core.config import DEFAULT_CONFIG
from app.modules.dependencies import require_speech_config
from app.schemas import SpeakPayload, SsmlPayload
from app.services.speech import build_ssml, request_audio, save_audio
from app.services.ssml import validate_document

router = APIRouter(tags=["synthesis"])


@router.post("/speak")
async def speak(payload: SpeakPayload) -> dict:
    config, body = require_speech_config(), payload.model_dump()
    text = payload.text.strip()
    if not text:
        raise HTTPException(400, "text 不能为空")
    voice = body.get("voice") or config.get("defaultVoice") or "zh-CN-XiaoxiaoNeural"
    params = {key: body.get(key, config.get(default, "")) for key, default in {"rate": "defaultRate", "pitch": "defaultPitch", "volume": "defaultVolume", "style": "defaultStyle"}.items()}
    params.update({"styleDegree": body.get("styleDegree", ""), "role": body.get("role", "")})
    chunks = [text[index:index + 1800] for index in range(0, len(text), 1800)]
    try:
        audio = b"".join([await request_audio(config, build_ssml(chunk, voice, params)) for chunk in chunks])
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from exc
    return save_audio(audio, config.get("outputFormat", DEFAULT_CONFIG["outputFormat"]), {"voice": voice, "params": params, "text": text[:200] + ("…" if len(text) > 200 else ""), "text_len": len(text), "chunks": len(chunks), "mode": "quick"})


@router.post("/ssml/validate")
async def validate_ssml(payload: SsmlPayload) -> dict:
    try:
        info = validate_document(payload.ssml)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, **{key: value for key, value in info.items() if key != "ssml"}}


@router.post("/speak-ssml")
async def speak_ssml(payload: SsmlPayload) -> dict:
    config = require_speech_config()
    try:
        info = validate_document(payload.ssml)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    try:
        audio = await request_audio(config, info["ssml"])
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from exc
    label = info["voices"][0] + (f" 等 {info['voiceCount']} 个音色" if info["voiceCount"] > 1 else "")
    return save_audio(audio, config.get("outputFormat", DEFAULT_CONFIG["outputFormat"]), {"voice": label, "voices": info["voices"], "params": {"ssml": True}, "text": info["textPreview"] or "[SSML 音频内容]", "text_len": info["textLength"], "ssml_chars": info["characters"], "chunks": 1, "mode": "professional"})
