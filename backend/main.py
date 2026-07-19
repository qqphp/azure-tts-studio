"""微软 Azure 文本转语音后端。

经典 Azure AI Speech 资源(AIServices)REST 形式:
- 列出音色:GET {endpoint}/tts/cognitiveservices/voices/list
- 合成语音:POST {endpoint}/tts/cognitiveservices/v1   body 为 SSML

提供:
- GET  /                  前端 UI
- GET  /api/settings      读取配置(脱敏)
- POST /api/settings      保存配置
- POST /api/test          测试连接
- GET  /api/voices        列出音色(可带 ?locale=)
- POST /api/speak         合成语音
- GET  /api/history       历史元数据
- GET  /api/history/{id}  下载某条历史
- DELETE /api/history/{id}  删除某条历史
"""

from __future__ import annotations

import base64
import json
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

try:
    import llm_bridge
except Exception:
    llm_bridge = None

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config.json"
HISTORY_DIR = ROOT / "history"
STATIC_DIR = ROOT / "static"

HISTORY_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Azure TTS Bridge")


# ----------------------------- 配置 ---------------------------------------
DEFAULT_CONFIG = {
    "endpoint": "",  # e.g. https://xxx.services.ai.azure.com/  或 https://eastus.tts.speech.microsoft.com
    "apiKey": "",
    "defaultVoice": "zh-CN-XiaoxiaoNeural",
    "defaultStyle": "",
    "defaultRate": "",
    "defaultPitch": "",
    "defaultVolume": "",
    "outputFormat": "audio-16khz-128kbitrate-mono-mp3",
    "llm": {
        "provider": "",       # zhipu / deepseek / kimi / qwen / minimax / doubao / custom
        "base": "",           # OpenAI 兼容 base URL
        "apiKey": "",
        "defaultModel": "",   # 必选
        "timeout": 60,
    },
}


def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return DEFAULT_CONFIG.copy()
    try:
        data = json.loads(CONFIG_PATH.read_text("utf-8"))
        merged = DEFAULT_CONFIG.copy()
        merged.update({k: v for k, v in data.items() if k in DEFAULT_CONFIG})
        return merged
    except Exception:
        return DEFAULT_CONFIG.copy()


def save_config(cfg: dict[str, Any]) -> dict[str, Any]:
    merged = load_config()
    for k in DEFAULT_CONFIG:
        if k in cfg and cfg[k] is not None:
            merged[k] = cfg[k]
    # llm 是子对象;对未传字段做合并(避免 apiKey 因脱敏没传而被清空)
    if isinstance(cfg.get("llm"), dict):
        cur = dict(merged.get("llm") or {})
        cur.update({k: v for k, v in cfg["llm"].items()
                    if v is not None and v != ""})
        # 允许显式清空(传空字符串清除):用空字符串 → 视为已传,我们仍用原值兜底
        # 上述 .items 过滤了空串,如要清空请前往 config.json 手动改
        merged["llm"] = cur
    CONFIG_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2), "utf-8")
    return merged


def mask(cfg: dict[str, Any]) -> dict[str, Any]:
    out = dict(cfg)
    if out.get("apiKey"):
        k = out["apiKey"]
        out["apiKey"] = (k[:4] + "***" + k[-4:]) if len(k) > 10 else "***"
    llm = dict(out.get("llm") or {})
    if llm.get("apiKey"):
        k = llm["apiKey"]
        llm["apiKey"] = (k[:4] + "***" + k[-4:]) if len(k) > 10 else "***"
    out["llm"] = llm
    return out


def normalize_endpoint(cfg: dict[str, Any]) -> str:
    """返回不带尾部斜杠的 base。只走 endpoint,不自动拼 region。"""
    return (cfg.get("endpoint") or "").strip().rstrip("/")


def speech_api_base(cfg: dict[str, Any]) -> str:
    """返回 Speech REST API 的资源基地址。"""
    base = normalize_endpoint(cfg)
    if ".tts.speech." in base.lower() or base.lower().endswith("/tts"):
        return base
    return base + "/tts"


