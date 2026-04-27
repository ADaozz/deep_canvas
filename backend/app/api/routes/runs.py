import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_run_service, get_supervisor_service
from app.schemas.run import RunEventRead, RunRead, RunResume
from app.services.run_service import RunService
from app.services.supervisor_service import SupervisorService


router = APIRouter()


@router.get("/{run_id}", response_model=RunRead)
async def get_run(
    run_id: uuid.UUID,
    service: RunService = Depends(get_run_service),
) -> RunRead:
    run = await service.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return RunRead.model_validate(run)


@router.get("/{run_id}/events", response_model=list[RunEventRead])
async def list_run_events(
    run_id: uuid.UUID,
    service: RunService = Depends(get_run_service),
) -> list[RunEventRead]:
    run = await service.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    events = await service.list_run_events(run_id)
    return [RunEventRead.model_validate(event) for event in events]


@router.post("/{run_id}/resume", response_model=RunRead)
async def resume_run(
    run_id: uuid.UUID,
    payload: RunResume,
    run_service: RunService = Depends(get_run_service),
    supervisor_service: SupervisorService = Depends(get_supervisor_service),
) -> RunRead:
    run = await run_service.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    supervisor = await supervisor_service.get_supervisor(run.supervisor_id)
    if supervisor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supervisor not found")
    try:
        updated = await run_service.resume_run(
            run,
            supervisor,
            decisions=payload.decisions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RunRead.model_validate(updated)
