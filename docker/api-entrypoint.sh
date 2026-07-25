#!/bin/sh
# Migrations run before the first request can arrive, not alongside it.
set -e
alembic upgrade head
exec uvicorn heroforge.api.app:app --host 0.0.0.0 --port 8000 --proxy-headers
