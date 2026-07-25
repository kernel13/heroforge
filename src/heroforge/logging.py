"""Logging setup.

uvicorn configures its own loggers and leaves the root logger without a handler, so anything the
application logs is discarded by default. That matters here: with no SMTP host configured, the
verification and password-reset messages are *logged* rather than sent, and an operator who
cannot see them has no way to activate the first account.
"""

from __future__ import annotations

import logging
import sys

PACKAGE = "heroforge"


def configure_logging(level: int = logging.INFO) -> None:
    """Give the application's own logger a handler. Idempotent."""
    logger = logging.getLogger(PACKAGE)
    logger.setLevel(level)

    if any(isinstance(handler, logging.StreamHandler) for handler in logger.handlers):
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s - %(message)s"))
    logger.addHandler(handler)
    # uvicorn's access log is already on stdout; this would print each line a second time.
    logger.propagate = False
