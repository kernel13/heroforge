"""RFC 7807 ``application/problem+json``, from a global exception handler.

Every error the API emits — validation, ownership, version conflict, or anything unhandled —
leaves through here in the same shape.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

CONTENT_TYPE = "application/problem+json"

UNPROCESSABLE = 422
"""Starlette renamed its constant for this code; the number is the stable spelling."""

_TITLES = {
    status.HTTP_400_BAD_REQUEST: "Bad request",
    status.HTTP_401_UNAUTHORIZED: "Not authenticated",
    status.HTTP_403_FORBIDDEN: "Forbidden",
    status.HTTP_404_NOT_FOUND: "Not found",
    status.HTTP_409_CONFLICT: "Conflict",
    UNPROCESSABLE: "Validation failed",
    status.HTTP_429_TOO_MANY_REQUESTS: "Too many requests",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "Internal server error",
}


def problem(
    status_code: int,
    detail: str | None = None,
    *,
    type_: str = "about:blank",
    instance: str | None = None,
    **extra: Any,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": type_,
        "title": _TITLES.get(status_code, "Error"),
        "status": status_code,
    }
    if detail is not None:
        body["detail"] = detail
    if instance is not None:
        body["instance"] = instance
    body.update(extra)
    return JSONResponse(body, status_code=status_code, media_type=CONTENT_TYPE)


class VersionConflictError(Exception):
    """A PATCH arrived carrying a version the client read before someone else's write."""

    def __init__(self, expected: int, actual: int) -> None:
        self.expected = expected
        self.actual = actual
        super().__init__(f"expected version {expected}, stored version is {actual}")


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else None
        response = problem(exc.status_code, detail, instance=str(request.url.path))
        for header, value in (exc.headers or {}).items():
            response.headers[header] = value
        return response

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return problem(
            UNPROCESSABLE,
            "The request body did not validate.",
            instance=str(request.url.path),
            errors=[
                {"loc": [str(part) for part in error["loc"]], "msg": error["msg"]}
                for error in exc.errors()
            ],
        )

    @app.exception_handler(VersionConflictError)
    async def _conflict(request: Request, exc: VersionConflictError) -> JSONResponse:
        return problem(
            status.HTTP_409_CONFLICT,
            (
                "This character was changed elsewhere since you loaded it. "
                "Reload to see the current version before saving again."
            ),
            instance=str(request.url.path),
            expected_version=exc.expected,
            current_version=exc.actual,
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error on %s", request.url.path)
        return problem(status.HTTP_500_INTERNAL_SERVER_ERROR, instance=str(request.url.path))
