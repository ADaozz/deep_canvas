import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.middleware import MiddlewareDefinition
from app.schemas.middleware import MiddlewareCreate, MiddlewareUpdate


class MiddlewareService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_middlewares(self) -> list[MiddlewareDefinition]:
        result = await self.session.execute(
            select(MiddlewareDefinition).order_by(MiddlewareDefinition.name)
        )
        return list(result.scalars().all())

    async def get_middleware(
        self,
        middleware_id: uuid.UUID,
    ) -> MiddlewareDefinition | None:
        result = await self.session.execute(
            select(MiddlewareDefinition).where(MiddlewareDefinition.id == middleware_id)
        )
        return result.scalar_one_or_none()

    async def create_middleware(
        self,
        payload: MiddlewareCreate,
    ) -> MiddlewareDefinition:
        entity = MiddlewareDefinition(**payload.model_dump())
        self.session.add(entity)
        await self.session.commit()
        return await self.get_middleware(entity.id)

    async def update_middleware(
        self,
        entity: MiddlewareDefinition,
        payload: MiddlewareUpdate,
    ) -> MiddlewareDefinition:
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(entity, key, value)
        await self.session.commit()
        return await self.get_middleware(entity.id)

    async def delete_middleware(self, entity: MiddlewareDefinition) -> None:
        await self.session.delete(entity)
        await self.session.commit()
