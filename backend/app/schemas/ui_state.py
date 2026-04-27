import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class UIStateUpsert(BaseModel):
    user_id: str = Field(min_length=1)
    page_key: str = Field(min_length=1)
    component_key: str = Field(min_length=1)
    state: dict


class UIStateRead(ORMModel):
    id: uuid.UUID
    user_id: str
    page_key: str
    component_key: str
    state: dict
    created_at: datetime
    updated_at: datetime

