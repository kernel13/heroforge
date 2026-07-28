"""``GET /api/skills`` — the reference list the sheet labels its rows from.

Skill names are **reference data, not interface copy**. They live in the ``skills`` table, they are
seeded from the versioned YAML, and they are curated through ``sqladmin`` — so a translation
belongs beside the row it names, and adding one takes a seed edit rather than a frontend release.
The client picks the column matching the language it is showing and falls back to ``name``.

That fallback is the reason ``name_fr`` is nullable, and it is what these tests are mostly about: a
skill nobody has translated yet must still reach a French sheet, under the name the rules engine
knows it by.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from heroforge.db.models import Skill
from heroforge.db.seed import load_skill_seed
from tests.conftest import sign_up

Mailbox = list[tuple[str, str, str]]


@pytest.fixture
async def reader(client: AsyncClient, mailbox: Mailbox) -> AsyncClient:
    return await sign_up(client, mailbox, "reader@example.com")


class TestFrenchNames:
    async def test_every_srd_skill_is_served_with_a_french_name(self, reader: AsyncClient) -> None:
        rows = (await reader.get("/api/skills")).json()
        assert rows, "the seed should have filled the table"

        untranslated = [row["name"] for row in rows if not row["name_fr"]]
        assert untranslated == []

    async def test_the_french_name_is_a_translation_and_not_a_copy(
        self, reader: AsyncClient
    ) -> None:
        """A row whose ``name_fr`` merely repeats ``name`` is an untranslated row wearing a
        translated column, and the fallback would have handled it more honestly."""
        rows = {row["name"]: row["name_fr"] for row in (await reader.get("/api/skills")).json()}

        # These four are the same word in both languages; everything else must differ.
        identical = {"Bluff", "Concentration", "Profession", "Survival"}
        copied = {name for name, french in rows.items() if french == name} - identical
        assert copied == set()

    async def test_a_name_the_engine_uses_is_never_replaced_by_its_translation(
        self, reader: AsyncClient
    ) -> None:
        """``name`` is the row's identity — what ``derive()`` is handed and what a client falls
        back to. Serving French *in place of* it would change what the engine reasons about."""
        rows = {row["id"]: row for row in (await reader.get("/api/skills")).json()}
        swim = rows[32]
        assert swim["name"] == "Swim"
        assert swim["name_fr"] == "Natation"


class TestSeeding:
    async def test_an_untranslated_row_seeds_as_null_rather_than_failing(
        self, session: AsyncSession
    ) -> None:
        """``name_fr`` is nullable and defaults to null, so a skill added to the YAML without a
        translation seeds cleanly. It then reaches a French sheet under its English name."""
        from heroforge.db.seed import _DEFAULTS

        assert _DEFAULTS["name_fr"] is None

        session.add(Skill(id=9001, name="Autohypnosis", key_ability="WIS"))
        await session.flush()
        stored = (await session.scalars(select(Skill).where(Skill.id == 9001))).one()
        assert stored.name_fr is None

    def test_the_seed_file_translates_every_row_it_lists(self) -> None:
        """Read straight off the YAML, so a row added without ``name_fr`` fails here — at the
        file that is meant to carry the translations — rather than silently on a French sheet."""
        rows = load_skill_seed()
        missing = [row["name"] for row in rows if not row["name_fr"]]
        assert missing == []
