"""skill ranks integer

``character_skills.ranks`` becomes a whole number. Nothing in this application produces a fraction
of a rank: the cross-class maximum is not halved here and the two-skill-points-per-rank cost is not
modelled, so the half-integer column only ever held a value the engine floored away before adding
it to a check.

**The conversion floors — it does not round.** PostgreSQL's numeric-to-integer assignment cast
rounds, so a stored ``3.5`` would become ``4`` and every affected skill total would silently gain
+1 over what the sheet showed yesterday. ``floor(ranks)`` is what the engine did to that same value,
so flooring is what keeps the totals identical across the migration.

Revision ID: b7e42f19c3a8
Revises: 8c31a4d5e7b2
Create Date: 2026-07-26 14:22:41.005912
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7e42f19c3a8"
down_revision: str | None = "8c31a4d5e7b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "character_skills",
        "ranks",
        existing_type=sa.Numeric(precision=4, scale=1),
        type_=sa.Integer(),
        existing_nullable=False,
        existing_server_default=None,
        postgresql_using="floor(ranks)::integer",
    )


def downgrade() -> None:
    # Widening back is lossless in itself; the fraction discarded by the upgrade does not return.
    op.alter_column(
        "character_skills",
        "ranks",
        existing_type=sa.Integer(),
        type_=sa.Numeric(precision=4, scale=1),
        existing_nullable=False,
        existing_server_default=None,
    )
