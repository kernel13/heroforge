"""Outbound mail for verification and password reset.

With no SMTP host configured the messages are logged instead of sent, which is what local
development and the test suite want.
"""

from __future__ import annotations

import logging
from email.message import EmailMessage

import aiosmtplib

from heroforge.config import get_settings

logger = logging.getLogger(__name__)


async def _send(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        logger.info("mail not configured; would send to %s: %s\n%s", to, subject, body)
        return

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username or None,
        password=settings.smtp_password or None,
        start_tls=settings.smtp_port == 587,
    )


async def send_verification_email(to: str, token: str) -> None:
    base = get_settings().public_base_url
    await _send(
        to,
        "Verify your character sheet account",
        f"Confirm your address to finish signing up:\n\n{base}/verify?token={token}\n",
    )


async def send_reset_password_email(to: str, token: str) -> None:
    base = get_settings().public_base_url
    await _send(
        to,
        "Reset your password",
        f"Use this link to choose a new password:\n\n{base}/reset-password?token={token}\n",
    )
