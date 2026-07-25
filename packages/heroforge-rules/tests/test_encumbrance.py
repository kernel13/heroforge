from __future__ import annotations

from decimal import Decimal

import pytest
from heroforge_rules.encumbrance import (
    carried_weight,
    load_category,
    load_limits,
)
from heroforge_rules.models import ArmorPiece, ArmorSlot, LoadCategory, Possession


@pytest.mark.parametrize(
    ("score", "light", "medium", "heavy"),
    [
        (1, 3, 6, 10),
        (5, 16, 33, 50),
        (10, 33, 66, 100),
        (13, 50, 100, 150),
        (16, 76, 153, 230),
        (18, 100, 200, 300),
        (20, 133, 266, 400),
        (25, 266, 533, 800),
        (29, 466, 933, 1400),
    ],
)
def test_strength_table(score: int, light: int, medium: int, heavy: int) -> None:
    assert load_limits(score) == (light, medium, heavy)


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (30, (532, 1064, 1600)),  # Strength 20 x 4
        (34, (932, 1864, 2800)),  # Strength 24 x 4
        (39, (1864, 3732, 5600)),  # Strength 29 x 4
        (40, (2128, 4256, 6400)),  # Strength 20 x 16
    ],
)
def test_each_ten_points_of_strength_above_the_table_multiplies_capacity_by_four(
    score: int, expected: tuple[int, int, int]
) -> None:
    assert load_limits(score) == expected


class TestLoadCategory:
    """Each limit is the heaviest weight still in that category — the boundaries are inclusive."""

    @pytest.mark.parametrize(
        ("weight", "expected"),
        [
            ("0", LoadCategory.LIGHT),
            ("50", LoadCategory.LIGHT),
            ("50.5", LoadCategory.MEDIUM),
            ("100", LoadCategory.MEDIUM),
            ("100.5", LoadCategory.HEAVY),
            ("150", LoadCategory.HEAVY),
            ("150.5", LoadCategory.OVERLOADED),
            ("999", LoadCategory.OVERLOADED),
        ],
    )
    def test_boundaries_for_strength_thirteen(self, weight: str, expected: LoadCategory) -> None:
        assert load_category(Decimal(weight), load_limits(13)) == expected


class TestCarriedWeight:
    def test_sums_possessions_and_every_equipped_piece(self) -> None:
        possessions = [
            Possession(item="Bedroll", weight=Decimal(5)),
            Possession(item="Rope, hemp (50 ft.)", weight=Decimal(10)),
        ]
        armor = [
            ArmorPiece(slot=ArmorSlot.ARMOR, name="Full plate", weight=Decimal(50)),
            ArmorPiece(slot=ArmorSlot.SHIELD, name="Heavy steel shield", weight=Decimal(15)),
        ]
        assert carried_weight(possessions, armor) == Decimal(80)

    def test_protective_items_count_toward_the_load(self) -> None:
        armor = [ArmorPiece(slot=ArmorSlot.PROTECTIVE_1, name="Cloak", weight=Decimal("1.5"))]
        assert carried_weight([], armor) == Decimal("1.5")

    def test_fractional_weights_are_not_rounded_away(self) -> None:
        possessions = [Possession(item="Dagger", weight=Decimal("0.5"))] * 3
        assert carried_weight(possessions, []) == Decimal("1.5")

    def test_an_empty_character_carries_nothing(self) -> None:
        assert carried_weight([], []) == Decimal(0)

    def test_body_weight_is_not_part_of_carried_weight(self) -> None:
        """The identity line's WEIGHT box is the character's own weight. It never contributes
        to encumbrance; only possessions and worn gear do."""
        assert carried_weight([], []) == Decimal(0)
