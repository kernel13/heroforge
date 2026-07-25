"""Write the OpenAPI schema to a file.

The schema is a build input for the frontend, not documentation: ``openapi-typescript`` turns it
into the types the React application is compiled against, and CI fails if the committed output is
stale. Building the app object is enough — no database and no running server.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from heroforge.api.app import create_app

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "openapi.json"


def main(argv: list[str]) -> int:
    output = Path(argv[1]) if len(argv) > 1 else DEFAULT_OUTPUT
    schema = create_app(mount_reference_admin=False).openapi()
    output.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
