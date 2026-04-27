from collections.abc import Callable
from typing import Any

from langchain_core.tools import tool


def app_tool(
    *,
    namespace: str,
    permission_level: str = "safe",
    requires_human_approval: bool = False,
    **tool_kwargs: Any,
) -> Callable:
    def decorator(fn: Callable) -> Any:
        wrapped = tool(**tool_kwargs)(fn)
        setattr(wrapped, "_tool_namespace", namespace)
        setattr(wrapped, "_tool_permission_level", permission_level)
        setattr(
            wrapped,
            "_tool_requires_human_approval",
            requires_human_approval,
        )
        setattr(wrapped, "_tool_source_path", f"{fn.__module__}.{fn.__name__}")
        return wrapped

    return decorator

