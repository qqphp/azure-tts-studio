from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.core.config import load_config

try:
    import llm_bridge
except ImportError:
    llm_bridge = None

router = APIRouter(prefix="/llm", tags=["ai-review"])


@router.get("/providers")
def llm_providers() -> list[dict[str, Any]]:
    if not llm_bridge:
        return []
    return [{"id": key, "label": value["label"], "base": value["base"], "default_model": value["default_model"]} for key, value in llm_bridge.PROVIDERS.items()]


@router.get("/status")
def llm_status() -> dict[str, Any]:
    config = load_config()
    return {"configured": bool(llm_bridge and llm_bridge.is_configured(config)), "model": llm_bridge.resolve_default_model(config) if llm_bridge else ""}


@router.post("/test")
async def llm_test(request: Request) -> dict[str, Any]:
    if not llm_bridge:
        return {"ok": False, "error": "llm_bridge 未加载"}
    config, body = load_config(), await request.json()
    if isinstance(body, dict):
        values = dict(config.get("llm") or {})
        values.update({key: value for key, value in body.items() if key in llm_bridge.llm_settings(config)})
        config["llm"] = values
    return await llm_bridge.test_connection(config)


@router.get("/models")
async def llm_models() -> list[dict[str, Any]]:
    if not llm_bridge:
        raise HTTPException(500, "llm_bridge 未加载")
    config = load_config()
    if not llm_bridge.is_configured(config):
        raise HTTPException(400, "LLM 未配置")
    try:
        return await llm_bridge.list_models(config)
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc


@router.post("/check")
async def llm_check(request: Request) -> dict[str, Any]:
    if not llm_bridge:
        raise HTTPException(500, "llm_bridge 未加载")
    config, body = load_config(), await request.json()
    if not llm_bridge.is_configured(config):
        raise HTTPException(400, "LLM 未配置,请先到设置中配置大模型")
    text = (body.get("text") or "").strip() if isinstance(body, dict) else ""
    if not text:
        raise HTTPException(400, "text 不能为空")
    try:
        return {"ok": True, "result": await llm_bridge.check_text(config, text), "model": llm_bridge.resolve_default_model(config)}
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
