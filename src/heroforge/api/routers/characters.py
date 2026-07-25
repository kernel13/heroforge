"""Character CRUD, scoped to the owning user."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from heroforge_rules import derive
from sqlalchemy.ext.asyncio import AsyncSession

from heroforge.api.auth import current_active_user
from heroforge.api.problems import VersionConflictError
from heroforge.api.schemas import (
    CharacterCreate,
    CharacterPatch,
    CharacterRead,
    CharacterSummary,
    CharacterWithDerived,
    to_engine_input,
)
from heroforge.api.skills_cache import cache
from heroforge.db import repositories
from heroforge.db.models import Character, User
from heroforge.db.session import get_session

router = APIRouter(prefix="/api/characters", tags=["characters"])

CHILD_COLLECTIONS = frozenset({"class_levels", "skills", "armor", "attacks"})

NOT_FOUND = "No such character."
"""Deliberately the same message whether the character is missing or belongs to someone else."""


def _with_derived(character: Character) -> CharacterWithDerived:
    read = CharacterRead.model_validate(character)
    return CharacterWithDerived(
        character=read, derived=derive(to_engine_input(read), cache.definitions)
    )


@router.get("", response_model=list[CharacterSummary])
async def list_characters(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
) -> list[CharacterSummary]:
    rows = await repositories.list_characters(session, user.id)
    return [CharacterSummary.model_validate(row) for row in rows]


@router.post("", response_model=CharacterWithDerived, status_code=status.HTTP_201_CREATED)
async def create_character(
    body: CharacterCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
) -> CharacterWithDerived:
    await cache.ensure(session)
    character = await repositories.create_character(
        session, user.id, cache.rows, **body.model_dump()
    )
    await session.commit()

    stored = await repositories.get_character(session, user.id, character.id)
    assert stored is not None
    return _with_derived(stored)


@router.get("/{character_id}", response_model=CharacterWithDerived)
async def read_character(
    character_id: uuid.UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
) -> CharacterWithDerived:
    character = await repositories.get_character(session, user.id, character_id)
    if character is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    await cache.ensure(session)
    return _with_derived(character)


@router.patch("/{character_id}", response_model=CharacterWithDerived)
async def update_character(
    character_id: uuid.UUID,
    body: CharacterPatch,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
) -> CharacterWithDerived:
    character = await repositories.get_character(session, user.id, character_id)
    if character is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)

    if body.version != character.version:
        raise VersionConflictError(expected=body.version, actual=character.version)

    # mode="json" so the JSONB columns receive plain JSON types: a Decimal possession weight is
    # not serialisable, and stringifying it keeps the precision a float would lose.
    changes = body.model_dump(mode="json", exclude_unset=True, exclude={"version"})

    for field, value in changes.items():
        if field in CHILD_COLLECTIONS:
            # Normalised tables, replaced below from the validated models rather than these dicts.
            continue
        setattr(character, field, value)

    if "class_levels" in changes:
        await repositories.replace_class_levels(session, character, body.class_levels)
    if "armor" in changes:
        await repositories.replace_armor(session, character, body.armor)
    if "attacks" in changes:
        await repositories.replace_attacks(session, character, body.attacks)
    if "skills" in changes:
        await repositories.apply_skill_rows(session, character, body.skills)

    character.version += 1
    await session.commit()

    stored = await repositories.get_character(session, user.id, character_id)
    assert stored is not None
    await cache.ensure(session)
    return _with_derived(stored)


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(
    character_id: uuid.UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    deleted = await repositories.delete_character(session, user.id, character_id)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
