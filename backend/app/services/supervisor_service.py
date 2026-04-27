import ast
import compileall
import json
import re
import textwrap
import uuid
import zipfile
from collections import defaultdict
from pathlib import Path
from tempfile import TemporaryDirectory

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.llm import build_chat_model
from app.models.middleware import MiddlewareDefinition
from app.models.persistence import PersistenceProfile
from app.models.run import AgentRun
from app.models.subagent import SubagentTemplate
from app.models.supervisor import SupervisorConfig
from app.models.tool import ToolDefinition
from app.schemas.supervisor import (
    GeneratedConfig,
    SupervisorCreate,
    SupervisorUpdate,
    SupervisorValidationResult,
    ValidationIssue,
)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DOWNLOADS_DIR = PROJECT_ROOT / "downloads"
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)


class SupervisorService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_supervisors(self) -> list[SupervisorConfig]:
        result = await self.session.execute(
            select(SupervisorConfig)
            .options(
                selectinload(SupervisorConfig.persistence_profile),
                selectinload(SupervisorConfig.subagents).selectinload(
                    SubagentTemplate.tools
                )
            )
            .order_by(SupervisorConfig.name)
        )
        return list(result.scalars().all())

    async def get_supervisor(self, supervisor_id: uuid.UUID) -> SupervisorConfig | None:
        result = await self.session.execute(
            select(SupervisorConfig)
            .options(
                selectinload(SupervisorConfig.persistence_profile),
                selectinload(SupervisorConfig.subagents).selectinload(
                    SubagentTemplate.tools
                )
            )
            .where(SupervisorConfig.id == supervisor_id)
        )
        return result.scalar_one_or_none()

    async def create_supervisor(self, payload: SupervisorCreate) -> SupervisorConfig:
        subagents = await self._resolve_subagents(payload.subagent_ids)
        persistence_profile_id = await self._resolve_persistence_profile_id(
            payload.persistence_profile_id
        )
        supervisor = SupervisorConfig(
            name=payload.name,
            runtime=payload.runtime.model_dump(),
            global_tool_ids=[str(item) for item in payload.global_tool_ids],
            persistence_profile_id=persistence_profile_id,
            backend=payload.backend,
            memory=payload.memory,
            skills=payload.skills,
            middleware_ids=[str(item) for item in payload.middleware_ids],
            interrupt_on=payload.interrupt_on,
            enabled=payload.enabled,
            subagents=subagents,
        )
        self.session.add(supervisor)
        await self.session.commit()
        return await self.get_supervisor(supervisor.id)

    async def auto_generate_supervisor(self, query: str) -> SupervisorConfig:
        tools = await self._list_enabled_tools()
        draft = await self._generate_workflow_draft(query, tools)

        supervisor_name = await self._unique_supervisor_name(
            draft.get("supervisor_name") or "智能生成总控"
        )
        supervisor_runtime = {
            "model": str(draft.get("supervisor_model") or "qwen3.5-plus"),
            "temperature": float(draft.get("supervisor_temperature") or 0.2),
            "system_prompt": str(
                draft.get("supervisor_system_prompt")
                or "你是一个总控智能体。请优先判断是否应把任务委派给合适的子智能体，再整合结果并给出最终答复。"
            ),
        }

        tool_by_name = {tool.name: tool for tool in tools}
        subagent_entities: list[SubagentTemplate] = []
        for index, item in enumerate(draft.get("subagents") or [], start=1):
            raw_name = str(item.get("name") or f"子智能体_{index}")
            name = await self._unique_subagent_name(raw_name)
            tool_names = [
                str(tool_name)
                for tool_name in item.get("tool_names", [])
                if str(tool_name).strip() in tool_by_name
            ]
            selected_tools = [tool_by_name[tool_name] for tool_name in tool_names][:8]
            subagent = SubagentTemplate(
                name=name,
                description=str(
                    item.get("description")
                    or "说明在什么情况下，总控应该把任务委派给这个子智能体。"
                ),
                runtime={
                    "model": str(item.get("model") or supervisor_runtime["model"]),
                    "temperature": float(item.get("temperature") or 0.2),
                    "system_prompt": str(
                        item.get("system_prompt")
                        or "你是一个专注的子智能体。请直接完成被委派的任务，只返回对当前任务有帮助的结果。"
                    ),
                },
                skill_paths=[],
                middleware_ids=[],
                interrupt_on=None,
                response_format=None,
                enabled=True,
                tools=selected_tools,
            )
            self.session.add(subagent)
            subagent_entities.append(subagent)

        supervisor = SupervisorConfig(
            name=supervisor_name,
            runtime=supervisor_runtime,
            global_tool_ids=[],
            persistence_profile_id=None,
            backend=None,
            memory=[],
            skills=[],
            middleware_ids=[],
            interrupt_on=None,
            enabled=True,
            subagents=subagent_entities,
        )
        self.session.add(supervisor)
        await self.session.commit()
        return await self.get_supervisor(supervisor.id)

    async def update_supervisor(
        self,
        supervisor: SupervisorConfig,
        payload: SupervisorUpdate,
    ) -> SupervisorConfig:
        data = payload.model_dump(exclude_unset=True)
        if "subagent_ids" in data:
            supervisor.subagents = await self._resolve_subagents(data.pop("subagent_ids"))
        if "persistence_profile_id" in data:
            data["persistence_profile_id"] = await self._resolve_persistence_profile_id(
                data["persistence_profile_id"]
            )
        if "runtime" in data:
            supervisor.runtime = data.pop("runtime")
            if hasattr(supervisor.runtime, "model_dump"):
                supervisor.runtime = supervisor.runtime.model_dump()
        if "middleware_ids" in data and data["middleware_ids"] is not None:
            data["middleware_ids"] = [str(item) for item in data["middleware_ids"]]
        if "global_tool_ids" in data:
            data["global_tool_ids"] = [str(item) for item in data["global_tool_ids"]]
        for key, value in data.items():
            setattr(supervisor, key, value)
        await self.session.commit()
        return await self.get_supervisor(supervisor.id)

    async def delete_supervisor(self, supervisor: SupervisorConfig) -> None:
        result = await self.session.execute(
            select(SupervisorConfig)
            .options(
                selectinload(SupervisorConfig.subagents),
                selectinload(SupervisorConfig.runs).selectinload(AgentRun.events),
            )
            .where(SupervisorConfig.id == supervisor.id)
        )
        supervisor_with_links = result.scalar_one()
        supervisor_with_links.subagents.clear()
        await self.session.flush()
        for run in list(supervisor_with_links.runs):
            await self.session.delete(run)
        await self.session.flush()
        await self.session.delete(supervisor_with_links)
        await self.session.commit()

    async def validate_supervisor(
        self,
        supervisor: SupervisorConfig,
    ) -> SupervisorValidationResult:
        issues: list[ValidationIssue] = []

        runtime = supervisor.runtime
        if not runtime.get("model"):
            issues.append(
                ValidationIssue(
                    level="error",
                    code="supervisor_model_missing",
                    message="总控的 runtime.model 不能为空。",
                    target="runtime.model",
                )
            )
        if not runtime.get("system_prompt"):
            issues.append(
                ValidationIssue(
                    level="error",
                    code="supervisor_prompt_missing",
                    message="总控的 runtime.system_prompt 不能为空。",
                    target="runtime.system_prompt",
                )
            )
        if supervisor.persistence_profile_id and supervisor.persistence_profile is None:
            issues.append(
                ValidationIssue(
                    level="error",
                    code="persistence_profile_missing",
                    message="总控引用的 Persistence Profile 不存在。",
                    target="persistence_profile_id",
                )
            )

        names: set[str] = set()
        for subagent in supervisor.subagents:
            if subagent.name in names:
                issues.append(
                    ValidationIssue(
                        level="error",
                        code="duplicate_subagent_name",
                        message=f"存在重复的子智能体名称：{subagent.name}",
                        target=f"subagents.{subagent.id}",
                    )
                )
            names.add(subagent.name)

            if not subagent.enabled:
                issues.append(
                    ValidationIssue(
                        level="warning",
                        code="subagent_disabled",
                        message=f"子智能体 {subagent.name} 已绑定，但当前处于停用状态。",
                        target=f"subagents.{subagent.id}",
                    )
                )

            tool_count = len(subagent.tools)
            if tool_count < 3 or tool_count > 8:
                issues.append(
                    ValidationIssue(
                        level="warning",
                        code="subagent_tool_count_outside_recommendation",
                        message=(
                            f"子智能体 {subagent.name} 当前绑定了 {tool_count} 个工具；"
                            "建议范围是 3 到 8 个。"
                        ),
                        target=f"subagents.{subagent.id}.tool_ids",
                    )
                )

        return SupervisorValidationResult(
            valid=not any(issue.level == "error" for issue in issues),
            issues=issues,
        )

    async def generate_supervisor(self, supervisor: SupervisorConfig) -> GeneratedConfig:
        workflow_validation = await self.validate_supervisor(supervisor)
        if not workflow_validation.valid:
            error_messages = [
                issue.message for issue in workflow_validation.issues if issue.level == "error"
            ]
            raise ValueError("生成模板前校验失败：" + "；".join(error_messages))

        config = self._compact_config(
            {
                "name": supervisor.name,
                "runtime": supervisor.runtime,
                "global_tool_ids": supervisor.global_tool_ids,
                "persistence_profile_id": str(supervisor.persistence_profile_id)
                if supervisor.persistence_profile_id
                else None,
                "persistence_profile": self._serialize_persistence_profile(
                    supervisor.persistence_profile
                ),
                "backend": supervisor.backend,
                "memory": supervisor.memory,
                "skills": supervisor.skills,
                "middleware_ids": supervisor.middleware_ids,
                "interrupt_on": supervisor.interrupt_on,
                "subagents": [
                    self._compact_config(
                        {
                            "name": subagent.name,
                            "description": subagent.description,
                            "runtime": subagent.runtime,
                            "tool_ids": [str(tool.id) for tool in subagent.tools],
                            "tool_names": [tool.name for tool in subagent.tools],
                            "skill_paths": subagent.skill_paths,
                            "middleware_ids": subagent.middleware_ids,
                            "interrupt_on": subagent.interrupt_on,
                            "response_format": subagent.response_format,
                        }
                    )
                    for subagent in supervisor.subagents
                ],
            }
        )

        imports_by_module: dict[str, list[str]] = defaultdict(list)
        unique_tools = {}
        middleware_registry = await self._resolve_middleware_definitions(
            supervisor.middleware_ids
            + [
                middleware_id
                for subagent in supervisor.subagents
                for middleware_id in subagent.middleware_ids
            ]
        )
        for subagent in supervisor.subagents:
            for tool in subagent.tools:
                module_path, symbol = tool.python_import_path.rsplit(".", 1)
                imports_by_module[module_path].append(symbol)
                unique_tools[tool.name] = tool
        has_tools = bool(unique_tools)
        has_middlewares = bool(middleware_registry)
        has_persistence = supervisor.persistence_profile is not None
        has_backend = bool(
            supervisor.backend and str(supervisor.backend.get("type") or "").strip() not in ("", "none")
        )
        has_interrupts = self._has_interrupt_behavior(supervisor)

        import_lines = [
            "from deepagents import create_deep_agent",
            "from app.core.llm import build_chat_model",
        ]
        if has_backend:
            import_lines.append("from app.backend import build_backend")
        if has_middlewares:
            import_lines.append("from app.middleware import build_middlewares")
        if has_persistence:
            import_lines.append("from app.persistence import build_persistence_kwargs")
        for module_path, symbols in sorted(imports_by_module.items()):
            unique_symbols = ", ".join(sorted(set(symbols)))
            import_lines.append(f"from {module_path} import {unique_symbols}")

        subagent_blocks = []
        subagent_var_names: list[str] = []
        for subagent in supervisor.subagents:
            tool_list = ", ".join(tool.name for tool in subagent.tools)
            var_name = self._safe_identifier(subagent.name)
            subagent_var_names.append(var_name)
            subagent_lines = [
                f'{var_name} = {{',
                f'    "name": "{subagent.name}",',
                f'    "description": "{subagent.description}",',
                f'    "system_prompt": {subagent.runtime["system_prompt"]!r},',
                f'    "model": build_chat_model(model_name={subagent.runtime["model"]!r}, temperature={subagent.runtime["temperature"]}),',
            ]
            if tool_list:
                subagent_lines.append(f'    "tools": [{tool_list}],')
            if subagent.skill_paths:
                subagent_lines.append(f'    "skills": {subagent.skill_paths!r},')
            if has_middlewares and subagent.middleware_ids:
                subagent_lines.append(
                    f'    "middleware": build_middlewares({subagent.middleware_ids!r}),'
                )
            interrupt_on = self._merge_interrupt_config(
                subagent.interrupt_on,
                self._build_tool_interrupt_config(subagent.tools),
            )
            if interrupt_on:
                subagent_lines.append(f'    "interrupt_on": {interrupt_on!r},')
            if subagent.response_format is not None:
                subagent_lines.append(f'    "response_format": {subagent.response_format!r},')
            subagent_lines.append("}")
            subagent_blocks.append(
                "\n".join(subagent_lines)
            )

        agent_lines = [
            "agent = create_deep_agent(",
            f'    model=build_chat_model(model_name={supervisor.runtime["model"]!r}, temperature={supervisor.runtime["temperature"]}),',
            f'    system_prompt={supervisor.runtime["system_prompt"]!r},',
            f'    subagents=[{", ".join(subagent_var_names)}],',
        ]
        if supervisor.global_tool_ids:
            agent_lines.append("    tools=[],")
        if supervisor.memory:
            agent_lines.append(f"    memory={supervisor.memory!r},")
        if supervisor.skills:
            agent_lines.append(f"    skills={supervisor.skills!r},")
        if has_backend:
            agent_lines.append("    backend=build_backend(),")
        if has_middlewares and supervisor.middleware_ids:
            agent_lines.append(
                f"    middleware=build_middlewares({supervisor.middleware_ids!r}),"
            )
        interrupt_on = self._merge_interrupt_config(supervisor.interrupt_on, {})
        if interrupt_on:
            agent_lines.append(f"    interrupt_on={interrupt_on!r},")
        if has_persistence:
            agent_lines.append("    **build_persistence_kwargs(),")
        agent_lines.append(")")

        agent_code = "\n\n".join(
            import_lines
            + [
                "",
                *subagent_blocks,
                "",
                "\n".join(agent_lines),
            ]
        )

        project_files = self._build_project_files(
            supervisor=supervisor,
            subagent_var_names=subagent_var_names,
            agent_code=agent_code,
            unique_tools=unique_tools,
            middleware_registry=middleware_registry,
            has_backend=has_backend,
            has_middlewares=has_middlewares,
            has_persistence=has_persistence,
            has_interrupts=has_interrupts,
        )
        python_code = "\n\n".join(
            f"# === {item['path']} ===\n{item['content']}" for item in project_files
        )
        code_validation = self._validate_project_files(project_files)
        if not code_validation.valid:
            error_messages = [
                issue.message for issue in code_validation.issues if issue.level == "error"
            ]
            raise ValueError("生成模板代码校验失败：" + "；".join(error_messages))
        archive_filename = self._build_project_archive(supervisor.name, project_files)

        return GeneratedConfig(
            config=config,
            python_code=python_code,
            project_files=project_files,
            workflow_validation=workflow_validation,
            code_validation=code_validation,
            archive_filename=archive_filename,
            download_url=f"/downloads/{archive_filename}",
        )

    @staticmethod
    def _safe_identifier(name: str) -> str:
        sanitized = "".join(char if char.isalnum() or char == "_" else "_" for char in name)
        if not sanitized:
            return "subagent_node"
        if sanitized[0].isdigit():
            sanitized = f"subagent_{sanitized}"
        return sanitized

    @staticmethod
    def _slugify_filename(name: str) -> str:
        slug = "".join(char if char.isalnum() or char in ("-", "_") else "-" for char in name)
        slug = slug.strip("-_")
        return slug or "deepagent-workflow-template"

    async def _resolve_subagents(
        self,
        subagent_ids: list[uuid.UUID],
    ) -> list[SubagentTemplate]:
        if not subagent_ids:
            return []
        result = await self.session.execute(
            select(SubagentTemplate)
            .options(selectinload(SubagentTemplate.tools))
            .where(SubagentTemplate.id.in_(subagent_ids))
        )
        subagents = list(result.scalars().all())
        found_ids = {subagent.id for subagent in subagents}
        missing = [subagent_id for subagent_id in subagent_ids if subagent_id not in found_ids]
        if missing:
            raise ValueError(f"subagent ids not found: {missing}")
        subagent_by_id = {subagent.id: subagent for subagent in subagents}
        return [subagent_by_id[subagent_id] for subagent_id in subagent_ids]

    async def _resolve_persistence_profile_id(
        self,
        profile_id: uuid.UUID | None,
    ) -> uuid.UUID | None:
        if profile_id is None:
            return None
        result = await self.session.execute(
            select(PersistenceProfile.id).where(PersistenceProfile.id == profile_id)
        )
        if result.scalar_one_or_none() is None:
            raise ValueError(f"persistence profile not found: {profile_id}")
        return profile_id

    async def _resolve_middleware_definitions(
        self,
        middleware_ids: list[str],
    ) -> dict[str, dict]:
        if not middleware_ids:
            return {}
        normalized_ids = [uuid.UUID(str(item)) for item in middleware_ids]
        result = await self.session.execute(
            select(MiddlewareDefinition).where(MiddlewareDefinition.id.in_(normalized_ids))
        )
        definitions = list(result.scalars().all())
        by_id = {item.id: item for item in definitions}
        return {
            str(middleware_id): {
                "name": by_id[middleware_id].name,
                "scope": by_id[middleware_id].scope,
                "python_import_path": by_id[middleware_id].python_import_path,
                "description": by_id[middleware_id].description,
                "config": by_id[middleware_id].config or {},
            }
            for middleware_id in normalized_ids
            if middleware_id in by_id and by_id[middleware_id].enabled
        }

    async def _list_enabled_tools(self) -> list[ToolDefinition]:
        result = await self.session.execute(
            select(ToolDefinition)
            .where(ToolDefinition.enabled.is_(True))
            .order_by(ToolDefinition.namespace, ToolDefinition.name)
        )
        return list(result.scalars().all())

    async def _generate_workflow_draft(
        self,
        query: str,
        tools: list[ToolDefinition],
    ) -> dict:
        tool_descriptions = "\n".join(
            f"- {tool.name} | namespace={tool.namespace} | desc={tool.description} | approval={tool.requires_human_approval}"
            for tool in tools
        )
        llm = build_chat_model(model_name=None, temperature=0.2)
        response = await llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "你是一个 Deep Agents Workflow 规划器。"
                        "你只能从给定的工具列表里挑选工具，不能虚构不存在的工具。"
                        "请输出严格 JSON，不要输出 markdown。"
                    )
                ),
                HumanMessage(
                    content=textwrap.dedent(
                        f"""
                        用户需求：
                        {query}

                        可用工具：
                        {tool_descriptions or "- 当前没有可用工具"}

                        请返回 JSON，格式如下：
                        {{
                          "supervisor_name": "简短中文名称",
                          "supervisor_model": "qwen3.5-plus",
                          "supervisor_temperature": 0.2,
                          "supervisor_system_prompt": "总控提示词",
                          "subagents": [
                            {{
                              "name": "子智能体名称",
                              "description": "说明在什么情况下委派给它",
                              "model": "qwen3.5-plus",
                              "temperature": 0.2,
                              "system_prompt": "子智能体提示词",
                              "tool_names": ["tool_a", "tool_b"]
                            }}
                          ]
                        }}

                        约束：
                        1. subagents 数量控制在 2 到 4 个。
                        2. 每个子智能体尽量绑定 1 到 4 个工具。
                        3. 如果没有合适工具，可以返回空数组，但不要虚构工具名。
                        4. 提示词和 description 都用中文。
                        """
                    ).strip()
                ),
            ]
        )
        content = response.content if hasattr(response, "content") else str(response)
        if not isinstance(content, str):
            content = str(content)
        return self._parse_json_payload(content)

    @staticmethod
    def _parse_json_payload(content: str) -> dict:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("智能生成返回的内容不是合法 JSON。")
        return json.loads(cleaned[start : end + 1])

    async def _unique_supervisor_name(self, base: str) -> str:
        return await self._unique_name(
            SupervisorConfig,
            (base or "智能生成总控").strip(),
        )

    async def _unique_subagent_name(self, base: str) -> str:
        return await self._unique_name(
            SubagentTemplate,
            (base or "智能生成子智能体").strip(),
        )

    async def _unique_name(self, model_cls, base: str) -> str:
        candidate = base
        index = 1
        while True:
            result = await self.session.execute(
                select(model_cls.id).where(model_cls.name == candidate)
            )
            if result.scalar_one_or_none() is None:
                return candidate
            index += 1
            candidate = f"{base}_{index}"

    def _build_project_files(
        self,
        *,
        supervisor: SupervisorConfig,
        subagent_var_names: list[str],
        agent_code: str,
        unique_tools: dict[str, object],
        middleware_registry: dict[str, dict],
        has_backend: bool,
        has_middlewares: bool,
        has_persistence: bool,
        has_interrupts: bool,
    ) -> list[dict[str, str]]:
        has_tools = bool(unique_tools)
        tool_files = self._build_tool_module(unique_tools) if has_tools else None
        subagents_content = self._build_subagents_module(
            supervisor,
            subagent_var_names,
            include_tools_module=has_tools,
            include_middleware_module=has_middlewares,
        )
        agent_content = self._build_agent_module(
            supervisor,
            include_backend_module=has_backend,
            include_middleware_module=has_middlewares,
            include_persistence_module=has_persistence,
        )
        backend_content = self._build_backend_module(supervisor.backend)
        middleware_content = (
            self._build_middleware_module(middleware_registry) if has_middlewares else None
        )
        persistence_content = self._build_persistence_module(supervisor.persistence_profile)
        run_content = textwrap.dedent(
            """
            import asyncio

            from app.agent import agent


            async def main() -> None:
                result = await agent.ainvoke(
                    {"messages": [{"role": "user", "content": "你好，请开始执行任务。"}]},
                    config={"configurable": {"thread_id": "demo-thread"}},
                    version="v2",
                )
                print(result)


            if __name__ == "__main__":
                asyncio.run(main())
            """
        ).strip()
        resume_content = textwrap.dedent(
            """
            import asyncio

            from langgraph.types import Command

            from app.agent import agent


            async def main() -> None:
                result = await agent.ainvoke(
                    Command(
                        resume={
                            "decisions": [
                                {"type": "approve"}
                            ]
                        }
                    ),
                    config={"configurable": {"thread_id": "demo-thread"}},
                    version="v2",
                )
                print(result)


            if __name__ == "__main__":
                asyncio.run(main())
            """
        ).strip()
        env_example_content = textwrap.dedent(
            """
            DASHSCOPE_API_KEY=your-api-key
            DASHSCOPE_BASE_URL=http://127.0.0.1:3000/v1
            DASHSCOPE_MODEL=qwen3.5-plus
            """
        ).strip()
        llm_content = textwrap.dedent(
            """
            import os

            from dotenv import load_dotenv
            from langchain_openai import ChatOpenAI


            load_dotenv()


            def build_chat_model(*, model_name: str | None, temperature: float) -> ChatOpenAI:
                return ChatOpenAI(
                    model=model_name or os.environ["DASHSCOPE_MODEL"],
                    api_key=os.environ["DASHSCOPE_API_KEY"],
                    base_url=os.environ["DASHSCOPE_BASE_URL"],
                    temperature=temperature,
                )
            """
        ).strip()
        pyproject_content = textwrap.dedent(
            """
            [project]
            name = "deepagent-workflow-template"
            version = "0.1.0"
            requires-python = ">=3.11"
            dependencies = [
              "deepagents",
              "langchain-openai",
              "python-dotenv",
            ]
            """
        ).strip()
        readme_lines = [
            f"# {supervisor.name} Deep Agents 模板",
            "",
            "这是根据可视化 Workflow Canvas 自动生成的 Deep Agents 项目骨架。",
            "",
            "## 环境变量",
            "",
            "先复制 `.env.example` 为 `.env`，再填入实际模型服务配置。",
            "",
            "## 目录",
            "",
            "- `.env.example`: 模型调用所需的环境变量模板。",
            ]
        if has_tools:
            readme_lines.append(
                "- `app/tools.py`: 所有工具定义，函数体暂时留空，等待你实现业务逻辑。"
            )
        if has_backend:
            readme_lines.append(
                "- `app/backend.py`: 当前 workflow 实际配置的 backend 装配器。"
            )
        else:
            readme_lines.append(
                "- `app/backend.py`: backend 占位文件；当前模板未启用 backend，可在二次开发时补充工作目录或运行态 backend。"
            )
        if has_middlewares:
            readme_lines.append(
                "- `app/middleware.py`: 当前 workflow 实际绑定到总控或子智能体的中间件装配器。"
            )
        if has_persistence:
            readme_lines.append(
                "- `app/persistence.py`: 当前 workflow 实际配置的持久化策略装配器。"
            )
        else:
            readme_lines.append(
                "- `app/persistence.py`: 持久化策略占位文件；当前模板未启用 persistence，可在二次开发时补充 backend/checkpointer/store。"
            )
        readme_lines.extend(
            [
                "- `app/subagents.py`: 子智能体定义。",
                "- `app/agent.py`: 总控 Deep Agent 组装入口。",
                "- `app/run.py`: 最小运行示例。",
            ]
        )
        if has_interrupts:
            readme_lines.append("- `app/resume.py`: 人工确认后恢复被中断运行的示例。")
            readme_lines.extend(
                [
                    "",
                    "## 人工确认与恢复",
                    "",
                    "当前 workflow 中存在需要人工确认的工具调用，模板已自动补齐 `interrupt_on`。",
                    "",
                    "建议的二次开发路径：",
                    "",
                    "1. 首次运行时使用固定 `thread_id` 调用 `app/run.py`。",
                    "2. 当运行返回中断事件后，收集人工决策。",
                    "3. 使用相同的 `thread_id` 调用 `app/resume.py` 恢复执行。",
                    "",
                    "如果你要在生产环境中使用恢复能力，请接入持久化 checkpointer，而不是只使用内存实现。",
                ]
            )
        readme_content = "\n".join(readme_lines)

        project_files = [
            {"path": "pyproject.toml", "content": pyproject_content},
            {"path": ".env.example", "content": env_example_content},
            {"path": "README.md", "content": readme_content},
            {"path": "app/__init__.py", "content": ""},
            {"path": "app/core/__init__.py", "content": ""},
            {"path": "app/core/llm.py", "content": llm_content},
            {"path": "app/subagents.py", "content": subagents_content},
            {"path": "app/agent.py", "content": agent_content},
            {"path": "app/run.py", "content": run_content},
            {"path": "app/_compiled_reference.py", "content": agent_code},
        ]
        if has_interrupts:
            project_files.insert(9, {"path": "app/resume.py", "content": resume_content})
        if has_tools and tool_files is not None:
            project_files.insert(5, {"path": "app/tools.py", "content": tool_files})
        if backend_content is not None:
            insert_index = 6 if has_tools else 5
            project_files.insert(insert_index, {"path": "app/backend.py", "content": backend_content})
        if has_middlewares and middleware_content is not None:
            insert_index = 7 if has_tools else 6
            project_files.insert(insert_index, {"path": "app/middleware.py", "content": middleware_content})
        if persistence_content is not None:
            insert_index = (
                8
                if has_tools and has_middlewares
                else 7
                if (has_tools or has_middlewares)
                else 6
            )
            project_files.insert(insert_index, {"path": "app/persistence.py", "content": persistence_content})
        return project_files

    def _validate_project_files(
        self,
        project_files: list[dict[str, str]],
    ) -> SupervisorValidationResult:
        issues: list[ValidationIssue] = []
        with TemporaryDirectory(prefix="deepagent-template-") as temp_dir:
            temp_root = Path(temp_dir)
            for item in project_files:
                file_path = temp_root / item["path"]
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(item["content"], encoding="utf-8")

            for item in project_files:
                path = item["path"]
                content = item["content"]
                if not path.endswith(".py"):
                    continue
                try:
                    ast.parse(content, filename=path)
                    compile(content, path, "exec")
                except SyntaxError as exc:
                    issues.append(
                        ValidationIssue(
                            level="error",
                            code="python_syntax_error",
                            message=f"{path} 存在语法错误：第 {exc.lineno} 行 {exc.msg}",
                            target=path,
                        )
                    )
                except Exception as exc:
                    issues.append(
                        ValidationIssue(
                            level="error",
                            code="python_compile_error",
                            message=f"{path} 编译失败：{exc}",
                            target=path,
                        )
                    )

            if not any(issue.level == "error" for issue in issues):
                compiled = compileall.compile_dir(str(temp_root), force=True, quiet=1)
                if not compiled:
                    issues.append(
                        ValidationIssue(
                            level="error",
                            code="python_bytecode_compile_failed",
                            message="生成后的 Python 项目无法完整编译成字节码，请检查模板代码。",
                            target="project",
                        )
                    )
        return SupervisorValidationResult(
            valid=not any(issue.level == "error" for issue in issues),
            issues=issues,
        )

    def _build_project_archive(
        self,
        supervisor_name: str,
        project_files: list[dict[str, str]],
    ) -> str:
        package_slug = self._slugify_filename(supervisor_name)
        archive_filename = f"{package_slug}-{uuid.uuid4().hex[:8]}.zip"
        archive_path = DOWNLOADS_DIR / archive_filename

        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for item in project_files:
                archive.writestr(f"{package_slug}/{item['path']}", item["content"])

        return archive_filename

    @classmethod
    def _compact_config(cls, value):
        if isinstance(value, dict):
            compacted = {
                key: cls._compact_config(item)
                for key, item in value.items()
            }
            return {
                key: item
                for key, item in compacted.items()
                if item not in (None, "", [], {})
            }
        if isinstance(value, list):
            return [cls._compact_config(item) for item in value]
        return value

    def _build_tool_module(self, unique_tools: dict[str, object]) -> str:
        blocks = [
            textwrap.dedent(
                """
                from langchain.tools import tool


                def app_tool(
                    *,
                    namespace: str,
                    permission_level: str = "safe",
                    requires_human_approval: bool = False,
                    **tool_kwargs,
                ):
                    def decorator(fn):
                        wrapped = tool(**tool_kwargs)(fn)
                        setattr(wrapped, "_tool_namespace", namespace)
                        setattr(wrapped, "_tool_permission_level", permission_level)
                        setattr(wrapped, "_tool_requires_human_approval", requires_human_approval)
                        return wrapped

                    return decorator
                """
            ).strip()
        ]

        for tool_name, tool in sorted(unique_tools.items()):
            args_schema = tool.args_schema or {}
            properties = args_schema.get("properties", {})
            required = set(args_schema.get("required", []))
            args = []
            docstring = (tool.description or f"{tool_name} tool").strip()
            for field_name, field_schema in properties.items():
                annotation = self._map_json_schema_type(field_schema.get("type"))
                if field_name not in required:
                    annotation = f"{annotation} | None"
                    args.append(f"{field_name}: {annotation} = None")
                else:
                    args.append(f"{field_name}: {annotation}")
            signature = ", ".join(args) if args else ""
            namespace = tool.namespace
            permission_level = tool.permission_level
            requires_human_approval = tool.requires_human_approval
            blocks.append(
                textwrap.dedent(
                    f"""
                    @app_tool(
                        namespace={namespace!r},
                        permission_level={permission_level!r},
                        requires_human_approval={requires_human_approval!r},
                    )
                    async def {tool_name}({signature}) -> str:
                        \"\"\"{docstring}\"\"\"
                        pass
                    """
                ).strip()
            )
        return "\n\n\n".join(blocks)

    @staticmethod
    def _build_tool_interrupt_config(tools) -> dict[str, dict]:
        result: dict[str, dict] = {}
        for tool in tools:
            if tool.enabled and tool.requires_human_approval:
                result[tool.name] = {"allowed_decisions": ["approve", "edit", "reject"]}
        return result

    @staticmethod
    def _merge_interrupt_config(
        configured: dict | None,
        auto_generated: dict[str, dict],
    ) -> dict:
        merged = dict(auto_generated)
        if configured:
            merged.update(configured)
        return merged

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

    def _build_subagents_module(
        self,
        supervisor: SupervisorConfig,
        subagent_var_names: list[str],
        *,
        include_tools_module: bool,
        include_middleware_module: bool,
    ) -> str:
        blocks = ["from app.core.llm import build_chat_model"]
        if include_middleware_module:
            blocks.append("from app.middleware import build_middlewares")
        if include_tools_module:
            blocks.append("from app.tools import *")
        blocks.append("")
        for subagent, var_name in zip(supervisor.subagents, subagent_var_names, strict=False):
            tool_list = ", ".join(tool.name for tool in subagent.tools)
            subagent_lines = [
                f"{var_name} = {{",
                f'    "name": {subagent.name!r},',
                f'    "description": {subagent.description!r},',
                f'    "system_prompt": {subagent.runtime["system_prompt"]!r},',
                "    \"model\": build_chat_model(",
                f'        model_name={subagent.runtime["model"]!r},',
                f'        temperature={subagent.runtime["temperature"]},',
                "    ),",
            ]
            if tool_list:
                subagent_lines.append(f'    "tools": [{tool_list}],')
            if subagent.skill_paths:
                subagent_lines.append(f'    "skills": {subagent.skill_paths!r},')
            if include_middleware_module and subagent.middleware_ids:
                subagent_lines.append(
                    f'    "middleware": build_middlewares({subagent.middleware_ids!r}),'
                )
            interrupt_on = self._merge_interrupt_config(
                subagent.interrupt_on,
                self._build_tool_interrupt_config(subagent.tools),
            )
            if interrupt_on:
                subagent_lines.append(f'    "interrupt_on": {interrupt_on!r},')
            if subagent.response_format is not None:
                subagent_lines.append(f'    "response_format": {subagent.response_format!r},')
            subagent_lines.append("}")
            blocks.append("\n".join(subagent_lines))
        blocks.append(f"SUBAGENTS = [{', '.join(subagent_var_names)}]")
        return "\n\n".join(blocks)

    def _build_agent_module(
        self,
        supervisor: SupervisorConfig,
        *,
        include_backend_module: bool,
        include_middleware_module: bool,
        include_persistence_module: bool,
    ) -> str:
        lines = [
            "from deepagents import create_deep_agent",
            "",
            "from app.core.llm import build_chat_model",
        ]
        if include_backend_module:
            lines.append("from app.backend import build_backend")
        if include_middleware_module:
            lines.append("from app.middleware import build_middlewares")
        if include_persistence_module:
            lines.append("from app.persistence import build_persistence_kwargs")
        lines.extend(
            [
                "from app.subagents import SUBAGENTS",
                "",
                "",
                "agent = create_deep_agent(",
                "    model=build_chat_model(",
                f'        model_name={supervisor.runtime["model"]!r},',
                f'        temperature={supervisor.runtime["temperature"]},',
                "    ),",
                f'    system_prompt={supervisor.runtime["system_prompt"]!r},',
                "    subagents=SUBAGENTS,",
            ]
        )
        if supervisor.global_tool_ids:
            lines.append("    tools=[],")
        if supervisor.skills:
            lines.append(f"    skills={supervisor.skills!r},")
        if supervisor.memory:
            lines.append(f"    memory={supervisor.memory!r},")
        if include_backend_module:
            lines.append("    backend=build_backend(),")
        if include_middleware_module and supervisor.middleware_ids:
            lines.append(f"    middleware=build_middlewares({supervisor.middleware_ids!r}),")
        interrupt_on = self._merge_interrupt_config(supervisor.interrupt_on, {})
        if interrupt_on:
            lines.append(f"    interrupt_on={interrupt_on!r},")
        if include_persistence_module:
            lines.append("    **build_persistence_kwargs(),")
        lines.append(")")
        return "\n".join(lines)

    def _build_backend_module(self, backend: dict | None) -> str:
        definition = backend or {}
        if str(definition.get("type") or "").strip() in ("", "none"):
            return textwrap.dedent(
                """
                \"\"\"Backend integration placeholder.

                当前模板还没有绑定实际的 backend。
                你可以在这里补充自定义工作目录、文件系统 backend 或运行态 backend，
                然后在 `app/agent.py` 里把 `backend=build_backend()` 接回
                `create_deep_agent(...)`。
                \"\"\"


                def build_backend():
                    \"\"\"Return a backend instance for create_deep_agent.\"\"\"
                    return None
                """
            ).strip()
        return textwrap.dedent(
            f"""
            import importlib


            BACKEND_DEFINITION = {definition!r}


            def load_symbol(python_import_path: str):
                module_path, symbol = python_import_path.rsplit(".", 1)
                module = importlib.import_module(module_path)
                return getattr(module, symbol)


            def build_backend():
                component_type = (BACKEND_DEFINITION.get("type") or "").strip()
                import_path = BACKEND_DEFINITION.get("import_path")
                config = BACKEND_DEFINITION.get("config", {{}}) or {{}}
                if component_type in ("", "none"):
                    return None
                if component_type == "filesystem":
                    return load_symbol("deepagents.backends.filesystem.FilesystemBackend")(**config)
                if component_type == "state":
                    backend_cls = load_symbol("deepagents.backends.StateBackend")
                    return lambda runtime: backend_cls(runtime)
                if component_type == "custom" and import_path:
                    return load_symbol(import_path)(**config)
                return None
            """
        ).strip()

    def _build_middleware_module(self, middleware_registry: dict[str, dict]) -> str:
        return textwrap.dedent(
            f"""
            import importlib


            MIDDLEWARE_REGISTRY = {middleware_registry!r}


            def load_symbol(python_import_path: str):
                module_path, symbol = python_import_path.rsplit(".", 1)
                module = importlib.import_module(module_path)
                return getattr(module, symbol)


            def instantiate_middleware(definition: dict):
                symbol = load_symbol(definition["python_import_path"])
                config = definition.get("config", {{}}) or {{}}
                return symbol(**config)


            def build_middlewares(middleware_ids: list[str]):
                result = []
                for middleware_id in middleware_ids:
                    definition = MIDDLEWARE_REGISTRY.get(middleware_id)
                    if not definition:
                        continue
                    result.append(instantiate_middleware(definition))
                return result
            """
        ).strip()

    def _build_persistence_module(self, profile: PersistenceProfile | None) -> str:
        serialized = self._serialize_persistence_profile(profile)
        if serialized is None:
            return textwrap.dedent(
                """
                \"\"\"Persistence integration placeholder.

                当前模板还没有绑定实际的 Persistence Profile。
                你可以在这里补充：
                1. backend
                2. checkpointer
                3. store

                然后在 `app/agent.py` 里把 `**build_persistence_kwargs()` 接回
                `create_deep_agent(...)`。
                \"\"\"


                def build_persistence_kwargs():
                    \"\"\"Return kwargs for create_deep_agent persistence integration.\"\"\"
                    return {}
                """
            ).strip()
        return textwrap.dedent(
            f"""
            import importlib


            PERSISTENCE_PROFILE = {serialized!r}


            def load_symbol(python_import_path: str):
                module_path, symbol = python_import_path.rsplit(".", 1)
                module = importlib.import_module(module_path)
                return getattr(module, symbol)


            def build_component(component_type: str, import_path: str | None, config: dict):
                if component_type in ("none", "", None):
                    return None
                if component_type == "memory":
                    return load_symbol("langgraph.checkpoint.memory.MemorySaver")(**config)
                if component_type == "filesystem":
                    return load_symbol("deepagents.backends.filesystem.FilesystemBackend")(**config)
                if component_type == "state":
                    backend_cls = load_symbol("deepagents.backends.StateBackend")
                    return lambda runtime: backend_cls(runtime)
                if component_type == "in_memory_store":
                    return load_symbol("langgraph.store.memory.InMemoryStore")(**config)
                if component_type == "custom" and import_path:
                    return load_symbol(import_path)(**config)
                return None


            def build_persistence_kwargs():
                profile = PERSISTENCE_PROFILE
                if not profile:
                    return {{}}
                kwargs = {{}}
                backend = build_component(
                    profile["backend_type"],
                    profile.get("backend_import_path"),
                    profile.get("backend_config", {{}}),
                )
                checkpointer = build_component(
                    profile["checkpointer_type"],
                    profile.get("checkpointer_import_path"),
                    profile.get("checkpointer_config", {{}}),
                )
                store = build_component(
                    profile["store_type"],
                    profile.get("store_import_path"),
                    profile.get("store_config", {{}}),
                )
                if backend is not None:
                    kwargs["backend"] = backend
                if checkpointer is not None:
                    kwargs["checkpointer"] = checkpointer
                if store is not None:
                    kwargs["store"] = store
                return kwargs
            """
        ).strip()

    @staticmethod
    def _map_json_schema_type(schema_type: str | None) -> str:
        return {
            "string": "str",
            "integer": "int",
            "number": "float",
            "boolean": "bool",
            "array": "list",
            "object": "dict",
        }.get(schema_type or "", "str")

    @staticmethod
    def _serialize_persistence_profile(profile: PersistenceProfile | None) -> dict | None:
        if profile is None:
            return None
        return {
            "id": str(profile.id),
            "name": profile.name,
            "description": profile.description,
            "backend_type": profile.backend_type,
            "backend_import_path": profile.backend_import_path,
            "backend_config": profile.backend_config,
            "checkpointer_type": profile.checkpointer_type,
            "checkpointer_import_path": profile.checkpointer_import_path,
            "checkpointer_config": profile.checkpointer_config,
            "store_type": profile.store_type,
            "store_import_path": profile.store_import_path,
            "store_config": profile.store_config,
            "enabled": profile.enabled,
        }
