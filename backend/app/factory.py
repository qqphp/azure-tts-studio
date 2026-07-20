from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pathlib import Path
import os

from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import router
from app.core.config import FRONTEND_DIST_DIR, HISTORY_DIR, STATIC_DIR, migrate_legacy_secrets


class SpaStaticFiles(StaticFiles):
    """Serve a Vite SPA while preserving normal 404s for missing API paths."""

    async def get_response(self, path: str, scope):
        relative_path = path.lstrip("/")
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not relative_path.startswith("api/") and "." not in Path(relative_path).name:
                return await super().get_response("index.html", scope)
            raise


def create_app() -> FastAPI:
    """Create the HTTP application; keeps wiring out of business modules."""
    HISTORY_DIR.mkdir(exist_ok=True)
    migrate_legacy_secrets()
    application = FastAPI(title="Azure TTS Studio", version="2.0.0")
    application.include_router(router)
    web_dir = FRONTEND_DIST_DIR if FRONTEND_DIST_DIR.exists() else STATIC_DIR
    if web_dir.exists():
        # The legacy UI is an opt-in emergency rollback, not a normal entry.
        if web_dir == FRONTEND_DIST_DIR and STATIC_DIR.exists() and os.getenv("TTS_ENABLE_LEGACY_UI") == "1":
            application.mount("/legacy", StaticFiles(directory=str(STATIC_DIR), html=True), name="legacy-static")
        application.mount("/", SpaStaticFiles(directory=str(web_dir), html=True), name="static")
    else:
        @application.get("/")
        def root():
            return JSONResponse({"msg": "static dir missing, put index.html under ./static"})
    return application
