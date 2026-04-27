import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


class ToolRead(ORMModel):
    id: uuid.UUID
    namespace: str
    name: str
    python_import_path: str
    description: str
    args_schema: dict
    permission_level: str
    requires_human_approval: bool
    enabled: bool
    created_at: datetime
    updated_at: datetime


class ToolUpdate(BaseModel):
    permission_level: str | None = None
    requires_human_approval: bool | None = None
    enabled: bool | None = None

    @field_validator("permission_level")
    @classmethod
    def validate_permission_level(cls, value: str | None) -> str | None:
        if value is None:
            return value
        allowed = {"safe", "sensitive", "dangerous"}
        if value not in allowed:
            raise ValueError(f"permission_level must be one of {sorted(allowed)}")
        return value


class ToolSourceRead(BaseModel):
    tool_id: uuid.UUID
    python_import_path: str
    source_code: str


class ToolSourceUpdate(BaseModel):
    source_code: str = Field(min_length=1)
