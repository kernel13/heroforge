"""The SRD skill list, served from the startup cache."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from heroforge.api.schemas import SkillDefinitionRead
from heroforge.api.skills_cache import cache
from heroforge.db.session import get_session

router = APIRouter(prefix="/api/skills", tags=["reference"])


@router.get("", response_model=list[SkillDefinitionRead])
async def list_skills(
    session: AsyncSession = Depends(get_session),
) -> list[SkillDefinitionRead]:
    await cache.ensure(session)
    return [SkillDefinitionRead.model_validate(row) for row in cache.rows]
