"""Seeding the reference tables from the versioned YAML file.

Reference data is read-only at runtime except through ``sqladmin``. Seeding is idempotent: it
upserts by primary key so a redeploy picks up corrections without duplicating rows.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from heroforge.db.models import Skill

SEEDS = Path(__file__).parent / "seeds"
SKILLS_YAML = SEEDS / "skills.yaml"

_DEFAULTS: dict[str, Any] = {
    # An untranslated skill is a skill the French sheet shows under its English name, not a
    # seeding error — so the default is null rather than a required key.
    "name_fr": None,
    "armor_check_penalty": False,
    "acp_double": False,
    "usable_untrained": True,
    "takes_specialization": False,
    "sheet_rows": 1,
}


def load_skill_seed(path: Path = SKILLS_YAML) -> list[dict[str, Any]]:
    """Read the YAML and fill in the defaults the file leaves out for brevity."""
    document = yaml.safe_load(path.read_text(encoding="utf-8"))
    return [_DEFAULTS | row for row in document["skills"]]


async def seed_skills(session: AsyncSession, path: Path = SKILLS_YAML) -> int:
    """Insert or update every skill. Returns the number of rows in the file."""
    rows = load_skill_seed(path)
    existing = {skill.id: skill for skill in (await session.scalars(select(Skill))).all()}

    for row in rows:
        skill = existing.get(row["id"])
        if skill is None:
            session.add(Skill(**row))
            continue
        for column, value in row.items():
            setattr(skill, column, value)

    await session.commit()
    return len(rows)
