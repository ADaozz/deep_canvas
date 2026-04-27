import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_middleware_service
from app.schemas.middleware import MiddlewareCreate, MiddlewareRead, MiddlewareUpdate
from app.services.middleware_service import MiddlewareService


router = APIRouter()


@router.get("", response_model=list[MiddlewareRead])
async def list_middlewares(
    service: MiddlewareService = Depends(get_middleware_service),
) -> list[MiddlewareRead]:
    return [MiddlewareRead.model_validate(item) for item in await service.list_middlewares()]


@router.post("", response_model=MiddlewareRead, status_code=status.HTTP_201_CREATED)
async def create_middleware(
    payload: MiddlewareCreate,
    service: MiddlewareService = Depends(get_middleware_service),
) -> MiddlewareRead:
    return MiddlewareRead.model_validate(await service.create_middleware(payload))


@router.patch("/{middleware_id}", response_model=MiddlewareRead)
async def update_middleware(
    middleware_id: uuid.UUID,
    payload: MiddlewareUpdate,
    service: MiddlewareService = Depends(get_middleware_service),
) -> MiddlewareRead:
    entity = await service.get_middleware(middleware_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Middleware not found")
    return MiddlewareRead.model_validate(await service.update_middleware(entity, payload))


@router.delete("/{middleware_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_middleware(
    middleware_id: uuid.UUID,
    service: MiddlewareService = Depends(get_middleware_service),
) -> None:
    entity = await service.get_middleware(middleware_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Middleware not found")
    await service.delete_middleware(entity)
