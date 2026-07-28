"""Character persistence.

Two things are load-bearing here:

* **Every read eagerly loads the child collections.** Implicit lazy loading does not work under
  asyncio, and a missed ``selectinload`` surfaces as ``MissingGreenlet`` far from its cause.
* **Every query filters by ``owner_id``.** Another user's character is a 404, not a 403 — a 403
  would confirm the identifier exists.

Repositories never commit; the router commits at the edge.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from heroforge.db.models import (
    Character,
    CharacterArmor,
    CharacterAttack,
    CharacterClassLevel,
    CharacterSkill,
    Skill,
)

_CHILDREN = (
    selectinload(Character.class_levels),
    selectinload(Character.skills),
    selectinload(Character.armor),
    selectinload(Character.attacks),
)

ATTACK_BLOCKS = 2
"""Page 1 of the paper sheet prints five; a new character starts with two.

Paper has to print every block it will ever need, because a sheet cannot grow a sixth. This one
can: the sheet adds a block on request and removes one, so seeding five spent most of the panel
on empty frames for the many characters that swing one weapon and throw one dagger.
"""


async def list_characters(session: AsyncSession, owner_id: uuid.UUID) -> Sequence[Character]:
    statement = (
        select(Character)
        .where(Character.owner_id == owner_id)
        .options(selectinload(Character.class_levels))
        .order_by(Character.updated_at.desc())
    )
    return (await session.scalars(statement)).all()


async def get_character(
    session: AsyncSession, owner_id: uuid.UUID, character_id: uuid.UUID
) -> Character | None:
    statement = (
        select(Character)
        .where(Character.id == character_id, Character.owner_id == owner_id)
        .options(*_CHILDREN)
    )
    return (await session.scalars(statement)).unique().one_or_none()


async def get_character_row(
    session: AsyncSession, owner_id: uuid.UUID, character_id: uuid.UUID
) -> Character | None:
    """The character alone, with no child collections and no portrait bytes.

    The portrait routes read and write three columns and render nothing; loading forty skill rows
    to attach an image would be work with no reader. Nothing here may touch a relationship — that
    is the lazy load ``MissingGreenlet`` comes from.
    """
    statement = select(Character).where(
        Character.id == character_id, Character.owner_id == owner_id
    )
    return (await session.scalars(statement)).one_or_none()


async def get_character_portrait(
    session: AsyncSession, owner_id: uuid.UUID, character_id: uuid.UUID
) -> tuple[bytes, str] | None:
    """The portrait bytes and their media type, or ``None`` if there is no portrait to serve.

    ``portrait_data`` is deferred on the model, so this is the one query that asks for it. A
    character belonging to someone else and a character with no portrait are both ``None``: the
    caller answers 404 either way, which is the same reason the owner filter is here at all.
    """
    statement = select(Character.portrait_data, Character.portrait_media_type).where(
        Character.id == character_id, Character.owner_id == owner_id
    )
    row = (await session.execute(statement)).one_or_none()
    if row is None or row.portrait_data is None or row.portrait_media_type is None:
        return None
    return row.portrait_data, row.portrait_media_type


async def create_character(
    session: AsyncSession, owner_id: uuid.UUID, skills: Sequence[Skill], **fields: Any
) -> Character:
    """Create a character with its skill rows already in place.

    Row creation is **eager**: one zeroed row per SRD skill, repeated to match the paper sheet's
    printed count for Craft, Knowledge, Perform, and Profession. Creating them lazily on first
    edit would force both the list endpoint and the sheet component to reconcile stored rows
    against the reference list and synthesise the missing ones — in two places, forever.
    """
    character = Character(owner_id=owner_id, **fields)
    session.add(character)

    ordinal = 0
    for skill in sorted(skills, key=lambda row: row.name):
        for _ in range(max(skill.sheet_rows, 1)):
            character.skills.append(
                CharacterSkill(skill_id=skill.id, ordinal=ordinal, is_class_skill=False)
            )
            ordinal += 1

    for index in range(ATTACK_BLOCKS):
        character.attacks.append(CharacterAttack(ordinal=index))

    await session.flush()
    return character


async def delete_character(
    session: AsyncSession, owner_id: uuid.UUID, character_id: uuid.UUID
) -> bool:
    result = await session.execute(
        delete(Character).where(Character.id == character_id, Character.owner_id == owner_id)
    )
    return bool(result.rowcount)


async def replace_class_levels(
    session: AsyncSession, character: Character, rows: Sequence[Any]
) -> None:
    character.class_levels.clear()
    await session.flush()
    for index, row in enumerate(rows):
        character.class_levels.append(
            CharacterClassLevel(ordinal=index, class_name=row.class_name, level=row.level)
        )


async def replace_armor(session: AsyncSession, character: Character, rows: Sequence[Any]) -> None:
    character.armor.clear()
    await session.flush()
    for row in rows:
        character.armor.append(
            CharacterArmor(
                slot=row.slot.value,
                name=row.name,
                type=row.type,
                ac_bonus=row.ac_bonus,
                max_dex=row.max_dex,
                check_penalty=row.check_penalty,
                spell_failure=row.spell_failure,
                speed=row.speed,
                weight=row.weight,
                special_properties=row.special_properties,
            )
        )


async def replace_attacks(session: AsyncSession, character: Character, rows: Sequence[Any]) -> None:
    """Renumber from the order sent, as ``replace_class_levels`` does.

    ``ordinal`` was taken from the row when it had one, which was safe only while the row count
    was fixed. The sheet adds and removes blocks now, so a client that removes the middle of
    three rows and adds one sends two rows both claiming ordinal 2 — and ``Character.attacks``
    is ``order_by`` that column, so the pair would come back in either order and a player would
    find one attack's damage under another's name.
    """
    character.attacks.clear()
    await session.flush()
    for index, row in enumerate(rows):
        character.attacks.append(
            CharacterAttack(
                ordinal=index,
                name=row.name,
                attack_bonus=row.attack_bonus,
                damage=row.damage,
                critical=row.critical,
                range=row.range,
                damage_type=row.damage_type,
                notes=row.notes,
                ammunition=row.ammunition,
            )
        )


async def apply_skill_rows(
    session: AsyncSession, character: Character, rows: Sequence[Any]
) -> None:
    """Update the rows the client sent, add new custom rows, and drop rows it removed.

    Matched by row id, so the eagerly created SRD rows keep their identity across saves.
    """
    existing = {row.id: row for row in character.skills}
    seen: set[uuid.UUID] = set()

    for index, row in enumerate(rows):
        target = existing.get(row.id) if row.id is not None else None
        if target is None:
            target = CharacterSkill(skill_id=row.skill_id, custom_name=row.custom_name)
            character.skills.append(target)
        else:
            seen.add(target.id)
        target.ordinal = row.ordinal or index
        target.skill_id = row.skill_id
        target.custom_name = row.custom_name
        target.custom_key_ability = (
            row.custom_key_ability.value if row.custom_key_ability is not None else None
        )
        target.specialization = row.specialization
        target.ranks = row.ranks
        target.misc_modifier = row.misc_modifier
        target.is_class_skill = row.is_class_skill

    for identifier, row in existing.items():
        if identifier not in seen:
            character.skills.remove(row)

    await session.flush()
