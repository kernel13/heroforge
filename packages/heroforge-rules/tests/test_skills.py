from __future__ import annotations

from decimal import Decimal

import pytest
from heroforge_rules.skills import effective_ranks, max_ranks, skill_total


@pytest.mark.parametrize(
    ("ranks", "expected"),
    [
        (Decimal("0"), 0),
        (Decimal("0.5"), 0),
        (Decimal("1"), 1),
        (Decimal("3.5"), 3),
        (Decimal("5.0"), 5),
        (Decimal("10.5"), 10),
    ],
)
def test_effective_ranks_floors_the_stored_half_integer(ranks: Decimal, expected: int) -> None:
    """SRD, Skills: "if you have a fraction of a rank, ... you do not gain any benefit from it
    until you accumulate a full rank" — cross-class ranks cost 2 skill points each, so a
    character can genuinely hold a half rank, and the paper sheet asks you to write "3½".

    A half rank counts toward the maximum and brings the character closer to the next full
    rank. It does not improve the check. The engine therefore floors before adding.
    """
    assert effective_ranks(ranks) == expected


@pytest.mark.parametrize(
    ("level", "is_class_skill", "expected"),
    [
        (1, True, Decimal("4")),
        (1, False, Decimal("2")),
        (7, True, Decimal("10")),
        (7, False, Decimal("5")),
        (8, True, Decimal("11")),
        (8, False, Decimal("5.5")),
        (20, True, Decimal("23")),
        (20, False, Decimal("11.5")),
    ],
)
def test_max_ranks(level: int, is_class_skill: bool, expected: Decimal) -> None:
    assert max_ranks(level, is_class_skill=is_class_skill) == expected


def test_cross_class_maximum_stays_a_half_integer() -> None:
    """(level + 3) / 2 is not floored. At level 8 the cap is 5½ ranks, not 5."""
    assert max_ranks(8, is_class_skill=False) == Decimal("5.5")


def test_maximum_is_compared_against_the_unfloored_stored_ranks() -> None:
    """3½ ranks is legal against a cap of 5½; 6 ranks is not. Flooring the stored value first
    would let a character hold 6½ cross-class ranks at level 8 without complaint."""
    cap = max_ranks(8, is_class_skill=False)
    assert Decimal("5.5") <= cap
    assert Decimal("6.0") > cap


class TestSkillTotal:
    def test_ranks_plus_ability_plus_misc(self) -> None:
        assert skill_total(ranks=Decimal("10"), ability_modifier=2, misc_modifier=1) == 13

    def test_half_ranks_contribute_nothing(self) -> None:
        with_half = skill_total(ranks=Decimal("3.5"), ability_modifier=3, misc_modifier=0)
        without_half = skill_total(ranks=Decimal("3.0"), ability_modifier=3, misc_modifier=0)
        assert with_half == without_half == 6

    def test_armour_check_penalty_is_added_because_it_is_stored_negative(self) -> None:
        total = skill_total(
            ranks=Decimal("10"),
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=-8,
            applies_armor_check_penalty=True,
        )
        assert total == 3

    def test_a_skill_that_does_not_take_the_penalty_ignores_it(self) -> None:
        total = skill_total(
            ranks=Decimal("10"),
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=-8,
            applies_armor_check_penalty=False,
        )
        assert total == 11

    def test_swim_takes_the_penalty_twice(self) -> None:
        """The sheet's footnote: "(Double penalty for Swim.)"."""
        total = skill_total(
            ranks=Decimal("5"),
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=-8,
            applies_armor_check_penalty=True,
            doubles_armor_check_penalty=True,
        )
        assert total == -10

    def test_doubling_is_inert_when_the_penalty_does_not_apply(self) -> None:
        total = skill_total(
            ranks=Decimal("5"),
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=-8,
            applies_armor_check_penalty=False,
            doubles_armor_check_penalty=True,
        )
        assert total == 6

    def test_no_armour_leaves_a_penalised_skill_unpenalised(self) -> None:
        total = skill_total(
            ranks=Decimal("5"),
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=0,
            applies_armor_check_penalty=True,
            doubles_armor_check_penalty=True,
        )
        assert total == 6
