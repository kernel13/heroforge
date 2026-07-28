"""Skill totals and rank maxima.

``ranks`` is a whole number. The two-skill-points-per-rank cost of a cross-class skill is the only
thing in the SRD that produces a fraction of a rank, and this application does not model that cost;
the cross-class maximum, which the SRD also writes as a possibly-fractional half, is rounded down
here (see ``max_ranks``). Neither route to a half rank is open, so a rank always counts toward the
check in full and there is nothing to floor.
"""

from __future__ import annotations

from collections.abc import Iterable


def total_ranks(ranks: Iterable[int]) -> int:
    """The sum of the ranks across every row of the sheet.

    **Not skill points spent, and it must never be labelled as such.** A cross-class rank costs two
    skill points in the SRD and a class rank costs one; this application models neither cost, so the
    number of points behind these ranks is unknowable from what is stored. It is a count of ranks,
    which is what the player can check against the rows above it.
    """
    return sum(ranks)


def max_ranks(character_level: int, *, is_class_skill: bool) -> int:
    """``character_level + 3`` for a class skill; **half that, rounded down**, cross-class.

    The SRD's cross-class maximum is half the class one, and it is written as a value that can be
    fractional — a level-2 character caps a cross-class skill at 2½. **This application rounds it
    down**, which is the one thing that keeps `ranks` an integer end to end: a cap of 2 admits only
    whole ranks, where a cap of 2½ would need the half rank the boundary refuses. That rounding is
    this function's only departure from the SRD, and it departs downward.

    `is_class_skill` is keyword-only and has **no default**. A default would mean a caller that
    forgot the flag silently got the class ceiling, which is the more permissive of the two and
    therefore the one whose absence produces no warning to notice it by.

    `character_level` is the sum of every class level, so a Rogue 4 / Fighter 3 caps at 10 for a
    class skill and 5 cross-class, not at 7 or 6.
    """
    ceiling = character_level + 3
    return ceiling if is_class_skill else ceiling // 2


def skill_total(
    *,
    ranks: int,
    ability_modifier: int,
    misc_modifier: int,
    armor_check_penalty: int = 0,
    applies_armor_check_penalty: bool = False,
    doubles_armor_check_penalty: bool = False,
) -> int:
    """Ranks + ability modifier + misc, plus any armour check penalty.

    The penalty is stored non-positive, so it is **added**. Swim adds it twice.
    """
    total = ranks + ability_modifier + misc_modifier
    if applies_armor_check_penalty:
        total += armor_check_penalty
        if doubles_armor_check_penalty:
            total += armor_check_penalty
    return total
