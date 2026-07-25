from __future__ import annotations

from decimal import Decimal

import pytest
from heroforge_rules.defense import (
    armor_check_penalty,
    armor_class,
    effective_dex_bonus,
    flat_footed_ac,
    shield_bonus,
    touch_ac,
    worn_armor_bonus,
)
from heroforge_rules.models import ArmorPiece, ArmorSlot


def plate(**overrides: object) -> ArmorPiece:
    defaults: dict[str, object] = {
        "slot": ArmorSlot.ARMOR,
        "name": "Full plate",
        "ac_bonus": 8,
        "max_dex": 1,
        "check_penalty": -6,
        "weight": Decimal(50),
    }
    return ArmorPiece.model_validate(defaults | overrides)


def buckler(**overrides: object) -> ArmorPiece:
    defaults: dict[str, object] = {
        "slot": ArmorSlot.SHIELD,
        "name": "Heavy steel shield",
        "ac_bonus": 2,
        "check_penalty": -2,
        "weight": Decimal(15),
    }
    return ArmorPiece.model_validate(defaults | overrides)


class TestEffectiveDexBonus:
    def test_unarmoured_character_keeps_the_full_dex_modifier(self) -> None:
        assert effective_dex_bonus(4, []) == 4

    def test_armour_caps_the_bonus(self) -> None:
        assert effective_dex_bonus(4, [plate(max_dex=1)]) == 1

    def test_bonus_below_the_cap_is_untouched(self) -> None:
        assert effective_dex_bonus(0, [plate(max_dex=1)]) == 0

    def test_armour_without_a_max_dex_imposes_no_cap(self) -> None:
        assert effective_dex_bonus(5, [plate(max_dex=None)]) == 5

    def test_the_tightest_cap_across_pieces_wins(self) -> None:
        pieces = [plate(max_dex=4), buckler(max_dex=2)]
        assert effective_dex_bonus(5, pieces) == 2

    def test_a_negative_dex_modifier_is_never_raised_by_armour(self) -> None:
        """A Dex penalty still applies in full plate; the cap is a ceiling, not a floor."""
        assert effective_dex_bonus(-2, [plate(max_dex=1)]) == -2


class TestArmorCheckPenalty:
    def test_penalties_are_summed_as_stored_non_positive_integers(self) -> None:
        assert armor_check_penalty([plate(check_penalty=-6), buckler(check_penalty=-2)]) == -8

    def test_no_armour_means_no_penalty(self) -> None:
        assert armor_check_penalty([]) == 0

    def test_masterwork_armour_reduces_the_magnitude(self) -> None:
        assert armor_check_penalty([plate(check_penalty=-5)]) == -5


class TestBonusExtraction:
    def test_worn_armor_bonus_reads_only_the_armor_slot(self) -> None:
        pieces = [plate(ac_bonus=8), buckler(ac_bonus=2)]
        assert worn_armor_bonus(pieces) == 8

    def test_shield_bonus_reads_only_the_shield_slot(self) -> None:
        pieces = [plate(ac_bonus=8), buckler(ac_bonus=2)]
        assert shield_bonus(pieces) == 2

    def test_protective_items_contribute_through_misc_not_armour_or_shield(self) -> None:
        amulet = ArmorPiece(slot=ArmorSlot.PROTECTIVE_1, name="Amulet of natural armor", ac_bonus=2)
        assert worn_armor_bonus([amulet]) == 0
        assert shield_bonus([amulet]) == 0


class TestArmorClass:
    def test_the_ten_plus_components_formula(self) -> None:
        total = armor_class(
            armor=8,
            shield=2,
            effective_dex=1,
            size=1,
            natural=0,
            deflection=1,
            misc=0,
        )
        assert total == 23

    def test_touch_ac_drops_armour_shield_and_natural(self) -> None:
        assert touch_ac(effective_dex=1, size=1, deflection=1, misc=0) == 13

    def test_touch_ac_uses_the_same_capped_dex_bonus_as_normal_ac(self) -> None:
        """The cap is a property of the character in armour, not of the attack being resolved."""
        capped = effective_dex_bonus(4, [plate(max_dex=1)])
        assert touch_ac(effective_dex=capped, size=0, deflection=0, misc=0) == 11

    @pytest.mark.parametrize(
        ("dex", "expected_ff"),
        # total AC is 24 + dex here, so removing a positive bonus always lands on 24;
        # the -2 row must stay at its own (lower) total rather than being pushed up to 24.
        [(4, 24), (1, 24), (0, 24), (-2, 22)],
    )
    def test_flat_footed_removes_a_positive_dex_bonus_only(
        self, dex: int, expected_ff: int
    ) -> None:
        """A Dexterity *penalty* still applies when flat-footed — it must not be added back."""
        total = armor_class(
            armor=8, shield=2, effective_dex=dex, size=0, natural=2, deflection=2, misc=0
        )
        assert flat_footed_ac(total, dex) == expected_ff
