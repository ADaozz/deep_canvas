from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ui_state import UIComponentState
from app.schemas.ui_state import UIStateUpsert


class UIStateService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_states(
        self,
        *,
        user_id: str,
        page_key: str | None = None,
    ) -> list[UIComponentState]:
        query = select(UIComponentState).where(UIComponentState.user_id == user_id)
        if page_key:
            query = query.where(UIComponentState.page_key == page_key)
        query = query.order_by(UIComponentState.page_key, UIComponentState.component_key)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def upsert_state(self, payload: UIStateUpsert) -> UIComponentState:
        result = await self.session.execute(
            select(UIComponentState).where(
                UIComponentState.user_id == payload.user_id,
                UIComponentState.page_key == payload.page_key,
                UIComponentState.component_key == payload.component_key,
            )
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            entity = UIComponentState(
                user_id=payload.user_id,
                page_key=payload.page_key,
                component_key=payload.component_key,
                state=payload.state,
            )
            self.session.add(entity)
        else:
            entity.state = payload.state
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

