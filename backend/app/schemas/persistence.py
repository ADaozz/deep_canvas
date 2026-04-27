import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


class PersistenceProfileBase(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    backend_type: str = Field(default="none", min_length=1)
    backend_import_path: str | None = None
    backend_config: dict = Field(default_factory=dict)
    checkpointer_type: str = Field(default="none", min_length=1)
    checkpointer_import_path: str | None = None
    checkpointer_config: dict = Field(default_factory=dict)
    store_type: str = Field(default="none", min_length=1)
    store_import_path: str | None = None
    store_config: dict = Field(default_factory=dict)
    enabled: bool = True

    @field_validator(
        "name",
        "backend_type",
        "checkpointer_type",
        "store_type",
        mode="before",
    )
    @classmethod
    def strip_required(cls, value: str) -> str:
        stripped = str(value).strip()
        if not stripped:
            raise ValueError("field cannot be empty")
        return stripped

    @field_validator("description", "backend_import_path", "checkpointer_import_path", "store_import_path", mode="before")
    @classmethod
    def strip_optional(cls, value):
        if value is None:
            return value
        return str(value).strip()


class PersistenceProfileCreate(PersistenceProfileBase):
    pass


class PersistenceProfileUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    backend_type: str | None = None
    backend_import_path: str | None = None
    backend_config: dict | None = None
    checkpointer_type: str | None = None
    checkpointer_import_path: str | None = None
    checkpointer_config: dict | None = None
    store_type: str | None = None
    store_import_path: str | None = None
    store_config: dict | None = None
    enabled: bool | None = None


class PersistenceProfileRead(ORMModel):
    id: uuid.UUID
    name: str
    description: str
    backend_type: str
    backend_import_path: str | None
    backend_config: dict
    checkpointer_type: str
    checkpointer_import_path: str | None
    checkpointer_config: dict
    store_type: str
    store_import_path: str | None
    store_config: dict
    enabled: bool
    created_at: datetime
    updated_at: datetime
