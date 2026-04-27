from fastapi import APIRouter

from app.api.routes import (
    middlewares,
    persistence_profiles,
    runs,
    subagents,
    supervisors,
    tools,
    ui_state,
)


api_router = APIRouter()
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(middlewares.router, prefix="/middlewares", tags=["middlewares"])
api_router.include_router(
    persistence_profiles.router,
    prefix="/persistence-profiles",
    tags=["persistence-profiles"],
)
api_router.include_router(subagents.router, prefix="/subagents", tags=["subagents"])
api_router.include_router(
    supervisors.router,
    prefix="/supervisors",
    tags=["supervisors"],
)
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(ui_state.router, prefix="/ui-state", tags=["ui-state"])
