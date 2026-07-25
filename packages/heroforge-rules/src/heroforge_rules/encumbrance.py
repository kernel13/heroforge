"""Carried weight, load limits, and load category.

The Strength carrying-capacity table is a constant here rather than database data: it is small,
static, and the engine cannot function without it.
"""

from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal

from heroforge_rules.models import ArmorPiece, LoadCategory, Possession

# Strength score -> (light load limit, medium load limit, heavy load limit), in pounds.
# Each limit is the heaviest weight still in that category.
STRENGTH_LOAD_TABLE: dict[int, tuple[int, int, int]] = {
    1: (3, 6, 10),
    2: (6, 13, 20),
    3: (10, 20, 30),
    4: (13, 26, 40),
    5: (16, 33, 50),
    6: (20, 40, 60),
    7: (23, 46, 70),
    8: (26, 53, 80),
    9: (30, 60, 90),
    10: (33, 66, 100),
    11: (38, 76, 115),
    12: (43, 86, 130),
    13: (50, 100, 150),
    14: (58, 116, 175),
    15: (66, 133, 200),
    16: (76, 153, 230),
    17: (86, 173, 260),
    18: (100, 200, 300),
    19: (116, 233, 350),
    20: (133, 266, 400),
    21: (153, 306, 460),
    22: (173, 346, 520),
    23: (200, 400, 600),
    24: (233, 466, 700),
    25: (266, 533, 800),
    26: (306, 613, 920),
    27: (346, 693, 1040),
    28: (400, 800, 1200),
    29: (466, 933, 1400),
}

_TABLE_TOP = 29
_WRAP_BASE = 20


def load_limits(strength_score: int) -> tuple[int, int, int]:
    """``(light, medium, heavy)`` limits for a Strength score.

    Above 29 the table repeats: each further +10 of Strength multiplies capacity by 4, so a
    Strength of 34 is a Strength of 24 with one doubling of the doubling.
    """
    if strength_score <= _TABLE_TOP:
        return STRENGTH_LOAD_TABLE[strength_score]

    steps, remainder = divmod(strength_score - _WRAP_BASE, 10)
    light, medium, heavy = STRENGTH_LOAD_TABLE[_WRAP_BASE + remainder]
    multiplier = 4**steps
    return light * multiplier, medium * multiplier, heavy * multiplier


def load_category(weight: Decimal, limits: tuple[int, int, int]) -> LoadCategory:
    """Boundaries are inclusive at the top: exactly the light limit is still a light load."""
    light, medium, heavy = limits
    if weight <= light:
        return LoadCategory.LIGHT
    if weight <= medium:
        return LoadCategory.MEDIUM
    if weight <= heavy:
        return LoadCategory.HEAVY
    return LoadCategory.OVERLOADED


def carried_weight(possessions: Iterable[Possession], armor: Iterable[ArmorPiece]) -> Decimal:
    """Everything the character is carrying.

    Unrelated to ``body_weight``, which is the character's own weight from the identity line.
    """
    total = Decimal(0)
    for possession in possessions:
        total += possession.weight
    for piece in armor:
        total += piece.weight
    return total


def lift_over_head(limits: tuple[int, int, int]) -> int:
    """Equals the maximum load."""
    return limits[2]


def lift_off_ground(limits: tuple[int, int, int]) -> int:
    """Twice the maximum load."""
    return limits[2] * 2


def push_or_drag(limits: tuple[int, int, int]) -> int:
    """Five times the maximum load."""
    return limits[2] * 5
