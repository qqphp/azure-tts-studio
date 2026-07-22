from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pathlib import Path

from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import router
from app.core.config import FRONTEND_DIST_DIR, HISTORY_DIR, VOICE_PREVIEW_DIR, migrate_legacy_secrets


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
    VOICE_PREVIEW_DIR.mkdir(exist_ok=True)
    migrate_legacy_secrets()
    application = FastAPI(title="Azure TTS Studio", version="2.0.0")
    application.include_router(router)

    frontend_entry = FRONTEND_DIST_DIR / "index.html"
    if frontend_entry.is_file():
        application.mount("/", SpaStaticFiles(directory=str(FRONTEND_DIST_DIR), html=True), name="frontend")
    else:
        @application.get("/")
        def root():
            return JSONResponse(
                {"msg": "frontend build missing; run `npm install && npm run build` under ./frontend"},
                status_code=503,
            )
    return application
