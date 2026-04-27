import uuid

from sqlalchemy import JSON, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class UIComponentState(TimestampMixin, Base):
    __tablename__ = "ui_component_states"
    __table_args__ = (
        UniqueConstraint("user_id", "page_key", "component_key", name="uq_ui_component_state_scope"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    page_key: Mapped[str] = mapped_column(String(128), nullable=False)
    component_key: Mapped[str] = mapped_column(String(128), nullable=False)
    state: Mapped[dict] = mapped_column(JSON, nullable=False)

