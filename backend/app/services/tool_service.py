import ast
import importlib
import inspect
import pkgutil
from dataclasses import dataclass
from pathlib import Path
import uuid

from langchain_core.tools import BaseTool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.tool import ToolDefinition


@dataclass
class ScannedTool:
    namespace: str
    name: str
    python_import_path: str
    description: str
    args_schema: dict
    permission_level: str
    requires_human_approval: bool


class ToolService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_tools(self) -> list[ToolDefinition]:
        result = await self.session.execute(
            select(ToolDefinition).order_by(ToolDefinition.namespace, ToolDefinition.name)
        )
        return list(result.scalars().all())

    async def get_tool(self, tool_id: uuid.UUID) -> ToolDefinition | None:
        return await self.session.get(ToolDefinition, tool_id)

    async def update_tool(self, tool: ToolDefinition, **fields) -> ToolDefinition:
        for key, value in fields.items():
            if value is not None:
                setattr(tool, key, value)
        await self.session.commit()
        await self.session.refresh(tool)
        return tool

    async def get_tool_source(self, tool: ToolDefinition) -> dict[str, str]:
        location = self._resolve_tool_source_location(tool.python_import_path)
        return {
            "tool_id": str(tool.id),
            "python_import_path": tool.python_import_path,
            "source_code": location["source_code"],
        }

    async def update_tool_source(self, tool: ToolDefinition, source_code: str) -> ToolDefinition:
        location = self._resolve_tool_source_location(tool.python_import_path)
        function_name = location["function_name"]
        normalized_source = source_code.rstrip() + "\n"

        try:
            snippet_tree = ast.parse(normalized_source)
        except SyntaxError as exc:
            raise ValueError(f"工具代码存在语法错误：第 {exc.lineno} 行 {exc.msg}") from exc

        function_nodes = [
            node
            for node in snippet_tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        ]
        if len(function_nodes) != 1:
            raise ValueError("工具代码必须只包含一个函数定义。")
        function_node = function_nodes[0]
        if function_node.name != function_name:
            raise ValueError(f"工具函数名必须保持为 {function_name}。")
        if not function_node.decorator_list:
            raise ValueError("工具函数必须保留装饰器，例如 @app_tool(...)。")

        file_path = Path(location["file_path"])
        original_content = file_path.read_text(encoding="utf-8")
        original_lines = original_content.splitlines()
        replacement_lines = normalized_source.rstrip("\n").splitlines()
        updated_lines = (
            original_lines[: location["start_line"] - 1]
            + replacement_lines
            + original_lines[location["end_line"] :]
        )
        updated_content = "\n".join(updated_lines) + "\n"

        try:
            ast.parse(updated_content, filename=str(file_path))
        except SyntaxError as exc:
            raise ValueError(
                f"写回后的工具文件存在语法错误：第 {exc.lineno} 行 {exc.msg}"
            ) from exc

        file_path.write_text(updated_content, encoding="utf-8")
        importlib.invalidate_caches()
        refreshed_tools = await self.refresh_tools(reload_modules=True)
        for refreshed in refreshed_tools:
            if refreshed.id == tool.id:
                return refreshed
        refreshed = await self.get_tool(tool.id)
        if refreshed is None:
            raise ValueError("工具源码保存后，工具已无法在注册表中找到。")
        return refreshed

    async def delete_tool(self, tool: ToolDefinition) -> None:
        result = await self.session.execute(
            select(ToolDefinition)
            .options(selectinload(ToolDefinition.subagents))
            .where(ToolDefinition.id == tool.id)
        )
        tool_with_links = result.scalar_one()
        tool_with_links.subagents.clear()
        await self.session.flush()
        await self.session.delete(tool_with_links)
        await self.session.commit()

    async def refresh_tools(self, reload_modules: bool = False) -> list[ToolDefinition]:
        scanned_tools = self._scan_tools(reload_modules=reload_modules)
        existing = {
            tool.name: tool
            for tool in (
                await self.session.execute(select(ToolDefinition))
            ).scalars()
        }

        for scanned in scanned_tools:
            tool = existing.get(scanned.name)
            if tool is None:
                tool = ToolDefinition(
                    namespace=scanned.namespace,
                    name=scanned.name,
                    python_import_path=scanned.python_import_path,
                    description=scanned.description,
                    args_schema=scanned.args_schema,
                    permission_level=scanned.permission_level,
                    requires_human_approval=scanned.requires_human_approval,
                )
                self.session.add(tool)
                continue

            tool.namespace = scanned.namespace
            tool.python_import_path = scanned.python_import_path
            tool.description = scanned.description
            tool.args_schema = scanned.args_schema
            if not tool.permission_level:
                tool.permission_level = scanned.permission_level
            tool.requires_human_approval = scanned.requires_human_approval

        await self.session.commit()
        return await self.list_tools()

    def _scan_tools(self, reload_modules: bool = False) -> list[ScannedTool]:
        discovered: list[ScannedTool] = []

        for package_name in settings.tool_scan_packages:
            package = importlib.import_module(package_name)
            if reload_modules:
                package = importlib.reload(package)
            modules = [package]
            if hasattr(package, "__path__"):
                modules.extend(
                    importlib.reload(importlib.import_module(module_info.name))
                    if reload_modules
                    else importlib.import_module(module_info.name)
                    for module_info in pkgutil.walk_packages(
                        package.__path__,
                        package.__name__ + ".",
                    )
                )

            for module in modules:
                for attr_name, value in vars(module).items():
                    if not isinstance(value, BaseTool):
                        continue
                    namespace = getattr(value, "_tool_namespace", None)
                    if namespace is None:
                        continue
                    args_schema = {}
                    if value.args_schema is not None:
                        args_schema = value.args_schema.model_json_schema()
                    discovered.append(
                        ScannedTool(
                            namespace=namespace,
                            name=value.name,
                            python_import_path=getattr(
                                value,
                                "_tool_source_path",
                                f"{module.__name__}.{attr_name}",
                            ),
                            description=value.description,
                            args_schema=args_schema,
                            permission_level=getattr(value, "_tool_permission_level", "safe"),
                            requires_human_approval=getattr(
                                value,
                                "_tool_requires_human_approval",
                                False,
                            ),
                        )
                    )
        deduped = {tool.name: tool for tool in discovered}
        return sorted(deduped.values(), key=lambda item: (item.namespace, item.name))

    @staticmethod
    def _resolve_tool_source_location(python_import_path: str) -> dict[str, object]:
        module_path, function_name = python_import_path.rsplit(".", 1)
        module = importlib.import_module(module_path)
        module_file = inspect.getsourcefile(module)
        if not module_file:
            raise ValueError(f"无法定位工具源码文件：{python_import_path}")

        file_path = Path(module_file)
        source = file_path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(file_path))
        lines = source.splitlines()
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name:
                start_line = min(
                    [node.lineno, *[decorator.lineno for decorator in node.decorator_list]]
                )
                end_line = node.end_lineno
                if end_line is None:
                    raise ValueError(f"无法确定工具函数结束位置：{python_import_path}")
                return {
                    "file_path": str(file_path),
                    "function_name": function_name,
                    "start_line": start_line,
                    "end_line": end_line,
                    "source_code": "\n".join(lines[start_line - 1 : end_line]),
                }
        raise ValueError(f"无法在源码文件中找到工具函数：{python_import_path}")
