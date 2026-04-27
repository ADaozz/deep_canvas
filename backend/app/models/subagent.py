import uuid

from sqlalchemy import Boolean, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.associations import subagent_tools, supervisor_subagents
from app.models.mixins import TimestampMixin


class SubagentTemplate(TimestampMixin, Base):
    __tablename__ = "subagents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    runtime: Mapped[dict] = mapped_column(JSON, nullable=False)
    skill_paths: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    middleware_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    interrupt_on: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    response_format: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    tools = relationship(
        "ToolDefinition",
        secondary=subagent_tools,
        back_populates="subagents",
        lazy="selectin",
    )
    supervisors = relationship(
        "SupervisorConfig",
        secondary=supervisor_subagents,
        back_populates="subagents",
    )
