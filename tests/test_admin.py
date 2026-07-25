"""The reference-data admin.

Every other test builds the application with the admin left off, so this is the only place its
authentication is exercised — and it is the one surface where getting authentication wrong hands
a stranger the reference tables.

It also covers the rule that a write through `sqladmin` invalidates the startup skills cache.
Without that, `/api/derive` keeps answering from the pre-edit list for the life of the process.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from heroforge.api.skills_cache import cache
from heroforge.db.models import Skill, User
from tests.conftest import PASSWORD, sign_up

Mailbox = list[tuple[str, str, str]]

ADMIN_URL = "/api/admin/skill/list"


@pytest.fixture
async def admin_app(session_factory: object) -> AsyncIterator[FastAPI]:
    """The application as deployed — with the admin mounted."""
    from asgi_lifespan import LifespanManager

    from heroforge.api.app import create_app
    from heroforge.rate_limit import reset_rate_limits

    reset_rate_limits()
    cache.invalidate()
    app = create_app(mount_reference_admin=True)
    async with LifespanManager(app):
        yield app


@pytest.fixture
async def admin_client(admin_app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=admin_app),
        base_url="http://testserver",
        follow_redirects=False,
    ) as client:
        yield client


async def promote(session: object, email: str) -> None:
    """Make an existing account a superuser, as an operator would."""
    from sqlalchemy.ext.asyncio import AsyncSession

    assert isinstance(session, AsyncSession)
    user = (await session.scalars(select(User).where(User.email == email))).one()
    user.is_superuser = True
    await session.commit()


def rejected(status_code: int) -> bool:
    """sqladmin turns a refused authentication into a redirect to its login page."""
    return status_code in {302, 303, 307, 401, 403}


class TestAuthentication:
    async def test_an_anonymous_visitor_is_refused(self, admin_client: AsyncClient) -> None:
        """The regression that prompted this file.

        The check used to call the route dependency by hand. Nothing resolves ``Depends`` outside
        a request, so the ``user`` parameter was bound to the request object itself — which meant
        the guard let everyone through whenever email verification was not being enforced.
        """
        assert rejected((await admin_client.get(ADMIN_URL)).status_code)

    async def test_an_anonymous_visitor_is_refused_with_verification_turned_off(
        self, admin_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The dangerous half of the same regression, and the reason this case is separate.

        The old guard short-circuited before it touched the (non-existent) ``is_verified``
        attribute whenever verification was not enforced, raised nothing, and returned a truthy
        request object — so it admitted anonymous visitors. Local development and the end-to-end
        run both set this flag, so the open configuration is a real one.
        """
        from heroforge.config import get_settings

        monkeypatch.setattr(get_settings(), "verification_required", False)
        assert rejected((await admin_client.get(ADMIN_URL)).status_code)

    async def test_a_garbage_cookie_is_refused(self, admin_client: AsyncClient) -> None:
        admin_client.cookies.set("heroforge_session", "not-a-real-token")
        assert rejected((await admin_client.get(ADMIN_URL)).status_code)

    async def test_an_ordinary_signed_in_user_is_refused(
        self, admin_client: AsyncClient, mailbox: Mailbox
    ) -> None:
        await sign_up(admin_client, mailbox, "ordinary@example.com")
        assert rejected((await admin_client.get(ADMIN_URL)).status_code)

    async def test_a_superuser_is_admitted(
        self, admin_client: AsyncClient, mailbox: Mailbox, session: object
    ) -> None:
        email = "keeper@example.com"
        await sign_up(admin_client, mailbox, email)
        await promote(session, email)

        # Sign in again so the session is read after the promotion.
        await admin_client.post("/api/auth/login", data={"username": email, "password": PASSWORD})

        response = await admin_client.get(ADMIN_URL)
        assert response.status_code == 200, response.text

    async def test_the_admin_has_no_login_page_of_its_own(self, admin_client: AsyncClient) -> None:
        """A superuser signs in through the application; a second password form is a second
        thing to get wrong."""
        response = await admin_client.post(
            "/api/admin/login", data={"username": "someone@example.com", "password": PASSWORD}
        )
        assert response.status_code != 200 or rejected(response.status_code)


class TestCacheInvalidation:
    async def test_editing_a_skill_invalidates_the_startup_cache(
        self, admin_client: AsyncClient, mailbox: Mailbox, session: object
    ) -> None:
        """`/api/derive` reads skills from a cache filled once at startup. Without invalidation
        it would answer from the pre-edit list for the life of the process."""
        from sqlalchemy.ext.asyncio import AsyncSession

        assert isinstance(session, AsyncSession)

        email = "curator@example.com"
        await sign_up(admin_client, mailbox, email)
        await promote(session, email)
        await admin_client.post("/api/auth/login", data={"username": email, "password": PASSWORD})

        listed = await admin_client.get("/api/skills")
        before = {row["id"]: row["name"] for row in listed.json()}
        skill_id = next(id_ for id_, name in before.items() if name == "Appraise")

        assert cache.loaded, "the lifespan handler should have filled the cache"

        # Edit the row the way sqladmin does, then fire the hook it fires.
        skill = (await session.scalars(select(Skill).where(Skill.id == skill_id))).one()
        skill.name = "Appraise (revised)"
        await session.commit()

        from heroforge.api.admin import SkillAdmin

        await SkillAdmin.after_model_change(
            SkillAdmin(),
            {},
            skill,
            is_created=False,
            request=None,  # type: ignore[arg-type]
        )
        assert not cache.loaded, "a write through the admin must invalidate the cache"

        after = (await admin_client.get("/api/skills")).json()
        assert {row["name"] for row in after} >= {"Appraise (revised)"}
