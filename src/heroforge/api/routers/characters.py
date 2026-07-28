"""Character CRUD, scoped to the owning user."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from heroforge_rules import derive
from sqlalchemy.ext.asyncio import AsyncSession

from heroforge.api.auth import current_active_user
from heroforge.api.problems import VersionConflictError
from heroforge.api.schemas import (
    CharacterCreate,
    CharacterPatch,
    CharacterPortraitRead,
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

PORTRAIT_MEDIA_TYPES = frozenset({"image/png", "image/jpeg", "image/webp", "image/gif"})
"""What the browser can both produce from a canvas and display. Not SVG: an SVG portrait is a
document that can carry script, and it would be served from this origin."""

PORTRAIT_MAX_BYTES = 2 * 1024 * 1024
"""The client downscales to a few tens of kilobytes before uploading. This is the ceiling for a
request that did not, and is generous enough that a hand-made ``curl`` still works."""

TOO_LARGE = "That image is too large. The limit is 2 MB."


def _with_derived(character: Character) -> CharacterWithDerived:
    read = CharacterRead.model_validate(character)
    return CharacterWithDerived(
        character=read,
        derived=derive(to_engine_input(read), cache.definitions),
        # A plain column, unlike the deferred `portrait_data`, so naming it here costs no query.
        portrait_updated_at=character.portrait_updated_at,
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


async def _read_portrait_body(request: Request) -> bytes:
    """The raw request body, refused past ``PORTRAIT_MAX_BYTES``.

    Read as a stream rather than through ``await request.body()``: a chunked upload carries no
    ``Content-Length`` to check in advance, and the point of a ceiling is not to hold the thing it
    is refusing in memory first. The declared length is still checked, so an oversized upload is
    refused before its bytes are on the wire rather than after.
    """
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > PORTRAIT_MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, TOO_LARGE)

    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > PORTRAIT_MAX_BYTES:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, TOO_LARGE)
        chunks.append(chunk)
    return b"".join(chunks)


@router.get(
    "/{character_id}/portrait",
    response_class=Response,
    responses={
        status.HTTP_200_OK: {
            "description": "The portrait, in the media type it was uploaded as.",
            "content": {media_type: {} for media_type in sorted(PORTRAIT_MEDIA_TYPES)},
        },
        status.HTTP_404_NOT_FOUND: {"description": NOT_FOUND},
    },
)
async def read_portrait(
    character_id: uuid.UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """A character with no portrait is a 404, exactly as another user's character is.

    The list card only asks for this URL when the summary said there was something at it, so the
    404 is the unusual path and not a routine miss. It is cached for a day and hard to serve
    stale: the card hangs ``portrait_updated_at`` on the URL, so a replacement is a different URL.
    ``private``, because it is one user's image and there is a shared proxy in front of this.
    """
    portrait = await repositories.get_character_portrait(session, user.id, character_id)
    if portrait is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    data, media_type = portrait
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.put("/{character_id}/portrait", response_model=CharacterPortraitRead)
async def replace_portrait(
    character_id: uuid.UUID,
    request: Request,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
) -> CharacterPortraitRead:
    """The image as the raw request body, its type named by ``Content-Type``.

    Deliberately not multipart: the request carries one file and no fields, so a part boundary
    would be ceremony around a body that is already exactly the bytes to store — and it would make
    ``python-multipart``, presently a transitive dependency of ``fastapi-users``, a direct one.

    ``version`` is untouched on purpose. The portrait is uploaded from the character list and is
    not part of the document the sheet's optimistic concurrency guards; bumping it here would 409
    a sheet the same user has open in another tab on its next autosave.
    """
    media_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if media_type not in PORTRAIT_MEDIA_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"A portrait must be one of {', '.join(sorted(PORTRAIT_MEDIA_TYPES))}.",
        )

    data = await _read_portrait_body(request)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The request body was empty.")

    character = await repositories.get_character_row(session, user.id, character_id)
    if character is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)

    character.portrait_data = data
    character.portrait_media_type = media_type
    character.portrait_updated_at = datetime.now(UTC)
    await session.commit()

    return CharacterPortraitRead(portrait_updated_at=character.portrait_updated_at)


@router.delete("/{character_id}/portrait", response_model=CharacterPortraitRead)
async def delete_portrait(
    character_id: uuid.UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
) -> CharacterPortraitRead:
    """Removing a portrait a character does not have succeeds — the state asked for is the state
    that results, and a card whose remove control raced a reload should not report a failure."""
    character = await repositories.get_character_row(session, user.id, character_id)
    if character is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)

    character.portrait_data = None
    character.portrait_media_type = None
    character.portrait_updated_at = None
    await session.commit()

    return CharacterPortraitRead(portrait_updated_at=None)


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
