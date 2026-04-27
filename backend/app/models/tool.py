import uuid

from sqlalchemy import JSON, Boolean, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.associations import subagent_tools
from app.models.mixins import TimestampMixin


class ToolDefinition(TimestampMixin, Base):
    __tablename__ = "tools"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    namespace: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    python_import_path: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    args_schema: Mapped[dict] = mapped_column(JSON, nullable=False)
    permission_level: Mapped[str] = mapped_column(String(16), nullable=False)
    requires_human_approval: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    subagents = relationship(
        "SubagentTemplate",
        secondary=subagent_tools,
        back_populates="tools",
    )

