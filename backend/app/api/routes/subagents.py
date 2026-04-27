import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_subagent_service
from app.schemas.subagent import (
    SubagentCreate,
    SubagentRead,
    SubagentUpdate,
)
from app.services.subagent_service import SubagentService


router = APIRouter()


def serialize_subagent(entity) -> SubagentRead:
    return SubagentRead(
        id=entity.id,
        name=entity.name,
        description=entity.description,
        runtime=entity.runtime,
        tool_ids=[tool.id for tool in entity.tools],
        skill_paths=entity.skill_paths,
        middleware_ids=entity.middleware_ids,
        interrupt_on=entity.interrupt_on,
        response_format=entity.response_format,
        enabled=entity.enabled,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


@router.get("", response_model=list[SubagentRead])
async def list_subagents(
    service: SubagentService = Depends(get_subagent_service),
) -> list[SubagentRead]:
    subagents = await service.list_subagents()
    return [serialize_subagent(subagent) for subagent in subagents]


@router.get("/{subagent_id}", response_model=SubagentRead)
async def get_subagent(
    subagent_id: uuid.UUID,
    service: SubagentService = Depends(get_subagent_service),
) -> SubagentRead:
    subagent = await service.get_subagent(subagent_id)
    if subagent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subagent not found",
        )
    return serialize_subagent(subagent)


@router.post("", response_model=SubagentRead, status_code=status.HTTP_201_CREATED)
async def create_subagent(
    payload: SubagentCreate,
    service: SubagentService = Depends(get_subagent_service),
) -> SubagentRead:
    try:
        subagent = await service.create_subagent(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return serialize_subagent(subagent)


@router.patch("/{subagent_id}", response_model=SubagentRead)
async def update_subagent(
    subagent_id: uuid.UUID,
    payload: SubagentUpdate,
    service: SubagentService = Depends(get_subagent_service),
) -> SubagentRead:
    subagent = await service.get_subagent(subagent_id)
    if subagent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subagent not found",
        )
    try:
        updated = await service.update_subagent(subagent, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return serialize_subagent(updated)


@router.delete("/{subagent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subagent(
    subagent_id: uuid.UUID,
    service: SubagentService = Depends(get_subagent_service),
) -> None:
    subagent = await service.get_subagent(subagent_id)
    if subagent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subagent not found",
        )
    await service.delete_subagent(subagent)
