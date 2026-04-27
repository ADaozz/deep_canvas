import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


class MiddlewareBase(BaseModel):
    name: str = Field(min_length=1)
    scope: str = Field(default="global", min_length=1)
    python_import_path: str = Field(min_length=1)
    description: str = Field(min_length=1)
    config: dict = Field(default_factory=dict)
    enabled: bool = True

    @field_validator("name", "scope", "python_import_path", "description")
    @classmethod
    def strip_required(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("field cannot be empty")
        return stripped


class MiddlewareCreate(MiddlewareBase):
    pass


class MiddlewareUpdate(BaseModel):
    name: str | None = None
    scope: str | None = None
    python_import_path: str | None = None
    description: str | None = None
    config: dict | None = None
    enabled: bool | None = None


class MiddlewareRead(ORMModel):
    id: uuid.UUID
    name: str
    scope: str
    python_import_path: str
    description: str
    config: dict
    enabled: bool
    created_at: datetime
    updated_at: datetime
