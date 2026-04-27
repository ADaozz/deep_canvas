import uuid

from sqlalchemy import JSON, Boolean, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class PersistenceProfile(TimestampMixin, Base):
    __tablename__ = "persistence_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    backend_type: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    backend_import_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    backend_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    checkpointer_type: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    checkpointer_import_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    checkpointer_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    store_type: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    store_import_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    store_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
