"""Armour class and the equipment values that feed it.

``effective_dex_bonus`` is the single point where equipment and abilities interact, and it is the
most frequently mis-derived number on a hand-written sheet.
"""

from __future__ import annotations

from collections.abc import Iterable

from heroforge_rules.models import ArmorPiece, ArmorSlot


def worn_armor_bonus(pieces: Iterable[ArmorPiece]) -> int:
    return sum(piece.ac_bonus for piece in pieces if piece.slot is ArmorSlot.ARMOR)


def shield_bonus(pieces: Iterable[ArmorPiece]) -> int:
    return sum(piece.ac_bonus for piece in pieces if piece.slot is ArmorSlot.SHIELD)


def protective_bonus(pieces: Iterable[ArmorPiece]) -> int:
    """The two PROTECTIVE ITEM slots. They are neither armour nor shield bonuses."""
    protective = (ArmorSlot.PROTECTIVE_1, ArmorSlot.PROTECTIVE_2)
    return sum(piece.ac_bonus for piece in pieces if piece.slot in protective)


def armor_check_penalty(pieces: Iterable[ArmorPiece]) -> int:
    """Sum of the equipped check penalties.

    Penalties are stored as non-positive integers — full plate is ``-6``, matching the SRD armour
    table and what the user writes on the paper sheet — so this sum is non-positive and callers
    **add** it.
    """
    return sum(piece.check_penalty for piece in pieces)


def max_dex_cap(pieces: Iterable[ArmorPiece]) -> int | None:
    """The tightest ``max_dex`` across equipped pieces, or ``None`` if nothing limits Dexterity."""
    caps = [piece.max_dex for piece in pieces if piece.max_dex is not None]
    return min(caps) if caps else None


def effective_dex_bonus(dex_modifier: int, pieces: Iterable[ArmorPiece]) -> int:
    """``min(dex_mod, armor.max_dex)`` when armour limits Dexterity, otherwise ``dex_mod``.

    A ceiling, never a floor: a Dexterity *penalty* is not softened by wearing full plate.
    """
    cap = max_dex_cap(pieces)
    if cap is None:
        return dex_modifier
    return min(dex_modifier, cap)


def armor_class(
    *,
    armor: int,
    shield: int,
    effective_dex: int,
    size: int,
    natural: int,
    deflection: int,
    misc: int,
) -> int:
    return 10 + armor + shield + effective_dex + size + natural + deflection + misc


def touch_ac(*, effective_dex: int, size: int, deflection: int, misc: int) -> int:
    """Armour, shield, and natural armour do not apply against touch attacks."""
    return 10 + effective_dex + size + deflection + misc


def flat_footed_ac(total_ac: int, effective_dex: int) -> int:
    """Flat-footed loses the Dexterity *bonus* to AC.

    ``max(effective_dex, 0)`` is load-bearing: a character with a Dexterity penalty is no harder
    to hit when caught flat-footed.
    """
    return total_ac - max(effective_dex, 0)
