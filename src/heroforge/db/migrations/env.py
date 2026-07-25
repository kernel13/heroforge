"""Alembic environment. Migrations run synchronously on api container start."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from heroforge.config import get_settings
from heroforge.db import models as _models  # noqa: F401 - registers every table
from heroforge.db.base import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().sync_database_url)
target_metadata = Base.metadata


# `fastapi-users` ships cross-dialect column types. Autogenerate names them
# `fastapi_users_db_sqlalchemy.generics.X` but never adds the import, so the migration fails at
# run time. The deployment target is PostgreSQL, so rendering the concrete type is both correct
# and one dependency fewer inside a migration.
_GENERIC_TYPES = {
    "GUID": "postgresql.UUID(as_uuid=True)",
    "TIMESTAMPAware": "sa.DateTime(timezone=True)",
}


def render_item(type_: str, obj: object, autogen_context: object) -> str | bool:
    if type_ != "type":
        return False
    rendered = _GENERIC_TYPES.get(type(obj).__name__)
    if rendered is None:
        return False
    if rendered.startswith("postgresql."):
        autogen_context.imports.add("from sqlalchemy.dialects import postgresql")  # type: ignore[attr-defined]
    return rendered


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_item=render_item,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
