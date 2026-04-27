from sqlalchemy import Column, DateTime, ForeignKey, Table, func

from app.db.base import Base


subagent_tools = Table(
    "subagent_tools",
    Base.metadata,
    Column("subagent_id", ForeignKey("subagents.id", ondelete="CASCADE"), primary_key=True),
    Column("tool_id", ForeignKey("tools.id", ondelete="RESTRICT"), primary_key=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)


supervisor_subagents = Table(
    "supervisor_subagents",
    Base.metadata,
    Column(
        "supervisor_id",
        ForeignKey("supervisor_configs.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("subagent_id", ForeignKey("subagents.id", ondelete="RESTRICT"), primary_key=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)
