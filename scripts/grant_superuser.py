"""Grant or revoke superuser rights on an existing account.

The reference-data admin is superuser-only and nothing seeds a superuser: an application that
ships with a default administrator password is a liability. That leaves exactly one gap — the
first superuser — which this closes.

The account must already exist; sign up through the application first. Run inside the api
container, where DATABASE_URL is already set:

    docker compose exec api python scripts/grant_superuser.py you@example.com
    docker compose exec api python scripts/grant_superuser.py you@example.com --revoke

Granting also marks the account verified, since an operator promoting an account by hand has
established who it belongs to by other means.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import select

from heroforge.db.models import User
from heroforge.db.session import get_engine, get_sessionmaker


async def set_superuser(email: str, *, grant: bool) -> int:
    async with get_sessionmaker()() as session:
        user = (await session.scalars(select(User).where(User.email == email))).one_or_none()

        if user is None:
            print(f"No account for {email}. Sign up through the application first.")
            return 1

        user.is_superuser = grant
        if grant:
            user.is_verified = True
        await session.commit()

    await get_engine().dispose()

    verb = "is now a superuser" if grant else "is no longer a superuser"
    print(f"{email} {verb}.")
    if grant:
        print("Sign out and back in — the check reads the session, not the request.")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email", help="the address of an existing account")
    parser.add_argument(
        "--revoke", action="store_true", help="take the rights away instead of granting them"
    )
    arguments = parser.parse_args(argv[1:])

    return asyncio.run(set_superuser(arguments.email, grant=not arguments.revoke))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
