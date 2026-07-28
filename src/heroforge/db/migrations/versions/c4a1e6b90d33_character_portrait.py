"""character portrait

Three columns on ``characters`` for the list card's portrait: the bytes, the media type they were
uploaded as, and when. All nullable — a character has no portrait until someone uploads one, and
the default glyph is what the card draws until then.

``portrait_updated_at`` is not redundant with ``updated_at``. It is null where there is no
portrait, which is what tells the card to draw the glyph instead, and it changes only when the
image does — ``updated_at`` moves on every write to the row, so hanging it on the image URL would
re-fetch the picture each time the character's name was edited. The portrait still sits outside
the *versioned* document: ``version`` is untouched, so an upload cannot 409 a sheet open in
another tab.

Revision ID: c4a1e6b90d33
Revises: b7e42f19c3a8
Create Date: 2026-07-27 09:12:44.201883
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c4a1e6b90d33"
down_revision: str | None = "b7e42f19c3a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("characters", sa.Column("portrait_data", sa.LargeBinary(), nullable=True))
    op.add_column(
        "characters", sa.Column("portrait_media_type", sa.String(length=40), nullable=True)
    )
    op.add_column(
        "characters",
        sa.Column("portrait_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("characters", "portrait_updated_at")
    op.drop_column("characters", "portrait_media_type")
    op.drop_column("characters", "portrait_data")
