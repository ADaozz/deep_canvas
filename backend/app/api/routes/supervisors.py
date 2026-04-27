import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_run_service, get_supervisor_service
from app.schemas.run import RunCreate, RunRead
from app.schemas.supervisor import (
    GeneratedConfig,
    SupervisorAutoGenerateRequest,
    SupervisorCreate,
    SupervisorRead,
    SupervisorUpdate,
    SupervisorValidationResult,
)
from app.services.run_service import RunService
from app.services.supervisor_service import SupervisorService


router = APIRouter()


def serialize_supervisor(entity) -> SupervisorRead:
    return SupervisorRead(
        id=entity.id,
        name=entity.name,
        runtime=entity.runtime,
        subagent_ids=[subagent.id for subagent in entity.subagents],
        global_tool_ids=entity.global_tool_ids,
        persistence_profile_id=entity.persistence_profile_id,
        backend=entity.backend,
        memory=entity.memory,
        skills=entity.skills,
        middleware_ids=entity.middleware_ids,
        interrupt_on=entity.interrupt_on,
        enabled=entity.enabled,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


def serialize_run(entity) -> RunRead:
    return RunRead.model_validate(entity)


@router.get("", response_model=list[SupervisorRead])
async def list_supervisors(
    service: SupervisorService = Depends(get_supervisor_service),
) -> list[SupervisorRead]:
    supervisors = await service.list_supervisors()
    return [serialize_supervisor(supervisor) for supervisor in supervisors]


@router.post("/auto-generate", response_model=SupervisorRead, status_code=status.HTTP_201_CREATED)
async def auto_generate_supervisor(
    payload: SupervisorAutoGenerateRequest,
    service: SupervisorService = Depends(get_supervisor_service),
) -> SupervisorRead:
    try:
        supervisor = await service.auto_generate_supervisor(payload.query)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return serialize_supervisor(supervisor)


@router.get("/{supervisor_id}", response_model=SupervisorRead)
async def get_supervisor(
    supervisor_id: uuid.UUID,
    service: SupervisorService = Depends(get_supervisor_service),
) -> SupervisorRead:
    supervisor = await service.get_supervisor(supervisor_id)
    if supervisor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supervisor not found",
        )
    return serialize_supervisor(supervisor)


@router.post("", response_model=SupervisorRead, status_code=status.HTTP_201_CREATED)
async def create_supervisor(
    payload: SupervisorCreate,
    service: SupervisorService = Depends(get_supervisor_service),
) -> SupervisorRead:
    try:
        supervisor = await service.create_supervisor(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return serialize_supervisor(supervisor)


@router.patch("/{supervisor_id}", response_model=SupervisorRead)
async def update_supervisor(
    supervisor_id: uuid.UUID,
    payload: SupervisorUpdate,
    service: SupervisorService = Depends(get_supervisor_service),
) -> SupervisorRead:
    supervisor = await service.get_supervisor(supervisor_id)
    if supervisor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supervisor not found",
        )
    try:
        updated = await service.update_supervisor(supervisor, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return serialize_supervisor(updated)


@router.post("/{supervisor_id}/validate", response_model=SupervisorValidationResult)
async def validate_supervisor(
    supervisor_id: uuid.UUID,
    service: SupervisorService = Depends(get_supervisor_service),
) -> SupervisorValidationResult:
    supervisor = await service.get_supervisor(supervisor_id)
    if supervisor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supervisor not found",
        )
    return await service.validate_supervisor(supervisor)


@router.post("/{supervisor_id}/generate", response_model=GeneratedConfig)
async def generate_supervisor(
    supervisor_id: uuid.UUID,
    service: SupervisorService = Depends(get_supervisor_service),
) -> GeneratedConfig:
    supervisor = await service.get_supervisor(supervisor_id)
    if supervisor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supervisor not found",
        )
    try:
        return await service.generate_supervisor(supervisor)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{supervisor_id}/run", response_model=RunRead, status_code=status.HTTP_201_CREATED)
async def start_run(
    supervisor_id: uuid.UUID,
    payload: RunCreate,
    supervisor_service: SupervisorService = Depends(get_supervisor_service),
    run_service: RunService = Depends(get_run_service),
) -> RunRead:
    supervisor = await supervisor_service.get_supervisor(supervisor_id)
    if supervisor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supervisor not found",
        )
    try:
        generated = await supervisor_service.generate_supervisor(supervisor)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    run = await run_service.create_run(
        supervisor,
        input_text=payload.input_text,
        generated_config=generated.config,
    )
    return serialize_run(run)


@router.delete("/{supervisor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supervisor(
    supervisor_id: uuid.UUID,
    service: SupervisorService = Depends(get_supervisor_service),
) -> None:
    supervisor = await service.get_supervisor(supervisor_id)
    if supervisor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supervisor not found",
        )
    await service.delete_supervisor(supervisor)
