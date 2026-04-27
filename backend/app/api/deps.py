from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.services.middleware_service import MiddlewareService
from app.services.persistence_service import PersistenceService
from app.services.run_service import RunService
from app.services.subagent_service import SubagentService
from app.services.supervisor_service import SupervisorService
from app.services.tool_service import ToolService
from app.services.ui_state_service import UIStateService


def get_tool_service(session: AsyncSession = Depends(get_session)) -> ToolService:
    return ToolService(session)


def get_subagent_service(
    session: AsyncSession = Depends(get_session),
) -> SubagentService:
    return SubagentService(session)


def get_middleware_service(
    session: AsyncSession = Depends(get_session),
) -> MiddlewareService:
    return MiddlewareService(session)


def get_persistence_service(
    session: AsyncSession = Depends(get_session),
) -> PersistenceService:
    return PersistenceService(session)


def get_supervisor_service(
    session: AsyncSession = Depends(get_session),
) -> SupervisorService:
    return SupervisorService(session)


def get_ui_state_service(
    session: AsyncSession = Depends(get_session),
) -> UIStateService:
    return UIStateService(session)


def get_run_service(session: AsyncSession = Depends(get_session)) -> RunService:
    return RunService(session)
