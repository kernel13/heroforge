#!/bin/sh
# Rebuild OGL.txt from the Open Gaming Foundation's published licence text.
#
# Section 10 of the licence requires that its full text ship with any Open Game Content, so
# OGL.txt must exist before a deployment image is built — docker/web.Dockerfile copies it into
# the served bundle and fails loudly if it is missing.
#
# The text is fetched rather than typed out so the wording is the publisher's, character for
# character. The Section 15 declaration appended at the end is this project's own.
set -e

TARGET="${1:-OGL.txt}"
SOURCE="https://www.opengamingfoundation.org/ogl.html"

if [ -f "$TARGET" ] && [ "${FORCE:-}" != "1" ]; then
  echo "$TARGET is already present. Re-run with FORCE=1 to rebuild it."
  exit 0
fi

curl -fsSL "$SOURCE" -o "$TARGET.html"
python3 scripts/build_ogl.py "$TARGET.html" "$TARGET"
rm -f "$TARGET.html"
echo "Wrote $TARGET"
