import uuid

from sqlalchemy import Boolean, ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.associations import supervisor_subagents
from app.models.mixins import TimestampMixin


class SupervisorConfig(TimestampMixin, Base):
    __tablename__ = "supervisor_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    runtime: Mapped[dict] = mapped_column(JSON, nullable=False)
    global_tool_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    persistence_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("persistence_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    backend: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    memory: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    skills: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    middleware_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    interrupt_on: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    subagents = relationship(
        "SubagentTemplate",
        secondary=supervisor_subagents,
        back_populates="supervisors",
        lazy="selectin",
    )
    persistence_profile = relationship("PersistenceProfile", lazy="selectin")
    runs = relationship("AgentRun", back_populates="supervisor", lazy="selectin")
