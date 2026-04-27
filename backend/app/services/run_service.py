import importlib
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.run import AgentRun, AgentRunEvent
from app.models.supervisor import SupervisorConfig
from app.services.deep_agent_builder import DeepAgentBuilder


@dataclass
class RunExecutionContext:
    agent: Any
    config: dict[str, Any]
    checkpointer: Any | None
    interrupt_enabled: bool


RUN_CONTEXTS: dict[str, RunExecutionContext] = {}


class RunService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_run(
        self,
        supervisor: SupervisorConfig,
        *,
        input_text: str,
        generated_config: dict,
    ) -> AgentRun:
        run = AgentRun(
            supervisor_id=supervisor.id,
            input_text=input_text,
            status="running",
        )
        run.events.append(
            AgentRunEvent(
                event_type="run_started",
                source_type="system",
                source_name="run_service",
                payload={
                    "input_text": input_text,
                    "supervisor_name": supervisor.name,
                    "generated_config": generated_config,
                },
            )
        )
        self.session.add(run)
        await self.session.flush()

        try:
            context, metadata = await self._build_execution_context(
                supervisor,
                thread_id=str(run.id),
            )
            run.events.append(
                AgentRunEvent(
                    event_type="agent_compiled",
                    source_type="system",
                    source_name=supervisor.name,
                    payload={**metadata, "thread_id": str(run.id)},
                )
            )

            result = await context.agent.ainvoke(
                {"messages": [{"role": "user", "content": input_text}]},
                config=context.config,
                version="v2",
            )
            await self._apply_result_to_run(
                run=run,
                supervisor=supervisor,
                result=result,
                resumed=False,
            )
        except Exception as exc:
            run.status = "failed"
            run.error_message = str(exc)
            run.events.append(
                AgentRunEvent(
                    event_type="run_failed",
                    source_type="system",
                    source_name=supervisor.name,
                    payload={"error": str(exc)},
                )
            )

        self.session.add(run)
        await self.session.commit()
        return await self.get_run(run.id)

    async def resume_run(
        self,
        run: AgentRun,
        supervisor: SupervisorConfig,
        *,
        decisions: list[dict],
    ) -> AgentRun:
        if run.status != "interrupted":
            raise ValueError("只有处于 interrupted 状态的运行才能恢复。")

        context = RUN_CONTEXTS.get(str(run.id))
        if context is None:
            context, _ = await self._build_execution_context(
                supervisor,
                thread_id=str(run.id),
            )
        if not context.interrupt_enabled:
            raise ValueError("当前运行没有启用人工确认中断，无法恢复。")

        try:
            command = self._build_resume_command(decisions)
            run.status = "running"
            run.error_message = None
            run.events.append(
                AgentRunEvent(
                    event_type="run_resumed",
                    source_type="system",
                    source_name=supervisor.name,
                    payload={"decisions": decisions},
                )
            )
            result = await context.agent.ainvoke(
                command,
                config=context.config,
                version="v2",
            )
            await self._apply_result_to_run(
                run=run,
                supervisor=supervisor,
                result=result,
                resumed=True,
            )
        except Exception as exc:
            run.status = "failed"
            run.error_message = str(exc)
            run.events.append(
                AgentRunEvent(
                    event_type="run_failed",
                    source_type="system",
                    source_name=supervisor.name,
                    payload={"error": str(exc)},
                )
            )

        self.session.add(run)
        await self.session.commit()
        return await self.get_run(run.id)

    async def get_run(self, run_id: uuid.UUID) -> AgentRun | None:
        result = await self.session.execute(
            select(AgentRun)
            .options(selectinload(AgentRun.events))
            .where(AgentRun.id == run_id)
        )
        return result.scalar_one_or_none()

    async def list_run_events(self, run_id: uuid.UUID) -> list[AgentRunEvent]:
        result = await self.session.execute(
            select(AgentRunEvent)
            .where(AgentRunEvent.run_id == run_id)
            .order_by(AgentRunEvent.created_at)
        )
        return list(result.scalars().all())

    async def _build_execution_context(
        self,
        supervisor: SupervisorConfig,
        *,
        thread_id: str,
    ) -> tuple[RunExecutionContext, dict[str, Any]]:
        existing = RUN_CONTEXTS.get(thread_id)
        if existing is not None:
            return existing, {
                "thread_id": thread_id,
                "interrupt_enabled": existing.interrupt_enabled,
            }

        interrupt_enabled = self._has_interrupt_behavior(supervisor)
        checkpointer = None
        if interrupt_enabled and not self._has_persistence_checkpointer(supervisor):
            checkpointer = self._build_default_memory_checkpointer()

        agent, metadata = await DeepAgentBuilder(self.session).build(
            supervisor,
            checkpointer_override=checkpointer,
        )
        context = RunExecutionContext(
            agent=agent,
            config={"configurable": {"thread_id": thread_id}},
            checkpointer=checkpointer,
            interrupt_enabled=interrupt_enabled or metadata.get("interrupt_tool_count", 0) > 0,
        )
        RUN_CONTEXTS[thread_id] = context
        return context, metadata

    async def _apply_result_to_run(
        self,
        *,
        run: AgentRun,
        supervisor: SupervisorConfig,
        result: Any,
        resumed: bool,
    ) -> None:
        interrupts = self._extract_interrupts(result)
        if interrupts:
            run.status = "interrupted"
            run.output_text = None
            run.events.append(
                AgentRunEvent(
                    event_type="run_interrupted",
                    source_type="system",
                    source_name=supervisor.name,
                    payload={
                        "interrupts": interrupts,
                        "requires_human_approval": True,
                        "resumed": resumed,
                    },
                )
            )
            return

        output_text = self._extract_output_text(result)
        run.status = "completed"
        run.output_text = output_text
        run.events.append(
            AgentRunEvent(
                event_type="run_finished",
                source_type="supervisor",
                source_name=supervisor.name,
                payload={
                    "content": output_text,
                    "result": self._serialize_for_event(result),
                    "resumed": resumed,
                },
            )
        )

    def _extract_output_text(self, result: Any) -> str:
        if isinstance(result, dict):
            messages = result.get("messages")
            if isinstance(messages, list) and messages:
                last_message = messages[-1]
                content = getattr(last_message, "content", None)
                if isinstance(content, str):
                    return content
                if content is not None:
                    return str(content)
            output = result.get("output")
            if isinstance(output, str):
                return output
            if output is not None:
                return str(output)
        return str(result)

    def _serialize_for_event(self, value: Any):
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, dict):
            return {str(key): self._serialize_for_event(item) for key, item in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [self._serialize_for_event(item) for item in value]
        if hasattr(value, "model_dump"):
            return self._serialize_for_event(value.model_dump())
        if hasattr(value, "dict"):
            return self._serialize_for_event(value.dict())
        if hasattr(value, "content") and hasattr(value, "type"):
            return {
                "type": getattr(value, "type", value.__class__.__name__),
                "content": self._serialize_for_event(getattr(value, "content", None)),
                "name": getattr(value, "name", None),
                "tool_calls": self._serialize_for_event(getattr(value, "tool_calls", None)),
            }
        return str(value)

    def _extract_interrupts(self, result: Any) -> list[dict]:
        interrupts = getattr(result, "interrupts", None)
        if not interrupts and isinstance(result, dict):
            interrupts = result.get("interrupts")
        if not interrupts:
            return []
        normalized = []
        for interrupt in interrupts:
            value = getattr(interrupt, "value", interrupt)
            normalized.append(self._serialize_for_event(value))
        return normalized

    @staticmethod
    def _build_default_memory_checkpointer() -> Any:
        memory_module = importlib.import_module("langgraph.checkpoint.memory")
        saver_cls = getattr(memory_module, "MemorySaver", None) or getattr(
            memory_module, "InMemorySaver"
        )
        return saver_cls()

    @staticmethod
    def _has_interrupt_behavior(supervisor: SupervisorConfig) -> bool:
        if supervisor.interrupt_on:
            return True
        for subagent in supervisor.subagents:
            if subagent.interrupt_on:
                return True
            for tool in subagent.tools:
                if tool.enabled and tool.requires_human_approval:
                    return True
        return False

    @staticmethod
    def _has_persistence_checkpointer(supervisor: SupervisorConfig) -> bool:
        profile = supervisor.persistence_profile
        if profile is None or not profile.enabled:
            return False
        return str(profile.checkpointer_type or "").strip() not in ("", "none")

    @staticmethod
    def _build_resume_command(decisions: list[dict]) -> Any:
        command_module = importlib.import_module("langgraph.types")
        command_cls = getattr(command_module, "Command")
        return command_cls(resume={"decisions": decisions})
