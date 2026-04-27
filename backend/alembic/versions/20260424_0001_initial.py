"""initial schema

Revision ID: 20260424_0001
Revises:
Create Date: 2026-04-24 17:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260424_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tools",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("namespace", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("python_import_path", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("args_schema", sa.JSON(), nullable=False),
        sa.Column("permission_level", sa.String(length=16), nullable=False),
        sa.Column("requires_human_approval", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_tools_namespace"), "tools", ["namespace"], unique=False)

    op.create_table(
        "subagents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("runtime", sa.JSON(), nullable=False),
        sa.Column("skill_paths", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("response_format", sa.JSON(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "supervisor_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("runtime", sa.JSON(), nullable=False),
        sa.Column("global_tool_ids", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("backend", sa.JSON(), nullable=True),
        sa.Column("memory", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("skills", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "ui_component_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("page_key", sa.String(length=128), nullable=False),
        sa.Column("component_key", sa.String(length=128), nullable=False),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "page_key", "component_key", name="uq_ui_component_state_scope"),
    )

    op.create_table(
        "subagent_tools",
        sa.Column("subagent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tool_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["subagent_id"], ["subagents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tool_id"], ["tools.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("subagent_id", "tool_id"),
    )

    op.create_table(
        "supervisor_subagents",
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subagent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["subagent_id"], ["subagents.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["supervisor_id"], ["supervisor_configs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("supervisor_id", "subagent_id"),
    )

    op.create_table(
        "agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("input_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("output_text", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["supervisor_id"], ["supervisor_configs.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_agent_runs_supervisor_id"), "agent_runs", ["supervisor_id"], unique=False)

    op.create_table(
        "agent_run_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_name", sa.String(length=128), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["agent_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_agent_run_events_run_id"), "agent_run_events", ["run_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_agent_run_events_run_id"), table_name="agent_run_events")
    op.drop_table("agent_run_events")
    op.drop_index(op.f("ix_agent_runs_supervisor_id"), table_name="agent_runs")
    op.drop_table("agent_runs")
    op.drop_table("supervisor_subagents")
    op.drop_table("subagent_tools")
    op.drop_table("ui_component_states")
    op.drop_table("supervisor_configs")
    op.drop_table("subagents")
    op.drop_index(op.f("ix_tools_namespace"), table_name="tools")
    op.drop_table("tools")