def tts_endpoint(cfg: dict[str, Any]) -> str:
    return speech_api_base(cfg) + "/cognitiveservices/v1"


def voices_endpoint(cfg: dict[str, Any]) -> str:
    return speech_api_base(cfg) + "/cognitiveservices/voices/list"


def auth_headers(cfg: dict[str, Any]) -> dict[str, str]:
    return {
        "Ocp-Apim-Subscription-Key": cfg.get("apiKey", ""),
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": cfg.get("outputFormat", DEFAULT_CONFIG["outputFormat"]),
        "User-Agent": "azure-tts-bridge/1.0",
    }


def build_ssml(text: str, voice: str, params: dict[str, Any]) -> str:
    rate = params.get("rate") or ""
    pitch = params.get("pitch") or ""
    volume = params.get("volume") or ""
    style = params.get("style") or ""
    style_degree = params.get("styleDegree") or ""
    role = params.get("role") or ""

    def attr(name: str, val: str) -> str:
        return f' {name}="{val}"' if val else ""

    prosody = attr("rate", rate) + attr("pitch", pitch) + attr("volume", volume)
    express_as = ""
    if style or style_degree or role:
        inner = attr("style", style) + attr("styledegree", style_degree) + attr("role", role)
        express_as = f'<mstts:express-as{inner}>'
    prosody_open = f'<prosody{prosody}>' if prosody else ''
    prosody_close = '</prosody>' if prosody else ''
    express_close = '</mstts:express-as>' if express_as else ''

    return (
        '<speak version="1.0" '
        'xmlns="http://www.w3.org/2001/10/synthesis" '
        'xmlns:mstts="http://www.w3.org/2001/mstts" '
        'xml:lang="zh-CN">'
        f'<voice name="{voice}">'
        f'{express_as}{prosody_open}{text}{prosody_close}{express_close}'
        '</voice></speak>'
    )


def mime_for_format(fmt: str) -> str:
    if "mp3" in fmt:
        return "audio/mpeg"
    if "ogg" in fmt:
        return "audio/ogg"
    if "webm" in fmt:
        return "audio/webm"
    return "audio/wav"


# ----------------------------- 路由 ---------------------------------------
@app.get("/api/settings")
def get_settings():
    return mask(load_config())


@app.post("/api/settings")
async def set_settings(req: Request):
    body = await req.json()
    saved = save_config(body)
    return mask(saved)


@app.post("/api/test")
async def test_connection(req: Request):
    """测试连接:列出音色中的前 1 条即视为成功。"""
    raw = await req.body()
    body = json.loads(raw) if raw else {}
    cfg = load_config()
    if body:
        for k in DEFAULT_CONFIG:
            if k in body and body[k] is not None:
                cfg[k] = body[k]
    if not cfg.get("apiKey") or not cfg.get("endpoint"):
        return {"ok": False, "error": "endpoint 与 apiKey 必填"}

    url = voices_endpoint(cfg)
    headers = {k: v for k, v in auth_headers(cfg).items() if k != "Content-Type"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as cli:
            r = await cli.get(url, headers=headers)
        if r.status_code == 200:
            voices = r.json()
            zh = [v for v in voices if v.get("Locale", "").startswith("zh")]
            sample = zh[0] if zh else (voices[0] if voices else None)
            return {
                "ok": True,
                "count": len(voices),
                "zh_count": len(zh),
                "sample_voice": sample.get("ShortName") if sample else None,
                "url": url,
            }
        return {
            "ok": False,
            "error": f"HTTP {r.status_code}: {r.text[:200]}",
            "url": url,
            "status": r.status_code,
        }
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}", "url": url}


