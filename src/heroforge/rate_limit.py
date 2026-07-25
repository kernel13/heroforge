"""Rate limiting.

The design document names `slowapi`. `slowapi` applies limits by decorating an endpoint function,
which cannot reach the register, login, verify, and password-reset endpoints — those are generated
by `fastapi-users` and we never see their function objects. Since the spec *requires* limits on
exactly those routes, the limits are applied as a FastAPI dependency instead, built on `limits`,
which is the library `slowapi` itself uses for windows and storage. Same engine, attachable
where it is needed.

Auth endpoints are keyed by client address; ``/api/derive`` is keyed by session, because one user
typing fast is not abuse but one user scripting the endpoint is.
"""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Request
from limits import RateLimitItem, parse
from limits.aio.storage import MemoryStorage
from limits.aio.strategies import MovingWindowRateLimiter

from heroforge.config import get_settings

KeyFunc = Callable[[Request], str]


class RateLimitExceededError(Exception):
    def __init__(self, limit: RateLimitItem) -> None:
        self.limit = limit
        super().__init__(str(limit))


def client_address(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return f"addr:{forwarded.split(',')[0].strip()}"
    return f"addr:{request.client.host if request.client else 'unknown'}"


def session_key(request: Request) -> str:
    """Prefer the session cookie; fall back to the address when there is not one yet."""
    cookie = request.cookies.get(get_settings().cookie_name)
    return f"session:{cookie}" if cookie else client_address(request)


_storage = MemoryStorage()
_strategy = MovingWindowRateLimiter(_storage)


def reset_rate_limits() -> None:
    """Drop every recorded window. Used between tests."""
    _storage.storage.clear()  # type: ignore[attr-defined]
    _storage.events.clear()  # type: ignore[attr-defined]


class RateLimit:
    """A FastAPI dependency that consumes one unit of a named limit."""

    def __init__(self, limit: str, *, key: KeyFunc = client_address, scope: str = "") -> None:
        self.item = parse(limit)
        self.key = key
        self.scope = scope

    async def __call__(self, request: Request) -> None:
        identity = self.key(request)
        namespace = self.scope or request.scope.get("path", "")
        if not await _strategy.hit(self.item, namespace, identity):
            raise RateLimitExceededError(self.item)


def auth_limit() -> RateLimit:
    return RateLimit(get_settings().auth_rate_limit)


def derive_limit() -> RateLimit:
    return RateLimit(get_settings().derive_rate_limit, key=session_key, scope="derive")
