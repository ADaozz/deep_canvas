import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_persistence_service
from app.schemas.persistence import (
    PersistenceProfileCreate,
    PersistenceProfileRead,
    PersistenceProfileUpdate,
)
from app.services.persistence_service import PersistenceService


router = APIRouter()


@router.get("", response_model=list[PersistenceProfileRead])
async def list_profiles(
    service: PersistenceService = Depends(get_persistence_service),
) -> list[PersistenceProfileRead]:
    return [PersistenceProfileRead.model_validate(item) for item in await service.list_profiles()]


@router.post("", response_model=PersistenceProfileRead, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: PersistenceProfileCreate,
    service: PersistenceService = Depends(get_persistence_service),
) -> PersistenceProfileRead:
    return PersistenceProfileRead.model_validate(await service.create_profile(payload))


@router.patch("/{profile_id}", response_model=PersistenceProfileRead)
async def update_profile(
    profile_id: uuid.UUID,
    payload: PersistenceProfileUpdate,
    service: PersistenceService = Depends(get_persistence_service),
) -> PersistenceProfileRead:
    entity = await service.get_profile(profile_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persistence profile not found")
    return PersistenceProfileRead.model_validate(await service.update_profile(entity, payload))


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: uuid.UUID,
    service: PersistenceService = Depends(get_persistence_service),
) -> None:
    entity = await service.get_profile(profile_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persistence profile not found")
    await service.delete_profile(entity)
