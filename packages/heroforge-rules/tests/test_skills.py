from __future__ import annotations

import inspect

import pytest
from heroforge_rules.models import SkillEntry
from heroforge_rules.skills import max_ranks, skill_total, total_ranks
from pydantic import ValidationError


@pytest.mark.parametrize(
    ("level", "expected"),
    [
        (0, 3),
        (1, 4),
        (7, 10),
        (8, 11),
        (20, 23),
    ],
)
def test_max_ranks_for_a_class_skill(level: int, expected: int) -> None:
    assert max_ranks(level, is_class_skill=True) == expected


@pytest.mark.parametrize(
    ("level", "expected"),
    [
        (0, 1),  # 3 // 2
        (1, 2),  # 4 // 2
        (7, 5),  # 10 // 2
        (8, 5),  # 11 // 2 — rounds down, not to 6
        (20, 11),  # 23 // 2
    ],
)
def test_max_ranks_for_a_cross_class_skill_is_half_that_rounded_down(
    level: int, expected: int
) -> None:
    """SRD, *Skills*: the cross-class maximum is half the class one.

    Levels 7 and 8 both cap at 5 — the pair is the point of the table. A `round()` in place of the
    floor gives 6 at level 8 (11 / 2 = 5.5 rounds to 6, and to 5 under banker's rounding, which is
    worse: it would look correct here and be wrong at level 10). Halving must round *down*, so
    every cap stays an integer and no half rank can arise.
    """
    assert max_ranks(level, is_class_skill=False) == expected


def test_the_maximum_depends_on_whether_the_skill_is_a_class_skill() -> None:
    """The halving is the SRD rule and this engine now applies it.

    A previous house rule capped both kinds at character level + 3, and `max_ranks` deliberately
    took no flag so that no caller could put the halving back. That is reversed: the flag is
    required, keyword-only, and has no default — a caller that omits it fails rather than quietly
    receiving the more permissive class ceiling.
    """
    assert max_ranks(7, is_class_skill=True) == 10
    assert max_ranks(7, is_class_skill=False) == 5

    parameter = inspect.signature(max_ranks).parameters["is_class_skill"]
    assert parameter.kind is inspect.Parameter.KEYWORD_ONLY
    assert parameter.default is inspect.Parameter.empty


def test_a_rank_is_a_whole_number() -> None:
    """The two-skill-points-per-cross-class-rank cost is the only thing in the SRD that produces a
    fraction of a rank, and this engine does not model it; the other half the SRD writes — the
    cross-class maximum — is rounded down. So a rank here is always whole and always counts toward
    the check in full. There is nothing to floor.

    Pinned at the boundary rather than in `skill_total`: a fraction that the engine silently
    floored would show a total one behind the ranks column, which reads as the engine being wrong.
    """
    assert SkillEntry(skill_id=1, ranks=4).ranks == 4
    with pytest.raises(ValidationError):
        SkillEntry(skill_id=1, ranks=3.5)  # type: ignore[arg-type]


def test_ranks_may_not_be_negative() -> None:
    with pytest.raises(ValidationError):
        SkillEntry(skill_id=1, ranks=-1)


class TestTotalRanks:
    def test_sums_every_row(self) -> None:
        assert total_ranks([4, 0, 7, 2]) == 13

    def test_no_rows_is_zero(self) -> None:
        """A character sheet with no skill rows at all, not an error."""
        assert total_ranks([]) == 0

    def test_counts_a_cross_class_rank_the_same_as_a_class_one(self) -> None:
        """It is a count of ranks, not of skill points.

        A cross-class rank costs two points in the SRD and a class rank costs one, but this
        application models neither, so weighting the two here would invent a number the stored data
        cannot support. Anything displaying this must not call it points spent.
        """
        assert total_ranks([3, 3]) == 6


class TestSkillTotal:
    def test_ranks_plus_ability_plus_misc(self) -> None:
        assert skill_total(ranks=10, ability_modifier=2, misc_modifier=1) == 13

    def test_armour_check_penalty_is_added_because_it_is_stored_negative(self) -> None:
        total = skill_total(
            ranks=10,
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=-8,
            applies_armor_check_penalty=True,
        )
        assert total == 3

    def test_a_skill_that_does_not_take_the_penalty_ignores_it(self) -> None:
        total = skill_total(
            ranks=10,
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=-8,
            applies_armor_check_penalty=False,
        )
        assert total == 11

    def test_swim_takes_the_penalty_twice(self) -> None:
        """The sheet's footnote: "(Double penalty for Swim.)"."""
        total = skill_total(
            ranks=5,
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=-8,
            applies_armor_check_penalty=True,
            doubles_armor_check_penalty=True,
        )
        assert total == -10

    def test_doubling_is_inert_when_the_penalty_does_not_apply(self) -> None:
        total = skill_total(
            ranks=5,
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=-8,
            applies_armor_check_penalty=False,
            doubles_armor_check_penalty=True,
        )
        assert total == 6

    def test_no_armour_leaves_a_penalised_skill_unpenalised(self) -> None:
        total = skill_total(
            ranks=5,
            ability_modifier=1,
            misc_modifier=0,
            armor_check_penalty=0,
            applies_armor_check_penalty=True,
            doubles_armor_check_penalty=True,
        )
        assert total == 6
