"""Initiative and grapple."""

from __future__ import annotations


def initiative(dex_modifier: int, misc: int) -> int:
    """The Dexterity modifier here is the raw one — armour's ``max_dex`` caps AC, not initiative."""
    return dex_modifier + misc


def grapple_modifier(
    base_attack_bonus: int, str_modifier: int, grapple_size_modifier: int, misc: int
) -> int:
    """``grapple_size_modifier`` is the *special size modifier* for grapple checks.

    It is not ``ac_size``: a Small creature has +1 to AC but -4 to grapple. The two are stored in
    separate columns precisely so they cannot be conflated.
    """
    return base_attack_bonus + str_modifier + grapple_size_modifier + misc
