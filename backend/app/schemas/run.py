import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RunCreate(BaseModel):
    input_text: str = Field(min_length=1)


class RunResume(BaseModel):
    decisions: list[dict] = Field(min_length=1)


class RunEventRead(ORMModel):
    id: uuid.UUID
    run_id: uuid.UUID
    event_type: str
    source_type: str
    source_name: str | None
    payload: dict
    created_at: datetime
    updated_at: datetime


class RunRead(ORMModel):
    id: uuid.UUID
    supervisor_id: uuid.UUID
    input_text: str
    status: str
    output_text: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
