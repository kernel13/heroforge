"""Skill totals and rank maxima.

Two conventions live here and neither may be left implicit:

* A **half rank contributes nothing** to a check. ``ranks`` is stored as the displayed
  half-integer, ``effective_ranks`` floors it, and only the floored value reaches ``skill_total``.
* ``max_ranks`` is compared against the **unfloored** stored value, and the cross-class maximum is
  itself a half-integer.
"""

from __future__ import annotations

import math
from decimal import Decimal


def effective_ranks(ranks: Decimal) -> int:
    """The part of a rank total that actually improves the check.

    SRD, *Skills*: a fraction of a rank grants no benefit until it accumulates into a full rank.
    A character with 3.5 cross-class ranks adds 3.
    """
    return math.floor(ranks)


def max_ranks(character_level: int, *, is_class_skill: bool) -> Decimal:
    """``level + 3`` for a class skill, half that for a cross-class skill.

    Deliberately **not** floored: at level 8 the cross-class cap is 5.5 ranks, and a character
    holding 5.5 ranks is legal. Flooring here would report a false violation.
    """
    class_maximum = Decimal(character_level + 3)
    if is_class_skill:
        return class_maximum
    return class_maximum / 2


def skill_total(
    *,
    ranks: Decimal,
    ability_modifier: int,
    misc_modifier: int,
    armor_check_penalty: int = 0,
    applies_armor_check_penalty: bool = False,
    doubles_armor_check_penalty: bool = False,
) -> int:
    """Floored ranks + ability modifier + misc, plus any armour check penalty.

    The penalty is stored non-positive, so it is **added**. Swim adds it twice.
    """
    total = effective_ranks(ranks) + ability_modifier + misc_modifier
    if applies_armor_check_penalty:
        total += armor_check_penalty
        if doubles_armor_check_penalty:
            total += armor_check_penalty
    return total
