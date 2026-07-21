"""Compatibility API assembly point.

All public paths remain under /api while domain endpoints now live in separate
modules. Existing static clients therefore keep working during the migration.
"""
from fastapi import APIRouter, HTTPException

from app.modules.ai_review.router import router as ai_review_router
from app.modules.background_music.router import router as background_music_router
from app.modules.editor_roles.router import router as editor_roles_router
from app.modules.history.router import router as history_router
from app.modules.settings.router import router as settings_router
from app.modules.sound_effects.router import router as sound_effects_router
from app.modules.synthesis.router import router as synthesis_router
from app.modules.system.router import router as system_router
from app.modules.voices.router import router as voices_router

router = APIRouter(prefix="/api")
router.include_router(system_router)
router.include_router(settings_router)
router.include_router(voices_router)
router.include_router(editor_roles_router)
router.include_router(sound_effects_router)
router.include_router(background_music_router)
router.include_router(synthesis_router)
router.include_router(history_router)
router.include_router(ai_review_router)


@router.api_route("/{unmatched:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"], include_in_schema=False)
def unknown_api_route(unmatched: str):
    """Prevent the SPA static fallback from turning unknown API paths into HTML."""
    raise HTTPException(404, f"API 路径不存在: /api/{unmatched}")
