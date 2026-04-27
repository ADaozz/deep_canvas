import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.subagent import SubagentTemplate
from app.models.tool import ToolDefinition
from app.schemas.subagent import SubagentCreate, SubagentUpdate


class SubagentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_subagents(self) -> list[SubagentTemplate]:
        result = await self.session.execute(
            select(SubagentTemplate)
            .options(selectinload(SubagentTemplate.tools))
            .order_by(SubagentTemplate.name)
        )
        return list(result.scalars().all())

    async def get_subagent(self, subagent_id: uuid.UUID) -> SubagentTemplate | None:
        result = await self.session.execute(
            select(SubagentTemplate)
            .options(selectinload(SubagentTemplate.tools))
            .where(SubagentTemplate.id == subagent_id)
        )
        return result.scalar_one_or_none()

    async def create_subagent(self, payload: SubagentCreate) -> SubagentTemplate:
        tools = await self._resolve_tools(payload.tool_ids)
        subagent = SubagentTemplate(
            name=payload.name,
            description=payload.description,
            runtime=payload.runtime.model_dump(),
            skill_paths=payload.skill_paths,
            middleware_ids=[str(item) for item in payload.middleware_ids],
            interrupt_on=payload.interrupt_on,
            response_format=payload.response_format,
            enabled=payload.enabled,
            tools=tools,
        )
        self.session.add(subagent)
        await self.session.commit()
        return await self.get_subagent(subagent.id)

    async def update_subagent(
        self,
        subagent: SubagentTemplate,
        payload: SubagentUpdate,
    ) -> SubagentTemplate:
        data = payload.model_dump(exclude_unset=True)
        if "tool_ids" in data:
            subagent.tools = await self._resolve_tools(data.pop("tool_ids"))
        if "runtime" in data:
            subagent.runtime = data.pop("runtime")
            if hasattr(subagent.runtime, "model_dump"):
                subagent.runtime = subagent.runtime.model_dump()
        if "middleware_ids" in data and data["middleware_ids"] is not None:
            data["middleware_ids"] = [str(item) for item in data["middleware_ids"]]
        for key, value in data.items():
            setattr(subagent, key, value)
        await self.session.commit()
        return await self.get_subagent(subagent.id)

    async def delete_subagent(self, subagent: SubagentTemplate) -> None:
        await self.session.delete(subagent)
        await self.session.commit()

    async def _resolve_tools(
        self,
        tool_ids: list[uuid.UUID],
    ) -> list[ToolDefinition]:
        if not tool_ids:
            return []
        result = await self.session.execute(
            select(ToolDefinition).where(ToolDefinition.id.in_(tool_ids))
        )
        tools = list(result.scalars().all())
        found_ids = {tool.id for tool in tools}
        missing = [tool_id for tool_id in tool_ids if tool_id not in found_ids]
        if missing:
            raise ValueError(f"tool ids not found: {missing}")
        tool_by_id = {tool.id: tool for tool in tools}
        return [tool_by_id[tool_id] for tool_id in tool_ids]
