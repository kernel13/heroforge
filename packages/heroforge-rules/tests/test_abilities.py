from __future__ import annotations

import pytest
from heroforge_rules.abilities import ability_modifier, ability_modifiers
from heroforge_rules.models import Ability, AbilityScores


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (1, -5),
        (2, -4),
        (3, -4),
        (4, -3),
        (5, -3),
        (8, -1),
        (9, -1),
        (10, 0),
        (11, 0),
        (12, 1),
        (13, 1),
        (14, 2),
        (15, 2),
        (16, 3),
        (17, 3),
        (18, 4),
        (20, 5),
        (25, 7),
        (29, 9),
        (30, 10),
        (45, 17),
        (99, 44),
    ],
)
def test_ability_modifier_is_floor_of_score_minus_ten_over_two(score: int, expected: int) -> None:
    """SRD: "ability modifier = (score - 10) / 2, rounded down"."""
    assert ability_modifier(score) == expected


def test_odd_scores_below_ten_round_down_not_toward_zero() -> None:
    """floor(-7/2) is -4, not -3. Truncating division would give the wrong sign here."""
    assert ability_modifier(3) == -4
    assert ability_modifier(5) == -3
    assert ability_modifier(7) == -2


def test_temporary_score_wins_where_present() -> None:
    scores = AbilityScores(str_score=10, str_temp=18, dex_score=14)
    assert scores.effective(Ability.STR) == 18
    assert scores.effective(Ability.DEX) == 14


def test_temporary_score_of_lower_value_still_wins() -> None:
    """A temporary score is not a bonus — ability damage lowers it."""
    scores = AbilityScores(con_score=16, con_temp=8)
    assert scores.effective(Ability.CON) == 8


def test_ability_modifiers_maps_every_ability() -> None:
    scores = AbilityScores(
        str_score=13, dex_score=16, con_score=14, int_score=12, wis_score=10, cha_score=8
    )
    blocks = ability_modifiers(scores)

    assert [ability for ability, _ in blocks.items()] == list(Ability)
    assert blocks[Ability.STR].modifier == 1
    assert blocks[Ability.DEX].modifier == 3
    assert blocks[Ability.CON].modifier == 2
    assert blocks[Ability.INT].modifier == 1
    assert blocks[Ability.WIS].modifier == 0
    assert blocks[Ability.CHA].modifier == -1
    assert all(not block.is_temporary for _, block in blocks.items())


def test_ability_modifiers_flags_temporary_rows() -> None:
    blocks = ability_modifiers(AbilityScores(con_score=14, con_temp=16))
    assert blocks[Ability.CON].score == 16
    assert blocks[Ability.CON].modifier == 3
    assert blocks[Ability.CON].is_temporary is True
    assert blocks[Ability.STR].is_temporary is False
