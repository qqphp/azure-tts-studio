"""大模型 (LLM) 桥接:统一走 OpenAI 兼容协议 (/v1/chat/completions + Bearer key)。
覆盖:智谱 GLM、DeepSeek、Kimi、通义千问、MiniMax、豆包 Doubao,以及任何 OpenAI 兼容服务。
本桥接用于"文本检测":输入用户写的文本,返回严格 JSON,含 tts_text/summary 等字段。
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import httpx

PROMPT_PATH = Path(__file__).resolve().parent / "prompt" / "text _detection.txt"


def load_prompt() -> str:
    """加载检测 prompt。文件不存在时回退到一段最简内置 prompt,保证可用。"""
    if PROMPT_PATH.exists():
        return PROMPT_PATH.read_text("utf-8")
    return (
        "你是 TTS 文本质量检测专家。请检查用户输入文本的错别字、标点、语义、中英文混合,并做 TTS 朗读优化。"
        "严格返回 JSON,字段含 has_error、score、issues、corrected_text、tts_text、summary。禁止 markdown。"
    )


# 厂商预设:base URL 已经是完整 OpenAI 兼容路径,后端会在此基础上拼 /chat/completions
PROVIDERS = {
    "zhipu":   {"label": "智谱 GLM",    "base": "https://open.bigmodel.cn/api/paas/v4",         "default_model": "glm-4-flash"},
    "deepseek":{"label": "DeepSeek",    "base": "https://api.deepseek.com/v1",                 "default_model": "deepseek-chat"},
    "kimi":    {"label": "Kimi (月之暗面)", "base": "https://api.moonshot.cn/v1",                "default_model": "moonshot-v1-8k"},
    "qwen":    {"label": "通义千问",     "base": "https://dashscope.aliyuncs.com/compatible-mode/v1", "default_model": "qwen-plus"},
    "minimax": {"label": "MiniMax",     "base": "https://api.minimax.chat/v1",                 "default_model": "abab6.5s-chat"},
    "doubao":  {"label": "豆包 Doubao", "base": "https://ark.cn-beijing.volces.com/api/v3",     "default_model": "doubao-1-5-pro-32k"},
    "custom":  {"label": "自定义",        "base": "",                                            "default_model": ""},
}


def llm_settings(cfg: dict[str, Any]) -> dict[str, Any]:
    """从 main config 提取 llm 子配置,补全默认字段。"""
    llm = cfg.get("llm") or {}
    return {
        "provider": llm.get("provider", ""),
        "base": llm.get("base", ""),
        "apiKey": llm.get("apiKey", ""),
        "defaultModel": llm.get("defaultModel", ""),
        "timeout": llm.get("timeout", 60),
    }


def resolve_base(cfg: dict[str, Any]) -> str:
    """endpoint 优先用用户填的 base;为空时从 provider 预设取。"""
    llm = llm_settings(cfg)
    base = (llm["base"] or "").strip().rstrip("/")
    if base:
        return base
    p = llm.get("provider")
    if p and p in PROVIDERS:
        return PROVIDERS[p]["base"]
    return ""


def resolve_default_model(cfg: dict[str, Any]) -> str:
    llm = llm_settings(cfg)
    m = (llm.get("defaultModel") or "").strip()
    if m:
        return m
    p = llm.get("provider")
    if p and p in PROVIDERS:
        return PROVIDERS[p]["default_model"]
    return ""


def is_configured(cfg: dict[str, Any]) -> bool:
    """LLM 是否已配置到可用状态(provider/base + key 任一组合足矣)。"""
    llm = llm_settings(cfg)
    base = resolve_base(cfg)
    return bool(base and llm.get("apiKey"))


def _headers(llm: dict[str, Any]) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {llm.get('apiKey', '').strip()}",
        "Content-Type": "application/json",
        "User-Agent": "azure-tts-bridge/1.0",
    }


async def list_models(cfg: dict[str, Any]) -> list[dict[str, Any]]:
    """调 GET {base}/models,返回精简模型列表。失败抛异常。"""
    base = resolve_base(cfg)
    if not base:
        raise ValueError("未配置 LLM base URL")
    llm = llm_settings(cfg)
    url = base + "/models"
    async with httpx.AsyncClient(timeout=20.0) as cli:
        r = await cli.get(url, headers=_headers(llm))
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
    data = r.json()
    raw = data.get("data") or data.get("models") or []
    out = []
    for m in raw:
        if isinstance(m, dict):
            mid = m.get("id") or m.get("name") or ""
            if mid:
                out.append({"id": mid, "object": m.get("object", "model"),
                            "owned_by": m.get("owned_by", "") or m.get("owner", "")})
        elif isinstance(m, str) and m:
            out.append({"id": m, "object": "model", "owned_by": ""})
    # 去重 + 排序
    seen = set(); result = []
    for m in out:
        if m["id"] not in seen:
            seen.add(m["id"]); result.append(m)
    result.sort(key=lambda x: x["id"])
    return result


async def test_connection(cfg: dict[str, Any]) -> dict[str, Any]:
    """尝试列出模型,验证密钥可用。"""
    base = resolve_base(cfg)
    llm = llm_settings(cfg)
    if not base:
        return {"ok": False, "error": "未配置请求地址"}
    if not llm.get("apiKey"):
        return {"ok": False, "error": "未配置密钥"}
    try:
        models = await list_models(cfg)
        return {"ok": True, "count": len(models),
                "sample": models[0]["id"] if models else None}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


async def check_text(cfg: dict[str, Any], text: str) -> dict[str, Any]:
    """对用户文本做检测,返回原始 LLM JSON 结果。失败抛异常。"""
    base = resolve_base(cfg)
    llm = llm_settings(cfg)
    model = resolve_default_model(cfg)
    if not base:
        raise ValueError("未配置 LLM 请求地址")
    if not llm.get("apiKey"):
        raise ValueError("未配置 LLM 密钥")
    if not model:
        raise ValueError("未配置默认模型")
    if not text.strip():
        raise ValueError("text 不能为空")

    url = base + "/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": load_prompt()},
            {"role": "user",   "content": text},
        ],
        "temperature": 0.3,
        # OpenAI 兼容服务多数支持 json_object(DeepSeek/Kimi/通义/智谱均支持),
        # 不支持的会忽略或报错,我们在客户端再容错。
        "response_format": {"type": "json_object"},
        "stream": False,
    }
    timeout = float(llm.get("timeout") or 60)
    async with httpx.AsyncClient(timeout=timeout) as cli:
        r = await cli.post(url, headers=_headers(llm), json=payload)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")

    data = r.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("LLM 返回为空")
    content = choices[0].get("message", {}).get("content", "")
    parsed = parse_llm_json(content)

    # 兜底:缺字段也要返回可结构化访问的空值
    if not isinstance(parsed, dict):
        raise RuntimeError(f"LLM 返回非 JSON 对象: {content[:200]}")
    parsed.setdefault("tts_text", "")
    parsed.setdefault("summary", "")
    parsed.setdefault("score", None)
    parsed.setdefault("issues", [])
    return parsed


def parse_llm_json(content: str) -> Any:
    """LLM 输出容错解析:先试整段 JSON,失败时抓第一个 {...} 块。"""
    if not content:
        return None
    s = content.strip()
    # 去掉常见的 markdown 包裹
    if s.startswith("```"):
        s = re.sub(r"^\s*```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```\s*$", "", s).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    # 找首个 { ... } 片段
    m = re.search(r"\{.*\}", s, flags=re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return None