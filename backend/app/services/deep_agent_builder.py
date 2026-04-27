import importlib
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm import build_chat_model
from app.models.middleware import MiddlewareDefinition
from app.models.persistence import PersistenceProfile
from app.models.supervisor import SupervisorConfig
from app.models.tool import ToolDefinition


class DeepAgentBuilder:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def build(
        self,
        supervisor: SupervisorConfig,
        *,
        checkpointer_override: Any | None = None,
    ) -> tuple[Any, dict[str, Any]]:
        create_deep_agent = self._load_create_deep_agent()
        runtime = supervisor.runtime or {}
        persistence_kwargs = self._build_persistence_kwargs(supervisor.persistence_profile)
        backend = self._build_supervisor_backend(supervisor.backend)
        global_tool_defs = await self._resolve_tool_definitions(supervisor.global_tool_ids)
        global_tools = [
            self._load_tool(tool.python_import_path)
            for tool in global_tool_defs
            if tool.enabled
        ]
        global_interrupts = self._build_tool_interrupt_map(global_tool_defs)
        supervisor_middlewares = await self._resolve_middlewares(supervisor.middleware_ids)
        compiled_subagents = []
        subagent_interrupt_count = 0
        for subagent in supervisor.subagents:
            if not subagent.enabled:
                continue

            subagent_runtime = subagent.runtime or {}
            subagent_middlewares = await self._resolve_middlewares(subagent.middleware_ids)
            compiled_tools = [self._load_tool(tool.python_import_path) for tool in subagent.tools if tool.enabled]
            subagent_interrupts = self._merge_interrupt_map(
                subagent.interrupt_on,
                self._build_tool_interrupt_map(subagent.tools),
            )
            subagent_interrupt_count += len(subagent_interrupts)
            compiled_subagent = {
                "name": subagent.name,
                "description": subagent.description,
                "system_prompt": subagent_runtime.get("system_prompt", ""),
                "model": build_chat_model(
                    model_name=subagent_runtime.get("model"),
                    temperature=subagent_runtime.get("temperature", 0.0),
                ),
                "tools": compiled_tools,
            }
            if subagent.skill_paths:
                compiled_subagent["skills"] = subagent.skill_paths
            if subagent_middlewares:
                compiled_subagent["middleware"] = subagent_middlewares
            if subagent_interrupts:
                compiled_subagent["interrupt_on"] = subagent_interrupts
            if subagent.response_format is not None:
                compiled_subagent["response_format"] = subagent.response_format
            compiled_subagents.append(compiled_subagent)

        supervisor_interrupts = self._merge_interrupt_map(supervisor.interrupt_on, global_interrupts)
        agent_kwargs: dict[str, Any] = {
            "model": build_chat_model(
                model_name=runtime.get("model"),
                temperature=runtime.get("temperature", 0.0),
            ),
            "system_prompt": runtime.get("system_prompt", ""),
            "tools": global_tools,
            "subagents": compiled_subagents,
        }
        if supervisor.skills:
            agent_kwargs["skills"] = supervisor.skills
        if supervisor.memory:
            agent_kwargs["memory"] = supervisor.memory
        if supervisor_middlewares:
            agent_kwargs["middleware"] = supervisor_middlewares
        if supervisor_interrupts:
            agent_kwargs["interrupt_on"] = supervisor_interrupts
        agent_kwargs.update(persistence_kwargs)
        if backend is not None:
            agent_kwargs["backend"] = backend
        if checkpointer_override is not None:
            agent_kwargs["checkpointer"] = checkpointer_override

        agent = create_deep_agent(**agent_kwargs)
        metadata = {
            "supervisor_name": supervisor.name,
            "global_tool_names": [tool.name for tool in global_tools],
            "subagent_names": [subagent["name"] for subagent in compiled_subagents],
            "subagent_count": len(compiled_subagents),
            "middleware_count": len(supervisor_middlewares),
            "interrupt_tool_count": len(supervisor_interrupts) + subagent_interrupt_count,
            "persistence_profile_name": supervisor.persistence_profile.name
            if supervisor.persistence_profile
            else None,
        }
        return agent, metadata

    def _build_supervisor_backend(self, backend_config: dict | None) -> Any:
        if not backend_config:
            return None
        component_type = str(backend_config.get("type") or "").strip()
        import_path = backend_config.get("import_path")
        config = backend_config.get("config") or {}
        if component_type in ("", "none"):
            return None
        return self._build_component(
            component_type=component_type,
            import_path=import_path,
            config=config,
        )

    async def _resolve_tool_definitions(self, tool_ids: list[str]) -> list[ToolDefinition]:
        if not tool_ids:
            return []

        normalized_ids = [uuid.UUID(str(tool_id)) for tool_id in tool_ids]
        result = await self.session.execute(
            select(ToolDefinition).where(ToolDefinition.id.in_(normalized_ids))
        )
        tools = list(result.scalars().all())
        tool_by_id = {tool.id: tool for tool in tools}
        missing = [tool_id for tool_id in normalized_ids if tool_id not in tool_by_id]
        if missing:
            raise ValueError(f"tool ids not found: {missing}")
        return [tool_by_id[tool_id] for tool_id in normalized_ids]

    async def _resolve_middlewares(self, middleware_ids: list[str]) -> list[Any]:
        if not middleware_ids:
            return []
        normalized_ids = [uuid.UUID(str(item)) for item in middleware_ids]
        result = await self.session.execute(
            select(MiddlewareDefinition).where(MiddlewareDefinition.id.in_(normalized_ids))
        )
        middlewares = list(result.scalars().all())
        middleware_by_id = {item.id: item for item in middlewares}
        missing = [item for item in normalized_ids if item not in middleware_by_id]
        if missing:
            raise ValueError(f"middleware ids not found: {missing}")
        resolved = []
        for middleware_id in normalized_ids:
            definition = middleware_by_id[middleware_id]
            if not definition.enabled:
                continue
            if self._is_template_only_import_path(definition.python_import_path):
                continue
            resolved.append(
                self._instantiate_callable(
                    definition.python_import_path,
                    definition.config or {},
                )
            )
        return resolved

    def _build_persistence_kwargs(
        self,
        profile: PersistenceProfile | None,
    ) -> dict[str, Any]:
        if profile is None or not profile.enabled:
            return {}
        kwargs: dict[str, Any] = {}
        backend = self._build_component(
            component_type=profile.backend_type,
            import_path=profile.backend_import_path,
            config=profile.backend_config or {},
        )
        checkpointer = self._build_component(
            component_type=profile.checkpointer_type,
            import_path=profile.checkpointer_import_path,
            config=profile.checkpointer_config or {},
        )
        store = self._build_component(
            component_type=profile.store_type,
            import_path=profile.store_import_path,
            config=profile.store_config or {},
        )
        if backend is not None:
            kwargs["backend"] = backend
        if checkpointer is not None:
            kwargs["checkpointer"] = checkpointer
        if store is not None:
            kwargs["store"] = store
        return kwargs

    @staticmethod
    def _build_tool_interrupt_map(tools: list[ToolDefinition]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for tool in tools:
            if tool.enabled and tool.requires_human_approval:
                result[tool.name] = {
                    "allowed_decisions": ["approve", "edit", "reject"]
                }
        return result

    @staticmethod
    def _merge_interrupt_map(
        configured: dict[str, Any] | None,
        auto_generated: dict[str, Any],
    ) -> dict[str, Any]:
        merged = dict(auto_generated)
        if configured:
            merged.update(configured)
        return merged

    @staticmethod
    def _load_create_deep_agent() -> Any:
        try:
            module = importlib.import_module("deepagents")
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "未安装 deepagents。请先在当前虚拟环境中安装 deepagents 依赖。"
            ) from exc

        try:
            return getattr(module, "create_deep_agent")
        except AttributeError as exc:
            raise RuntimeError("当前安装的 deepagents 包不包含 create_deep_agent。") from exc

    @staticmethod
    def _load_tool(python_import_path: str) -> Any:
        return DeepAgentBuilder._load_symbol(python_import_path)

    @staticmethod
    def _load_symbol(python_import_path: str) -> Any:
        module_path, symbol = python_import_path.rsplit(".", 1)
        module = importlib.import_module(module_path)
        try:
            return getattr(module, symbol)
        except AttributeError as exc:
            raise RuntimeError(f"无法从 {module_path} 导入工具对象 {symbol}。") from exc

    @staticmethod
    def _instantiate_callable(python_import_path: str, config: dict[str, Any]) -> Any:
        symbol = DeepAgentBuilder._load_symbol(python_import_path)
        if callable(symbol):
            return symbol(**config)
        return symbol

    @staticmethod
    def _build_component(
        *,
        component_type: str,
        import_path: str | None,
        config: dict[str, Any],
    ) -> Any:
        if component_type in ("", "none", None):
            return None
        if component_type == "memory":
            return DeepAgentBuilder._instantiate_callable(
                "langgraph.checkpoint.memory.MemorySaver",
                config,
            )
        if component_type == "filesystem":
            return DeepAgentBuilder._instantiate_callable(
                "deepagents.backends.filesystem.FilesystemBackend",
                config,
            )
        if component_type == "state":
            backend_cls = DeepAgentBuilder._load_symbol("deepagents.backends.StateBackend")
            return lambda runtime: backend_cls(runtime)
        if component_type == "in_memory_store":
            return DeepAgentBuilder._instantiate_callable(
                "langgraph.store.memory.InMemoryStore",
                config,
            )
        if component_type == "custom" and import_path and DeepAgentBuilder._is_template_only_import_path(import_path):
            return None
        if component_type == "custom" and import_path:
            return DeepAgentBuilder._instantiate_callable(import_path, config)
        return None

    @staticmethod
    def _is_template_only_import_path(import_path: str | None) -> bool:
        if not import_path:
            return False
        return import_path.startswith("app.middleware.") or import_path.startswith(
            "app.persistence."
        )