@app.get("/api/voices")
async def list_voices(locale: str | None = None):
    cfg = load_config()
    if not cfg.get("apiKey"):
        raise HTTPException(401, "未配置 apiKey")
    if not (cfg.get("endpoint")):
        raise HTTPException(400, "未配置 endpoint")

    url = voices_endpoint(cfg)
    headers = {k: v for k, v in auth_headers(cfg).items() if k != "Content-Type"}
    async with httpx.AsyncClient(timeout=30.0) as cli:
        r = await cli.get(url, headers=headers)
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.text[:500])
    voices = r.json()
    voices.sort(key=lambda v: (0 if v.get("Locale", "").startswith("zh") else 1,
                                v.get("Locale", ""), v.get("ShortName", "")))
    if locale:
        voices = [v for v in voices if v.get("Locale") == locale]
    return voices


@app.post("/api/speak")
async def speak(req: Request):
    cfg = load_config()
    if not cfg.get("apiKey"):
        raise HTTPException(401, "未配置 apiKey")
    if not (cfg.get("endpoint")):
        raise HTTPException(400, "未配置 endpoint")
    body = await req.json()
    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "text 不能为空")

    voice = body.get("voice") or cfg.get("defaultVoice") or "zh-CN-XiaoxiaoNeural"
    params = {
        "rate":       body.get("rate",       cfg.get("defaultRate",   "")),
        "pitch":      body.get("pitch",      cfg.get("defaultPitch",  "")),
        "volume":     body.get("volume",     cfg.get("defaultVolume", "")),
        "style":      body.get("style",      cfg.get("defaultStyle",  "")),
        "styleDegree": body.get("styleDegree", ""),
        "role":       body.get("role",       ""),
    }
    fmt = cfg.get("outputFormat", DEFAULT_CONFIG["outputFormat"])
    cfg["outputFormat"] = fmt

    # Azure 单次约 5000 字符上限,保守按 1800 分段;多段做简单 mp3 字节拼接
    CHUNK = 1800
    chunks = [text[i:i + CHUNK] for i in range(0, len(text), CHUNK)] if len(text) > CHUNK else [text]

    url = tts_endpoint(cfg)
    headers = auth_headers(cfg)

    async with httpx.AsyncClient(timeout=120.0) as cli:
        if len(chunks) == 1:
            ssml = build_ssml(chunks[0], voice, params)
            r = await cli.post(url, headers=headers, content=ssml.encode("utf-8"))
            if r.status_code != 200:
                raise HTTPException(r.status_code, f"Azure 错误: {r.text[:300]}")
            audio = r.content
        else:
            parts: list[bytes] = []
            for c in chunks:
                ssml = build_ssml(c, voice, params)
                r = await cli.post(url, headers=headers, content=ssml.encode("utf-8"))
                if r.status_code != 200:
                    raise HTTPException(r.status_code, f"Azure 错误: {r.text[:300]}")
                parts.append(r.content)
            audio = b"".join(parts)

    meta = {
        "id": uuid.uuid4().hex[:12],
        "ts": int(time.time()),
        "voice": voice,
        "params": params,
        "text": text if len(text) <= 200 else text[:200] + "…",
        "text_len": len(text),
        "chunks": len(chunks),
        "size": len(audio),
        "format": fmt,
    }
    (HISTORY_DIR / f"{meta['id']}.bin").write_bytes(audio)
    (HISTORY_DIR / f"{meta['id']}.json").write_text(json.dumps(meta, ensure_ascii=False), "utf-8")

    return {
        "ok": True,
        "id": meta["id"],
        "audio_base64": base64.b64encode(audio).decode("ascii"),
        "mime": mime_for_format(fmt),
        "meta": meta,
    }


@app.get("/api/history")
def history():
    items = []
    for p in HISTORY_DIR.glob("*.json"):
        try:
            items.append(json.loads(p.read_text("utf-8")))
        except Exception:
            continue
    items.sort(key=lambda x: x.get("ts", 0), reverse=True)
    return items


