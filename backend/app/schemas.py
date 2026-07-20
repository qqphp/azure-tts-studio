"""Typed HTTP contracts shared by API routes and future clients."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SettingsPayload(BaseModel):
    endpoint: str | None = None
    apiKey: str | None = None
    defaultVoice: str | None = None
    defaultStyle: str | None = None
    defaultRate: str | None = None
    defaultPitch: str | None = None
    defaultVolume: str | None = None
    outputFormat: str | None = None
    llm: dict[str, Any] | None = None


class SpeakPayload(BaseModel):
    text: str = Field(min_length=1)
    voice: str | None = None
    rate: str | None = None
    pitch: str | None = None
    volume: str | None = None
    style: str | None = None
    styleDegree: str | None = None
    role: str | None = None


class SsmlPayload(BaseModel):
    ssml: str = Field(min_length=1)


class HistoryBatchDeletePayload(BaseModel):
    ids: list[str] = Field(default_factory=list)
