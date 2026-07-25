"""The FastAPI application."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from heroforge.api import auth as auth_module
from heroforge.api.admin import mount_admin
from heroforge.api.problems import install_exception_handlers, problem
from heroforge.api.routers import characters, derive, skills
from heroforge.api.schemas import Problem
from heroforge.api.skills_cache import cache
from heroforge.config import get_settings
from heroforge.db.seed import seed_skills
from heroforge.db.session import get_engine, get_sessionmaker
from heroforge.rate_limit import RateLimitExceededError, auth_limit


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Seed reference data and fill the skills cache before the first request.

    Done here rather than at import time so the test suite can point the application at a
    different database without reloading modules.
    """
    async with get_sessionmaker()() as session:
        await seed_skills(session)
        await cache.load(session)
    yield


def create_app(*, mount_reference_admin: bool = True) -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="HeroForge",
        version="0.1.0",
        summary="A D&D 3.5 character sheet manager that derives the arithmetic.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_exception_handlers(app)

    @app.exception_handler(RateLimitExceededError)
    async def _rate_limited(request: Request, exc: RateLimitExceededError) -> JSONResponse:
        return problem(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Rate limit exceeded: {exc.limit}.",
            instance=str(request.url.path),
        )

    # Every error leaves through the RFC 7807 handler, so declare that shape once. It documents
    # the contract and puts `Problem` in the OpenAPI schema the frontend types are generated from.
    problems: dict[int | str, dict[str, Any]] = {
        "default": {"model": Problem, "description": "RFC 7807 problem document"}
    }

    _install_auth_routes(app)
    app.include_router(skills.router, responses=problems)
    app.include_router(derive.router, responses=problems)
    app.include_router(characters.router, responses=problems)

    @app.get("/api/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    if mount_reference_admin:
        mount_admin(app, get_engine())

    return app


def _install_auth_routes(app: FastAPI) -> None:
    """Register, verify, login, logout, forgot-password, reset-password.

    Every route that can be used to guess a password or spray an address list is rate-limited.
    """
    users = auth_module.fastapi_users
    limited = [Depends(auth_limit())]

    # Verification before first login is the deployed behaviour. The setting exists so local
    # development and the end-to-end run do not need a mail server; it defaults to on.
    requires_verification = get_settings().verification_required

    app.include_router(
        users.get_auth_router(
            auth_module.auth_backend, requires_verification=requires_verification
        ),
        prefix="/api/auth",
        tags=["auth"],
        dependencies=limited,
    )
    app.include_router(
        users.get_register_router(auth_module.UserRead, auth_module.UserCreate),
        prefix="/api/auth",
        tags=["auth"],
        dependencies=limited,
    )
    app.include_router(
        users.get_verify_router(auth_module.UserRead),
        prefix="/api/auth",
        tags=["auth"],
        dependencies=limited,
    )
    app.include_router(
        users.get_reset_password_router(),
        prefix="/api/auth",
        tags=["auth"],
        dependencies=limited,
    )
    app.include_router(
        users.get_users_router(auth_module.UserRead, auth_module.UserUpdate),
        prefix="/api/users",
        tags=["users"],
    )


app = create_app()
