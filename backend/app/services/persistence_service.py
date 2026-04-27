import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.persistence import PersistenceProfile
from app.schemas.persistence import PersistenceProfileCreate, PersistenceProfileUpdate


class PersistenceService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_profiles(self) -> list[PersistenceProfile]:
        result = await self.session.execute(
            select(PersistenceProfile).order_by(PersistenceProfile.name)
        )
        return list(result.scalars().all())

    async def get_profile(self, profile_id: uuid.UUID) -> PersistenceProfile | None:
        result = await self.session.execute(
            select(PersistenceProfile).where(PersistenceProfile.id == profile_id)
        )
        return result.scalar_one_or_none()

    async def create_profile(
        self,
        payload: PersistenceProfileCreate,
    ) -> PersistenceProfile:
        entity = PersistenceProfile(**payload.model_dump())
        self.session.add(entity)
        await self.session.commit()
        return await self.get_profile(entity.id)

    async def update_profile(
        self,
        entity: PersistenceProfile,
        payload: PersistenceProfileUpdate,
    ) -> PersistenceProfile:
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(entity, key, value)
        await self.session.commit()
        return await self.get_profile(entity.id)

    async def delete_profile(self, entity: PersistenceProfile) -> None:
        await self.session.delete(entity)
        await self.session.commit()
