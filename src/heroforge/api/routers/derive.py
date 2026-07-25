"""``POST /api/derive`` — the per-keystroke path.

Stateless and persists nothing. Skill definitions come from the startup cache, so this endpoint
performs no database access at all and answers in single-digit milliseconds.

It is compute on a publicly registrable application, so it requires a valid session and carries a
generous per-session rate limit: high enough never to interfere with typing, low enough not to
serve as free compute.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from heroforge_rules import derive as derive_sheet
from heroforge_rules.models import DerivedSheet

from heroforge.api.auth import current_active_user
from heroforge.api.schemas import CharacterBody, to_engine_input
from heroforge.api.skills_cache import cache
from heroforge.db.models import User
from heroforge.rate_limit import derive_limit

router = APIRouter(prefix="/api/derive", tags=["derive"])


@router.post("", response_model=DerivedSheet, dependencies=[Depends(derive_limit())])
async def derive_endpoint(
    body: CharacterBody,
    user: User = Depends(current_active_user),
) -> DerivedSheet:
    return derive_sheet(to_engine_input(body), cache.definitions)
