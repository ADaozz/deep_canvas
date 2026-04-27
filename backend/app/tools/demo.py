from app.tools.decorators import app_tool


@app_tool(namespace="search")
async def web_search(query: str) -> str:
    """Search the web for relevant information."""
    return f"stubbed search result for: {query}"


@app_tool(namespace="reporting")
async def format_markdown(title: str, body: str) -> str:
    """Format a report as markdown."""
    return f"# {title}\n\n{body}"

