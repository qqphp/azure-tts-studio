from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any

SSML_NS = "http://www.w3.org/2001/10/synthesis"
XML_NS = "http://www.w3.org/XML/1998/namespace"


def validate_document(ssml: str) -> dict[str, Any]:
    """Validate XML safety and the minimum SSML envelope without rewriting user input."""
    if not isinstance(ssml, str) or not ssml.strip():
        raise ValueError("SSML 不能为空")
    ssml = ssml.strip()
    if "<!DOCTYPE" in ssml.upper() or "<!ENTITY" in ssml.upper():
        raise ValueError("SSML 不允许包含 DOCTYPE 或 ENTITY 声明")
    try:
        root = ET.fromstring(ssml)
    except ET.ParseError as exc:
        line, column = getattr(exc, "position", (None, None))
        location = f"（第 {line} 行，第 {column + 1} 列）" if line is not None else ""
        raise ValueError(f"XML 格式错误{location}：{exc}") from exc
    if root.tag != f"{{{SSML_NS}}}speak":
        raise ValueError('根元素必须是带 xmlns="http://www.w3.org/2001/10/synthesis" 的 <speak>')
    if root.get("version") != "1.0": raise ValueError('<speak> 必须设置 version="1.0"')
    if not root.get(f"{{{XML_NS}}}lang"): raise ValueError('<speak> 必须设置 xml:lang，例如 xml:lang="zh-CN"')
    voices = root.findall(f"{{{SSML_NS}}}voice")
    if not voices: raise ValueError("<speak> 中至少需要一个直接子级 <voice>")
    names = [(voice.get("name") or "").strip() for voice in voices]
    if not all(names): raise ValueError("每个 <voice> 都必须设置 name 属性")
    plain_text = "".join(root.itertext()).strip()
    return {"ssml": ssml, "bytes": len(ssml.encode("utf-8")), "characters": len(ssml), "voices": names, "voiceCount": len(names), "textPreview": plain_text[:200] + ("…" if len(plain_text) > 200 else ""), "textLength": len(plain_text)}
