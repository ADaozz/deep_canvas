from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings

STATIC_DIR = Path(__file__).parent / "static"
FRONTEND_OUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "out"
FRONTEND_NEXT_DIR = FRONTEND_OUT_DIR / "_next"
DOWNLOADS_DIR = Path(__file__).resolve().parents[2] / "downloads"
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="DeepCanvas Backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/downloads", StaticFiles(directory=DOWNLOADS_DIR), name="downloads")
if FRONTEND_NEXT_DIR.exists():
    app.mount("/_next", StaticFiles(directory=FRONTEND_NEXT_DIR), name="frontend-next")


@app.get("/", tags=["root"])
async def root() -> FileResponse:
    frontend_index = FRONTEND_OUT_DIR / "index.html"
    if frontend_index.exists():
        return FileResponse(frontend_index)
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/healthz", tags=["health"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