@app.get("/api/history/{hid}")
def history_item(hid: str):
    hid = "".join(c for c in hid if c.isalnum())
    meta_p = HISTORY_DIR / f"{hid}.json"
    bin_p = HISTORY_DIR / f"{hid}.bin"
    if not meta_p.exists() or not bin_p.exists():
        raise HTTPException(404, "不存在")
    meta = json.loads(meta_p.read_text("utf-8"))
    return FileResponse(bin_p, media_type=mime_for_format(meta.get("format", "")),
                        filename=f"{hid}." + ("mp3" if "mp3" in meta.get("format", "") else "wav"))


@app.delete("/api/history/{hid}")
def history_delete(hid: str):
    hid = "".join(c for c in hid if c.isalnum())
    for ext in (".json", ".bin"):
        p = HISTORY_DIR / f"{hid}{ext}"
        if p.exists():
            p.unlink()
    return {"ok": True}


@app.post("/api/history/batch-delete")
async def history_batch_delete(req: Request):
    """批量删除历史。body: {"ids": ["id1","id2",...]} -> {"ok":true,"deleted":N,"missing":[...]}"""
    body = await req.json()
    ids = body.get("ids") or []
    if not isinstance(ids, list):
        raise HTTPException(400, "ids 必须是数组")
    deleted = 0
    missing: list[str] = []
    for raw in ids:
        hid = "".join(c for c in str(raw) if c.isalnum())
        if not hid:
            continue
        hit = False
        for ext in (".json", ".bin"):
            p = HISTORY_DIR / f"{hid}{ext}"
            if p.exists():
                p.unlink()
                hit = True
        if hit:
            deleted += 1
        else:
            missing.append(hid)
    return {"ok": True, "deleted": deleted, "missing": missing}


# ----------------------------- LLM (大模型) ------------------------------
@app.get("/api/llm/providers")
def llm_providers():
    """返回厂商预设,供前端下拉渲染。"""
    return [{"id": k, "label": v["label"], "base": v["base"], "default_model": v["default_model"]}
            for k, v in llm_bridge.PROVIDERS.items()]


@app.get("/api/llm/status")
def llm_status():
    """前端用来决定 AI 检测按钮是否可点。"""
    if not llm_bridge:
        return {"configured": False}
    return {"configured": llm_bridge.is_configured(load_config()),
            "model": llm_bridge.resolve_default_model(load_config())}


@app.post("/api/llm/test")
async def llm_test(req: Request):
    """测试 LLM 连接:列模型。body 可带临时配置,用于保存前测试。"""
    if not llm_bridge:
        return {"ok": False, "error": "llm_bridge 未加载"}
    raw = await req.body()
    body = json.loads(raw) if raw else {}
    cfg = load_config()
    if body:
        cur = dict(cfg.get("llm") or {})
        cur.update({k: v for k, v in body.items() if k in llm_bridge.llm_settings(cfg)})
        cfg["llm"] = cur
    return await llm_bridge.test_connection(cfg)


@app.get("/api/llm/models")
async def llm_list_models():
    """列出当前配置下可用模型。"""
    if not llm_bridge:
        raise HTTPException(500, "llm_bridge 未加载")
    cfg = load_config()
    if not llm_bridge.is_configured(cfg):
        raise HTTPException(400, "LLM 未配置")
    try:
        return await llm_bridge.list_models(cfg)
    except Exception as e:
        raise HTTPException(502, f"{e}")


@app.post("/api/llm/check")
async def llm_check(req: Request):
    """对文本做 AI 检测,返回 LLM JSON 结果(含 tts_text/summary 等)。"""
    if not llm_bridge:
        raise HTTPException(500, "llm_bridge 未加载")
    cfg = load_config()
    if not llm_bridge.is_configured(cfg):
        raise HTTPException(400, "LLM 未配置,请先到设置中配置大模型")
    body = await req.json()
    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "text 不能为空")
    try:
        result = await llm_bridge.check_text(cfg, text)
        return {"ok": True, "result": result,
                "model": llm_bridge.resolve_default_model(cfg)}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


# ----------------------------- 静态前端 -----------------------------------
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
else:
    @app.get("/")
    def root():
        return JSONResponse({"msg": "static dir missing, put index.html under ./static"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
