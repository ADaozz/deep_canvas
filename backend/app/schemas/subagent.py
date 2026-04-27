import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import AgentRuntimeConfig, ORMModel


class SubagentBase(BaseModel):
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    runtime: AgentRuntimeConfig
    tool_ids: list[uuid.UUID] = Field(default_factory=list)
    skill_paths: list[str] = Field(default_factory=list)
    middleware_ids: list[uuid.UUID] = Field(default_factory=list)
    interrupt_on: dict | None = None
    response_format: dict | None = None
    enabled: bool = True

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name cannot be empty")
        return stripped

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("description cannot be empty")
        return stripped


class SubagentCreate(SubagentBase):
    pass


class SubagentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    runtime: AgentRuntimeConfig | None = None
    tool_ids: list[uuid.UUID] | None = None
    skill_paths: list[str] | None = None
    middleware_ids: list[uuid.UUID] | None = None
    interrupt_on: dict | None = None
    response_format: dict | None = None
    enabled: bool | None = None


class SubagentRead(ORMModel):
    id: uuid.UUID
    name: str
    description: str
    runtime: AgentRuntimeConfig
    tool_ids: list[uuid.UUID]
    skill_paths: list[str]
    middleware_ids: list[uuid.UUID]
    interrupt_on: dict | None
    response_format: dict | None
    enabled: bool
    created_at: datetime
    updated_at: datetime
