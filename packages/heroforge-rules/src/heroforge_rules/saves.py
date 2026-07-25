"""Saving throws.

Fortitude keys off Constitution, Reflex off Dexterity, Will off Wisdom. The base save is typed by
the user in phase 1; deriving it needs class progression tables.
"""

from __future__ import annotations

from heroforge_rules.models import Ability

SAVE_ABILITIES: dict[str, Ability] = {
    "fortitude": Ability.CON,
    "reflex": Ability.DEX,
    "will": Ability.WIS,
}


def save_total(base: int, ability_modifier: int, magic: int, misc: int, temporary: int) -> int:
    return base + ability_modifier + magic + misc + temporary
