"""skill french name

Adds the French name of each SRD skill to the reference table. Nullable: a skill added through
``sqladmin`` before anyone has translated it must still appear on a French sheet, under its
English name. The seed file fills the column for every SRD row on the next start.

Revision ID: 8c31a4d5e7b2
Revises: 10fd970bc61d
Create Date: 2026-07-26 10:14:02.118433
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8c31a4d5e7b2"
down_revision: str | None = "10fd970bc61d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("skills", sa.Column("name_fr", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("skills", "name_fr")
