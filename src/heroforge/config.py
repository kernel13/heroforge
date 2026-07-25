"""Runtime settings. Everything comes from the environment; see ``.env.example``."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://heroforge:heroforge@localhost:5432/heroforge"

    secret: str = Field(default="change-me-in-production", min_length=8)
    """Signs session cookies and the verification / reset tokens."""

    cookie_name: str = "heroforge_session"
    cookie_secure: bool = True
    cookie_max_age: int = 60 * 60 * 24 * 14

    verification_required: bool = True
    """Email verification before first login. Off only for local development."""

    cors_origins: list[str] = Field(default_factory=lambda: ["https://localhost"])

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@heroforge.local"
    public_base_url: str = "https://localhost"

    derive_rate_limit: str = "600/minute"
    """Generous enough never to interfere with typing, low enough not to be free compute."""

    auth_rate_limit: str = "10/minute"

    @property
    def sync_database_url(self) -> str:
        """Alembic drives migrations synchronously."""
        return self.database_url.replace("+asyncpg", "+psycopg")


@lru_cache
def get_settings() -> Settings:
    return Settings()
