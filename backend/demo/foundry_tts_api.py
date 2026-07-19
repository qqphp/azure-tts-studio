#!/usr/bin/env python3
"""Azure AI Foundry 资源中 Azure Speech Text to Speech 的调用示例。

只读取项目根目录 config.json 中的 endpoint 和 apiKey，不在代码中保存密钥。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

import requests


ROOT_DIR = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT_DIR / "config.json"
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"
DEFAULT_OUTPUT_FORMAT = "audio-24khz-160kbitrate-mono-mp3"


def load_config() -> dict:
    """从项目配置读取 Foundry Speech 资源地址和密钥。"""
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"找不到配置文件: {CONFIG_PATH}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"配置文件不是合法 JSON: {CONFIG_PATH}") from exc

    if not config.get("endpoint") or not config.get("apiKey"):
        raise RuntimeError("config.json 中必须配置 endpoint 和 apiKey。")
    return config


def build_ssml(text: str, voice: str) -> str:
    """构造 Azure Speech REST API 所需的 SSML，并转义用户文本。"""
    return (
        '<speak version="1.0" xml:lang="zh-CN" '
        'xmlns="http://www.w3.org/2001/10/synthesis">'
        f'<voice name="{escape(voice)}">{escape(text)}</voice>'
        "</speak>"
    )


def tts_url(endpoint: str) -> str:
    """兼容 Foundry/AI Services 资源端点与区域专用 TTS 域名。"""
    base = endpoint.rstrip("/")
    if ".tts.speech." not in base.lower() and not base.lower().endswith("/tts"):
        base += "/tts"
    return f"{base}/cognitiveservices/v1"


def synthesize(
    endpoint: str,
    api_key: str,
    text: str,
    voice: str,
    output_format: str,
    output_path: Path,
) -> None:
    """请求 Azure Speech Text to Speech 并将返回音频写入文件。"""
    url = tts_url(endpoint)
    headers = {
        "Ocp-Apim-Subscription-Key": api_key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": output_format,
        "User-Agent": "azure-tts-foundry-demo",
    }

    try:
        response = requests.post(
            url,
            headers=headers,
            data=build_ssml(text, voice).encode("utf-8"),
            timeout=60,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        detail = exc.response.text if getattr(exc, "response", None) is not None else ""
        raise RuntimeError(f"Azure Speech TTS 请求失败: {exc}\n{detail}") from exc

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(response.content)
    print(f"音频已写入: {output_path.resolve()} ({len(response.content)} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser(description="调用 Foundry Azure Speech Text to Speech")
    parser.add_argument("--text", default="你好，这是 Azure AI Foundry 语音合成示例。")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="Azure Speech 音色 ShortName")
    parser.add_argument("--format", default=DEFAULT_OUTPUT_FORMAT, help="Azure Speech 输出格式")
    parser.add_argument("--output", type=Path, default=Path("foundry_tts.mp3"))
    args = parser.parse_args()

    try:
        config = load_config()
        synthesize(
            endpoint=config["endpoint"],
            api_key=config["apiKey"],
            text=args.text,
            voice=args.voice,
            output_format=args.format,
            output_path=args.output,
        )
        return 0
    except RuntimeError as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
