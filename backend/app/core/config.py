from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APP_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    environment: str = "development"
    database_url: str | None = None
    tool_scan_packages: list[str] = Field(default_factory=lambda: ["app.tools"])
    deep_agent_pg_host: str | None = Field(
        default=None,
        validation_alias="DEEP_AGENT_PG_HOST",
    )
    deep_agent_pg_port: int | None = Field(
        default=None,
        validation_alias="DEEP_AGENT_PG_PORT",
    )
    deep_agent_pg_user: str | None = Field(
        default=None,
        validation_alias="DEEP_AGENT_PG_USER",
    )
    deep_agent_pg_password: str | None = Field(
        default=None,
        validation_alias="DEEP_AGENT_PG_PASSWORD",
    )
    deep_agent_pg_database: str | None = Field(
        default=None,
        validation_alias="DEEP_AGENT_PG_DATABASE",
    )
    dashscope_api_key: str | None = Field(
        default=None,
        validation_alias="DASHSCOPE_API_KEY",
    )
    dashscope_base_url: str | None = Field(
        default=None,
        validation_alias="DASHSCOPE_BASE_URL",
    )
    dashscope_model: str = Field(
        default="qwen3.5-plus",
        validation_alias="DASHSCOPE_MODEL",
    )

    @model_validator(mode="after")
    def assemble_database_url(self) -> "Settings":
        if self.database_url:
            return self

        pg_parts = (
            self.deep_agent_pg_host,
            self.deep_agent_pg_port,
            self.deep_agent_pg_user,
            self.deep_agent_pg_password,
            self.deep_agent_pg_database,
        )
        if all(part is not None for part in pg_parts):
            self.database_url = (
                "postgresql+asyncpg://"
                f"{self.deep_agent_pg_user}:{self.deep_agent_pg_password}"
                f"@{self.deep_agent_pg_host}:{self.deep_agent_pg_port}"
                f"/{self.deep_agent_pg_database}"
            )
        elif self.database_url is None:
            self.database_url = (
                "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
