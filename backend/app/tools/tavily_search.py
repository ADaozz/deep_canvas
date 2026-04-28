import json

from app.core.config import settings
from app.tools.decorators import app_tool


@app_tool(namespace="search")
async def tavily_web_search(
    query: str,
    search_depth: str = "advanced",
) -> str:
    """Search the web with Tavily and return the raw JSON response."""
    if not settings.tavily_api_key:
        raise RuntimeError("未配置 TAVILY_API_KEY，无法调用 Tavily 搜索。")

    try:
        from tavily import TavilyClient
    except ImportError as exc:
        raise RuntimeError(
            "未安装 tavily-python，请先执行 `pip install tavily-python`。"
        ) from exc

    client = TavilyClient(settings.tavily_api_key)
    response = client.search(
        query=query,
        search_depth=search_depth,
    )
    return json.dumps(response, ensure_ascii=False)
