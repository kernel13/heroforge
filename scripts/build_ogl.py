"""Turn the published Open Game License 1.0a page into the plain-text file the application ships.

Section 10 of the licence requires shipping its full text with any Open Game Content, and section
15 requires adding the copyright notice of every contributor whose content is used. The licence
body is taken verbatim from the source page rather than retyped; only the section-15 declaration
below is this project's own writing.

Called by ``scripts/fetch-ogl.sh``. Run that, not this.
"""

from __future__ import annotations

import html
import re
import sys
from pathlib import Path

SECTION_COUNT = 15

DECLARATION = """

--------------------------------------------------------------------------------
SECTION 15 DECLARATION FOR THIS APPLICATION
--------------------------------------------------------------------------------

System Reference Document. Copyright 2000-2003, Wizards of the Coast, Inc.;
Authors Jonathan Tweet, Monte Cook, Skip Williams, Rich Baker, Andy Collins,
David Noonan, Rich Redman, Bruce R. Cordell, based on original material by
E. Gary Gygax and Dave Arneson.

This character sheet manager. Copyright 2026. The game mechanics it implements —
ability modifiers, armour class, saving throws, skill totals, the grapple
modifier, initiative, and the carrying-capacity table — are Open Game Content
drawn from the System Reference Document above.

Product Identity, used under no licence and deliberately absent from this
application: the "Dungeons & Dragons" name and logo, Wizards of the Coast trade
dress, and the visual design of the published character record sheet. The
sheet's structure — which fields exist and how they combine — is mechanical and
is Open Game Content; its typography and layout are not reproduced.
"""


def _clean(fragment: str) -> str:
    fragment = re.sub(r"(?i)<br\s*/?>", "\n", fragment)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    fragment = html.unescape(fragment)
    fragment = re.sub(r"[ \t]+", " ", fragment)
    return re.sub(r"\s*\n\s*", "\n", fragment).strip()


def build(source_html: str) -> str:
    """Extract the licence and restore its numbering.

    The source page marks the fifteen sections as list items and leaves them unclosed, so the
    numbers exist only as list markup. Stripping tags naively loses them, and a licence whose
    sections cannot be cited is not the licence.
    """
    body = source_html[source_html.find("OPEN GAME LICENSE") :]
    list_start = body.find("<ol")
    if list_start < 0:
        raise SystemExit("no ordered list found; the source page has changed shape")

    items = [_clean(part) for part in re.split(r"(?i)<li>", body[list_start:])[1:]]
    if len(items) != SECTION_COUNT:
        raise SystemExit(f"expected {SECTION_COUNT} numbered sections, found {len(items)}")

    preamble = [
        line
        for line in _clean(body[:list_start]).splitlines()
        if line and not line.startswith("OPEN GAME LICENSE")
    ]

    lines = ["OPEN GAME LICENSE Version 1.0a", "", *preamble, ""]
    for number, item in enumerate(items, start=1):
        lines.append(f"{number}. {item}")
        lines.append("")

    return "\n".join(lines).rstrip() + DECLARATION


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        raise SystemExit("usage: build_ogl.py <downloaded.html> <output.txt>")

    text = build(Path(argv[1]).read_text(encoding="utf-8", errors="replace"))

    if "COPYRIGHT NOTICE" not in text:
        raise SystemExit("section 15 is missing from the extracted licence")

    Path(argv[2]).write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
