from langchain_openai import ChatOpenAI

from app.core.config import settings


def build_chat_model(*, model_name: str | None, temperature: float) -> ChatOpenAI:
    if not settings.dashscope_api_key:
        raise ValueError("DASHSCOPE_API_KEY is not configured")
    if not settings.dashscope_base_url:
        raise ValueError("DASHSCOPE_BASE_URL is not configured")

    return ChatOpenAI(
        model=model_name or settings.dashscope_model,
        temperature=temperature,
        api_key=settings.dashscope_api_key,
        base_url=settings.dashscope_base_url,
    )

