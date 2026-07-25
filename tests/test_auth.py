"""Registration, verification, login, and password reset."""

from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import token_for

PASSWORD = "correct-horse-battery-staple"


async def register(client: AsyncClient, email: str) -> None:
    response = await client.post("/api/auth/register", json={"email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text


async def login(client: AsyncClient, email: str) -> int:
    response = await client.post("/api/auth/login", data={"username": email, "password": PASSWORD})
    return response.status_code


async def test_register_verify_login(
    client: AsyncClient, mailbox: list[tuple[str, str, str]]
) -> None:
    email = "gnome@example.com"
    await register(client, email)

    token = token_for(mailbox, "verify", email)
    verified = await client.post("/api/auth/verify", json={"token": token})
    assert verified.status_code == 200, verified.text

    assert await login(client, email) == 204
    me = await client.get("/api/users/me")
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["is_verified"] is True


async def test_an_unverified_user_cannot_log_in(
    client: AsyncClient, mailbox: list[tuple[str, str, str]]
) -> None:
    email = "unverified@example.com"
    await register(client, email)
    assert mailbox, "registration must send a verification mail"

    assert await login(client, email) == 400
    assert (await client.get("/api/users/me")).status_code == 401


async def test_a_wrong_password_is_rejected(
    client: AsyncClient, mailbox: list[tuple[str, str, str]]
) -> None:
    email = "typo@example.com"
    await register(client, email)
    await client.post("/api/auth/verify", json={"token": token_for(mailbox, "verify", email)})

    response = await client.post(
        "/api/auth/login", data={"username": email, "password": "not-the-password"}
    )
    assert response.status_code == 400


async def test_password_reset_round_trip(
    client: AsyncClient, mailbox: list[tuple[str, str, str]]
) -> None:
    email = "forgetful@example.com"
    await register(client, email)
    await client.post("/api/auth/verify", json={"token": token_for(mailbox, "verify", email)})

    forgot = await client.post("/api/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 202

    new_password = "a-different-long-password"
    reset = await client.post(
        "/api/auth/reset-password",
        json={"token": token_for(mailbox, "reset", email), "password": new_password},
    )
    assert reset.status_code == 200, reset.text

    stale = await client.post("/api/auth/login", data={"username": email, "password": PASSWORD})
    assert stale.status_code == 400

    fresh = await client.post("/api/auth/login", data={"username": email, "password": new_password})
    assert fresh.status_code == 204


async def test_forgot_password_does_not_reveal_whether_an_address_is_registered(
    client: AsyncClient, mailbox: list[tuple[str, str, str]]
) -> None:
    response = await client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert response.status_code == 202
    assert mailbox == []


async def test_the_session_cookie_is_http_only_and_same_site_lax(
    client: AsyncClient, mailbox: list[tuple[str, str, str]]
) -> None:
    email = "cookies@example.com"
    await register(client, email)
    await client.post("/api/auth/verify", json={"token": token_for(mailbox, "verify", email)})

    response = await client.post("/api/auth/login", data={"username": email, "password": PASSWORD})
    header = response.headers["set-cookie"].lower()
    assert "httponly" in header
    assert "samesite=lax" in header


async def test_logout_invalidates_the_session(
    client: AsyncClient, mailbox: list[tuple[str, str, str]]
) -> None:
    email = "leaving@example.com"
    await register(client, email)
    await client.post("/api/auth/verify", json={"token": token_for(mailbox, "verify", email)})
    await login(client, email)

    assert (await client.post("/api/auth/logout")).status_code == 204
    assert (await client.get("/api/users/me")).status_code == 401


async def test_repeated_login_attempts_are_rate_limited(client: AsyncClient) -> None:
    """The limit is per address and deliberately low; password spraying should not be cheap."""
    statuses = [
        (
            await client.post(
                "/api/auth/login", data={"username": "spray@example.com", "password": "guess"}
            )
        ).status_code
        for _ in range(12)
    ]
    assert 429 in statuses


async def test_errors_use_rfc_7807_problem_json(client: AsyncClient) -> None:
    response = await client.post("/api/auth/register", json={"email": "not-an-email"})
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["status"] == 422
    assert body["title"] == "Validation failed"
