from __future__ import annotations

import pytest
from heroforge_rules.combat import grapple_modifier, initiative
from heroforge_rules.saves import save_total


@pytest.mark.parametrize(
    ("base", "ability", "magic", "misc", "temporary", "expected"),
    [
        (0, 0, 0, 0, 0, 0),
        (4, 3, 1, 0, 0, 8),
        (2, -1, 0, 0, 0, 1),
        (6, 2, 2, 1, -2, 9),
        (0, -5, 0, 0, 0, -5),
    ],
)
def test_save_total_sums_all_five_boxes(
    base: int, ability: int, magic: int, misc: int, temporary: int, expected: int
) -> None:
    assert save_total(base, ability, magic, misc, temporary) == expected


@pytest.mark.parametrize(
    ("dex_mod", "misc", "expected"),
    [(0, 0, 0), (3, 4, 7), (-1, 0, -1), (2, -2, 0)],
)
def test_initiative_is_dex_plus_misc(dex_mod: int, misc: int, expected: int) -> None:
    assert initiative(dex_mod, misc) == expected


def test_initiative_uses_the_uncapped_dex_modifier() -> None:
    """Armour caps the Dex bonus to AC. It does not cap initiative."""
    assert initiative(4, 0) == 4


@pytest.mark.parametrize(
    ("bab", "str_mod", "size_mod", "misc", "expected"),
    [
        (0, 0, 0, 0, 0),
        (6, 1, 0, 0, 7),
        (6, 1, -4, 0, 3),
        (11, 5, 4, 2, 22),
        (2, -2, -8, 0, -8),
    ],
)
def test_grapple_modifier_sums_bab_strength_size_and_misc(
    bab: int, str_mod: int, size_mod: int, misc: int, expected: int
) -> None:
    assert grapple_modifier(bab, str_mod, size_mod, misc) == expected


def test_grapple_size_modifier_is_the_special_grapple_scale_not_the_ac_scale() -> None:
    """A Small creature gets +1 to AC but -4 to grapple. The two are never the same number."""
    small_ac_size = 1
    small_grapple_size = -4
    assert grapple_modifier(6, 1, small_grapple_size, 0) == 3
    assert grapple_modifier(6, 1, small_ac_size, 0) != 3
