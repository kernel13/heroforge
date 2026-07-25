"""API test fixtures.

A real PostgreSQL 16 via testcontainers — the schema uses JSONB, a ``NUMERIC(4,1)`` column, and
several check constraints, none of which SQLite would enforce. The schema is built by running the
Alembic migrations, so the migrations are tested too.

Each test runs inside a transaction that is rolled back afterwards, so tests share one container
and one migrated schema without sharing data.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from typing import Any

import pytest

# Ryuk, testcontainers' reaper, bind-mounts the Docker socket. Docker Desktop on macOS refuses
# that mount, and the containers here are cleaned up by the context manager regardless.
os.environ.setdefault("TESTCONTAINERS_RYUK_DISABLED", "true")

from alembic import command
from alembic.config import Config
from asgi_lifespan import LifespanManager
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, async_sessionmaker
from testcontainers.community.postgres import PostgresContainer

from heroforge.rate_limit import reset_rate_limits

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="session")
def postgres() -> Iterator[PostgresContainer]:
    with PostgresContainer("postgres:16", driver="asyncpg") as container:
        yield container


@pytest.fixture(scope="session")
def configured(postgres: PostgresContainer) -> Iterator[Any]:
    """Point the settings at the container, then migrate it once."""
    url = postgres.get_connection_url()
    os.environ["DATABASE_URL"] = url
    os.environ["COOKIE_SECURE"] = "false"
    os.environ["SECRET"] = "test-secret-value"

    from heroforge.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()

    config = Config(os.path.join(PROJECT_ROOT, "alembic.ini"))
    config.set_main_option(
        "script_location", os.path.join(PROJECT_ROOT, "src", "heroforge", "db", "migrations")
    )
    config.set_main_option("sqlalchemy.url", settings.sync_database_url)
    command.upgrade(config, "head")

    return settings


@pytest.fixture(scope="session")
async def engine(configured: Any) -> AsyncIterator[Any]:
    from heroforge.db.session import get_engine

    engine = get_engine()
    yield engine
    await engine.dispose()


@pytest.fixture
async def connection(engine: Any) -> AsyncIterator[AsyncConnection]:
    """One outer transaction per test, rolled back at the end."""
    async with engine.connect() as connection:
        transaction = await connection.begin()
        yield connection
        await transaction.rollback()


@pytest.fixture
async def session_factory(connection: AsyncConnection) -> AsyncIterator[Any]:
    """Bind the application's session factory to the test's transaction.

    ``join_transaction_mode="create_savepoint"`` lets the application commit as it normally does
    while everything still unwinds when the outer transaction rolls back.
    """
    from heroforge.db.session import get_sessionmaker, set_sessionmaker

    original = get_sessionmaker()
    factory = async_sessionmaker(
        bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )
    set_sessionmaker(factory)
    yield factory
    set_sessionmaker(original)


@pytest.fixture
async def session(session_factory: Any) -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        yield session


@pytest.fixture
async def app(session_factory: Any) -> AsyncIterator[FastAPI]:
    from heroforge.api.app import create_app
    from heroforge.api.skills_cache import cache

    reset_rate_limits()
    cache.invalidate()
    application = create_app(mount_reference_admin=False)
    async with LifespanManager(application):
        yield application


@pytest.fixture
def mailbox(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, str]]:
    """Capture outbound mail so tests can read verification and reset tokens."""
    sent: list[tuple[str, str, str]] = []

    async def record_verification(to: str, token: str) -> None:
        sent.append(("verify", to, token))

    async def record_reset(to: str, token: str) -> None:
        sent.append(("reset", to, token))

    monkeypatch.setattr("heroforge.api.auth.send_verification_email", record_verification)
    monkeypatch.setattr("heroforge.api.auth.send_reset_password_email", record_reset)
    return sent


def token_for(mailbox: list[tuple[str, str, str]], kind: str, email: str) -> str:
    return next(token for k, to, token in reversed(mailbox) if k == kind and to == email)


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with _client(app) as client:
        yield client


@pytest.fixture
async def other_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """A second browser on the same application, with its own cookie jar."""
    async with _client(app) as client:
        yield client


def _client(app: FastAPI) -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver", follow_redirects=True
    )


PASSWORD = "correct-horse-battery-staple"


async def sign_up(
    client: AsyncClient, mailbox: list[tuple[str, str, str]], email: str
) -> AsyncClient:
    """Register, verify, and log in. The state every character test starts from."""
    registered = await client.post(
        "/api/auth/register", json={"email": email, "password": PASSWORD}
    )
    assert registered.status_code == 201, registered.text

    verified = await client.post(
        "/api/auth/verify", json={"token": token_for(mailbox, "verify", email)}
    )
    assert verified.status_code == 200, verified.text

    logged_in = await client.post("/api/auth/login", data={"username": email, "password": PASSWORD})
    assert logged_in.status_code == 204, logged_in.text
    return client
