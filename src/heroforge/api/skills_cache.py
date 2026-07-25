"""The startup skills cache.

The ``skills`` table is roughly forty immutable rows. Loading it once at startup is what allows
``POST /api/derive`` to touch no database at all on the per-keystroke path. Writes through
``sqladmin`` invalidate the cache.
"""

from __future__ import annotations

from heroforge_rules.models import Ability, SkillDefinition
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from heroforge.db.models import Skill


class SkillsCache:
    """Holds the reference list for the process lifetime, plus the row counts the sheet prints."""

    def __init__(self) -> None:
        self._definitions: list[SkillDefinition] = []
        self._rows: list[Skill] = []
        self._loaded = False

    async def load(self, session: AsyncSession) -> None:
        rows = list((await session.scalars(select(Skill).order_by(Skill.name))).all())
        self._rows = rows
        self._definitions = [
            SkillDefinition(
                id=row.id,
                name=row.name,
                key_ability=Ability(row.key_ability),
                armor_check_penalty=row.armor_check_penalty,
                acp_double=row.acp_double,
                usable_untrained=row.usable_untrained,
                takes_specialization=row.takes_specialization,
            )
            for row in rows
        ]
        self._loaded = True

    def invalidate(self) -> None:
        """Called after any write through ``sqladmin``; the next read reloads."""
        self._loaded = False

    @property
    def loaded(self) -> bool:
        return self._loaded

    async def ensure(self, session: AsyncSession) -> None:
        if not self._loaded:
            await self.load(session)

    @property
    def definitions(self) -> list[SkillDefinition]:
        return self._definitions

    @property
    def rows(self) -> list[Skill]:
        return self._rows


cache = SkillsCache()
