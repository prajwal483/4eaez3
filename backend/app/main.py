"""App factory: wires routes, error handling and the built frontend."""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles

from app.config import API_VERSION, STATIC_DIR
from app.errors import install_error_handlers
from app.observability import configure_logging, install_observability
from app.routes import router

# The data is a fixed January 2026 snapshot, so successful reads can be cached; the CDN keeps them for a day
# and a new deployment invalidates them.
CACHE_CONTROL = "public, max-age=300, s-maxage=86400"

configure_logging()


def create_app(static_dir: Path | None = STATIC_DIR) -> FastAPI:
    app = FastAPI(
        title="GridBrick API",
        version=API_VERSION,
        description="GB wind forecasts available at day-ahead gate closure, and how accurate they were.",
        openapi_tags=[
            {"name": "decision", "description": "What the forecast said when the buyer had to commit"},
            {"name": "accuracy", "description": "How forecast error depends on lead time"},
            {"name": "reference", "description": "Window and defaults the UI needs"},
            {"name": "system", "description": "Operational endpoints"},
        ],
    )
    install_error_handlers(app)

    @app.middleware("http")
    async def cache_headers(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        is_data_read = path.startswith("/api/") and not path.endswith("/health")
        if request.method == "GET" and response.status_code == 200 and is_data_read:
            response.headers["Cache-Control"] = CACHE_CONTROL
        return response

    install_observability(app)
    app.include_router(router, prefix="/api/v1")
    # Unversioned alias so existing links and clients keep working; hidden from the schema.
    app.include_router(router, prefix="/api", include_in_schema=False, deprecated=True)

    if static_dir is not None and static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    return app


app = create_app()
