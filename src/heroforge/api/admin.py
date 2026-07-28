"""Reference-data admin.

Superuser-only. It exists to curate the SRD reference tables — ``skills`` now, class and race
tables in phase 2 — without hand-building CRUD screens. Any write here invalidates the startup
skills cache, or ``/api/derive`` would keep answering from the pre-edit list.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from sqlalchemy.ext.asyncio import AsyncEngine

from heroforge.api.skills_cache import cache
from heroforge.config import get_settings
from heroforge.db.models import Skill, User


class SkillAdmin(ModelView, model=Skill):
    name = "Skill"
    name_plural = "Skills"
    column_list = [
        Skill.id,
        Skill.name,
        Skill.name_fr,
        Skill.key_ability,
        Skill.armor_check_penalty,
        Skill.acp_double,
        Skill.usable_untrained,
        Skill.takes_specialization,
        Skill.sheet_rows,
    ]
    column_sortable_list = [Skill.id, Skill.name]

    async def after_model_change(
        self, data: dict[str, Any], model: Any, is_created: bool, request: Request
    ) -> None:
        cache.invalidate()

    async def after_model_delete(self, model: Any, request: Request) -> None:
        cache.invalidate()


class UserAdmin(ModelView, model=User):
    name_plural = "Users"
    column_list = [User.id, User.email, User.is_active, User.is_verified, User.is_superuser]
    can_create = False
    can_edit = False
    column_details_exclude_list = [User.hashed_password]


class SuperuserOnly(AuthenticationBackend):
    """The admin is reachable only with a session cookie belonging to a superuser.

    The check is written out rather than delegated to the route dependencies: `sqladmin` mounts a
    sub-application and authenticates through this callback, where `Depends` does not resolve.
    Every condition is stated positively and the default is refusal.
    """

    async def authenticate(self, request: Request) -> bool:
        from heroforge.api.auth import is_verified_enough, user_from_request

        user = await user_from_request(request)
        if user is None:
            return False
        return bool(user.is_active) and bool(user.is_superuser) and is_verified_enough(user)

    async def login(self, request: Request) -> bool:
        """There is no separate admin login; a superuser signs in through the application."""
        return False

    async def logout(self, request: Request) -> bool:
        return True


def mount_admin(app: FastAPI, engine: AsyncEngine) -> Admin:
    admin = Admin(
        app,
        engine,
        base_url="/api/admin",
        title="HeroForge reference data",
        authentication_backend=SuperuserOnly(secret_key=get_settings().secret),
    )
    admin.add_view(SkillAdmin)
    admin.add_view(UserAdmin)
    return admin
