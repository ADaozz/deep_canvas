import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import AgentRuntimeConfig, BackendConfig, ORMModel


class SupervisorBase(BaseModel):
    name: str = Field(min_length=1)
    runtime: AgentRuntimeConfig
    subagent_ids: list[uuid.UUID] = Field(default_factory=list)
    global_tool_ids: list[uuid.UUID] = Field(default_factory=list)
    persistence_profile_id: uuid.UUID | None = None
    backend: BackendConfig | None = None
    memory: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    middleware_ids: list[uuid.UUID] = Field(default_factory=list)
    interrupt_on: dict | None = None
    enabled: bool = True


class SupervisorCreate(SupervisorBase):
    pass


class SupervisorUpdate(BaseModel):
    name: str | None = None
    runtime: AgentRuntimeConfig | None = None
    subagent_ids: list[uuid.UUID] | None = None
    global_tool_ids: list[uuid.UUID] | None = None
    persistence_profile_id: uuid.UUID | None = None
    backend: BackendConfig | None = None
    memory: list[str] | None = None
    skills: list[str] | None = None
    middleware_ids: list[uuid.UUID] | None = None
    interrupt_on: dict | None = None
    enabled: bool | None = None


class SupervisorRead(ORMModel):
    id: uuid.UUID
    name: str
    runtime: AgentRuntimeConfig
    subagent_ids: list[uuid.UUID]
    global_tool_ids: list[uuid.UUID]
    persistence_profile_id: uuid.UUID | None
    backend: BackendConfig | None
    memory: list[str]
    skills: list[str]
    middleware_ids: list[uuid.UUID]
    interrupt_on: dict | None
    enabled: bool
    created_at: datetime
    updated_at: datetime


class ValidationIssue(BaseModel):
    level: str
    code: str
    message: str
    target: str | None = None


class SupervisorValidationResult(BaseModel):
    valid: bool
    issues: list[ValidationIssue]


class SupervisorAutoGenerateRequest(BaseModel):
    query: str = Field(min_length=3)


class GeneratedConfig(BaseModel):
    config: dict
    python_code: str
    project_files: list[dict[str, str]] = Field(default_factory=list)
    workflow_validation: SupervisorValidationResult
    code_validation: SupervisorValidationResult
    archive_filename: str | None = None
    download_url: str | None = None
