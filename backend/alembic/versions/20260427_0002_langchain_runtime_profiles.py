"""langchain runtime profiles

Revision ID: 20260427_0002
Revises: 20260424_0001
Create Date: 2026-04-27 11:20:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260427_0002"
down_revision = "20260424_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "middleware_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("scope", sa.String(length=32), nullable=False, server_default="global"),
        sa.Column("python_import_path", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "persistence_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("backend_type", sa.String(length=32), nullable=False, server_default="none"),
        sa.Column("backend_import_path", sa.String(length=255), nullable=True),
        sa.Column("backend_config", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("checkpointer_type", sa.String(length=32), nullable=False, server_default="none"),
        sa.Column("checkpointer_import_path", sa.String(length=255), nullable=True),
        sa.Column("checkpointer_config", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("store_type", sa.String(length=32), nullable=False, server_default="none"),
        sa.Column("store_import_path", sa.String(length=255), nullable=True),
        sa.Column("store_config", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.add_column(
        "subagents",
        sa.Column("middleware_ids", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column("subagents", sa.Column("interrupt_on", sa.JSON(), nullable=True))

    op.add_column(
        "supervisor_configs",
        sa.Column("persistence_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "supervisor_configs",
        sa.Column("middleware_ids", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column("supervisor_configs", sa.Column("interrupt_on", sa.JSON(), nullable=True))
    op.create_foreign_key(
        "fk_supervisor_configs_persistence_profile_id",
        "supervisor_configs",
        "persistence_profiles",
        ["persistence_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_supervisor_configs_persistence_profile_id",
        "supervisor_configs",
        type_="foreignkey",
    )
    op.drop_column("supervisor_configs", "interrupt_on")
    op.drop_column("supervisor_configs", "middleware_ids")
    op.drop_column("supervisor_configs", "persistence_profile_id")
    op.drop_column("subagents", "interrupt_on")
    op.drop_column("subagents", "middleware_ids")
    op.drop_table("persistence_profiles")
    op.drop_table("middleware_definitions")
