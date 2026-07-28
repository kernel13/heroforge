# The API image. Alembic migrations run on container start, before uvicorn binds.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Dependencies first, so a source change does not reinstall the world.
COPY pyproject.toml uv.lock README.md ./
COPY packages/heroforge-rules/pyproject.toml packages/heroforge-rules/README.md ./packages/heroforge-rules/
RUN mkdir -p packages/heroforge-rules/src/heroforge_rules src/heroforge \
    && touch packages/heroforge-rules/src/heroforge_rules/__init__.py src/heroforge/__init__.py \
    && uv sync --frozen --no-dev

COPY packages/ ./packages/
COPY src/ ./src/
# Operational commands — granting the first superuser, refreshing the OpenAPI schema.
COPY scripts/ ./scripts/
COPY alembic.ini ./
RUN uv sync --frozen --no-dev

COPY docker/api-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
