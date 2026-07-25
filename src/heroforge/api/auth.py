"""Authentication, on top of `fastapi-users`.

Argon2id hashing, httpOnly + Secure + SameSite=Lax session cookies, and email verification
required before first login.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, schemas
from fastapi_users.authentication import AuthenticationBackend, CookieTransport
from fastapi_users.authentication.strategy.db import (
    AccessTokenDatabase,
    DatabaseStrategy,
)
from fastapi_users.password import PasswordHelper
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from fastapi_users_db_sqlalchemy.access_token import SQLAlchemyAccessTokenDatabase
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy.ext.asyncio import AsyncSession

from heroforge.config import get_settings
from heroforge.db.models import AccessToken, User
from heroforge.db.session import get_session, get_sessionmaker
from heroforge.mail import send_reset_password_email, send_verification_email


async def get_user_db(session: AsyncSession = Depends(get_session)) -> AsyncIterator[Any]:
    yield SQLAlchemyUserDatabase(session, User)


async def get_access_token_db(
    session: AsyncSession = Depends(get_session),
) -> AsyncIterator[Any]:
    yield SQLAlchemyAccessTokenDatabase(session, AccessToken)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = get_settings().secret
    verification_token_secret = get_settings().secret

    async def on_after_register(self, user: User, request: Request | None = None) -> None:
        """Registration is not enough: the user must verify before the first login."""
        await self.request_verify(user, request)

    async def on_after_forgot_password(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        await send_reset_password_email(user.email, token)

    async def on_after_request_verify(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        await send_verification_email(user.email, token)


def _password_helper() -> PasswordHelper:
    """Argon2id, and only Argon2id — no bcrypt fallback in the verification chain."""
    return PasswordHelper(PasswordHash((Argon2Hasher(),)))


async def get_user_manager(user_db: Any = Depends(get_user_db)) -> AsyncIterator[UserManager]:
    yield UserManager(user_db, _password_helper())


def _cookie_transport() -> CookieTransport:
    settings = get_settings()
    return CookieTransport(
        cookie_name=settings.cookie_name,
        cookie_max_age=settings.cookie_max_age,
        cookie_secure=settings.cookie_secure,
        cookie_httponly=True,
        cookie_samesite="lax",
    )


def get_database_strategy(
    access_token_db: AccessTokenDatabase[Any] = Depends(get_access_token_db),
) -> DatabaseStrategy[Any, Any, Any]:
    return DatabaseStrategy(access_token_db, lifetime_seconds=get_settings().cookie_max_age)


auth_backend = AuthenticationBackend(
    name="cookie",
    transport=_cookie_transport(),
    get_strategy=get_database_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

_authenticated = fastapi_users.current_user(active=True)
_authenticated_superuser = fastapi_users.current_user(active=True, superuser=True)


def is_verified_enough(user: User) -> bool:
    """Whether email verification lets this account be used.

    Read per request rather than bound at import time: a setting that lets someone log in and
    then refuses every request is not a setting, it is a broken account. The flag exists so local
    development and the end-to-end run need no mail server, and it defaults to on.
    """
    return user.is_verified or not get_settings().verification_required


def _require_verified(user: User) -> None:
    if not is_verified_enough(user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Confirm your email address before using your account.",
        )


async def current_active_user(user: User = Depends(_authenticated)) -> User:
    _require_verified(user)
    return user


async def current_superuser(user: User = Depends(_authenticated_superuser)) -> User:
    _require_verified(user)
    return user


async def user_from_request(request: Request) -> User | None:
    """Resolve a session cookie to its user, outside the dependency system.

    `sqladmin` mounts its own sub-application and authenticates through a callback rather than
    through `Depends`, so it cannot use the dependencies above. Calling one of them by hand does
    not work either — nothing resolves `Depends`, so the parameter would be bound to the request
    object itself. This does the lookup the dependency would have done.
    """
    token = request.cookies.get(get_settings().cookie_name)
    if not token:
        return None

    async with get_sessionmaker()() as session:
        strategy: DatabaseStrategy[Any, Any, Any] = DatabaseStrategy(
            SQLAlchemyAccessTokenDatabase(session, AccessToken),
            lifetime_seconds=get_settings().cookie_max_age,
        )
        manager = UserManager(SQLAlchemyUserDatabase(session, User), _password_helper())
        user: User | None = await strategy.read_token(token, manager)

    return user


class UserRead(schemas.BaseUser[uuid.UUID]):
    pass


class UserCreate(schemas.BaseUserCreate):
    pass


class UserUpdate(schemas.BaseUserUpdate):
    pass
