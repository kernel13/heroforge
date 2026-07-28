"""The golden character.

One fully worked level-7 multiclass character, with every derived value on the sheet asserted.
Per-function tests cannot catch composition errors — ``effective_dex_bonus`` reaching
``armor_class`` but not ``touch_ac``, for instance — and this is what catches them.

**Bramwell Tosscobble**, gnome Fighter 5 / Rogue 2. Deliberately built so that every convention
that is easy to get wrong is exercised at once:

* armour with a **nonzero check penalty**, and a Swim total, pinning both the non-positive sign
  convention and the double penalty;
* a Dexterity modifier **wider than the armour allows**, so ``effective_dex_bonus`` is a real cap
  and its warning fires;
* Small size, where ``ac_size`` is **+1** and ``grapple_size_modifier`` is **-4** — different
  numbers in different columns;
* a **temporary Constitution** score, which must reach Fortitude and nothing else;
* a **cross-class skill**, which caps at half the class maximum, rounded down;
* a cross-class row sitting **exactly on that halved maximum**, so the cap is pinned inclusive;
* a carried weight landing **exactly on the medium/heavy boundary**;
* one skill deliberately **over its rank maximum**, which is a warning and not an error.

Phase 1 note: ``base_attack_bonus`` and the three base saves are typed by the user, so the values
below are the ones a Fighter 5 / Rogue 2 would write on paper.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from heroforge_rules import derive
from heroforge_rules.models import (
    Ability,
    AbilityScores,
    ArmorPiece,
    ArmorSlot,
    CharacterInput,
    ClassLevel,
    DerivedSheet,
    DerivedSkill,
    LoadCategory,
    Possession,
    SaveInput,
    SkillDefinition,
    SkillEntry,
    WarningCode,
)
from srd import SKILL_IDS

# Armour 25 + shield 7.5 + possessions 67.5 = exactly 100 lb., which is exactly the medium load
# limit for Strength 13. Inclusive at the top: the character is at a medium load, not a heavy one.
POSSESSIONS = [
    ("Longsword", "116", "2"),
    ("Dagger", "116", "0.5"),
    ("Shortbow", "119", "2"),
    ("Arrows (40)", "116", "6"),
    ("Backpack", "126", "2"),
    ("Bedroll", "126", "5"),
    ("Trail rations (4 days)", "126", "4"),
    ("Waterskin", "126", "4"),
    ("Rope, hemp (50 ft.)", "126", "10"),
    ("Torches (5)", "126", "5"),
    ("Crowbar", "126", "5"),
    ("Grappling hook", "126", "4"),
    ("Chain (10 ft.)", "126", "2"),
    ("Caltrops", "126", "2"),
    ("Thieves' tools, masterwork", "126", "2"),
    ("Hammer", "126", "2"),
    ("Pitons (10)", "126", "5"),
    ("Lantern, bullseye", "126", "3"),
    ("Oil (2 flasks)", "126", "2"),
    ("Flint and steel", "126", "0"),
]

# name, specialization, ranks, misc, class skill
SKILL_ROWS = [
    ("Climb", None, 10, 0, True),
    ("Swim", None, 5, 0, True),
    ("Hide", None, 4, 0, True),
    ("Tumble", None, 3, 0, False),
    ("Diplomacy", None, 2, 0, False),
    ("Spot", None, 10, 2, True),
    ("Knowledge", "dungeoneering", 5, 0, False),
    ("Ride", None, 0, 0, True),
    ("Listen", None, 12, 0, True),
]


@pytest.fixture
def bramwell() -> CharacterInput:
    return CharacterInput(
        abilities=AbilityScores(
            str_score=13,
            dex_score=16,
            con_score=14,
            int_score=12,
            wis_score=10,
            cha_score=8,
            con_temp=16,  # bear's endurance
        ),
        class_levels=[
            ClassLevel(class_name="Fighter", level=5),
            ClassLevel(class_name="Rogue", level=2),
        ],
        armor=[
            ArmorPiece(
                slot=ArmorSlot.ARMOR,
                name="Full plate",
                type="heavy",
                ac_bonus=8,
                max_dex=1,
                check_penalty=-6,
                spell_failure=35,
                speed="15 ft.",
                weight=Decimal(25),
            ),
            ArmorPiece(
                slot=ArmorSlot.SHIELD,
                name="Heavy steel shield",
                type="shield",
                ac_bonus=2,
                check_penalty=-2,
                spell_failure=15,
                weight=Decimal("7.5"),
            ),
        ],
        possessions=[
            Possession(item=item, page=page, weight=Decimal(weight))
            for item, page, weight in POSSESSIONS
        ],
        skills=[
            SkillEntry(
                key=f"srd-{SKILL_IDS[name]}-{specialization or ''}",
                skill_id=SKILL_IDS[name],
                specialization=specialization,
                ranks=ranks,
                misc_modifier=misc,
                is_class_skill=is_class,
            )
            for name, specialization, ranks, misc, is_class in SKILL_ROWS
        ]
        + [
            SkillEntry(
                key="custom-1",
                custom_name="Autohypnosis",
                key_ability=Ability.WIS,
                ranks=6,
                is_class_skill=True,
            )
        ],
        base_attack_bonus=6,  # Fighter 5 (+5) + Rogue 2 (+1)
        grapple_size_modifier=-4,  # Small
        grapple_misc=0,
        initiative_misc=4,  # Improved Initiative
        ac_natural=0,
        ac_deflection=1,  # ring of protection +1
        ac_size=1,  # Small
        ac_misc=0,
        fortitude=SaveInput(base=4, magic=1),
        reflex=SaveInput(base=4),
        will=SaveInput(base=1),
    )


@pytest.fixture
def sheet(bramwell: CharacterInput, srd_skills: list[SkillDefinition]) -> DerivedSheet:
    return derive(bramwell, srd_skills)


def skill(sheet: DerivedSheet, name: str) -> DerivedSkill:
    return next(row for row in sheet.skills if row.name == name)


class TestIdentityAndAbilities:
    def test_character_level_is_the_sum_of_class_levels(self, sheet: DerivedSheet) -> None:
        assert sheet.character_level == 7

    @pytest.mark.parametrize(
        ("ability", "score", "modifier"),
        [
            (Ability.STR, 13, 1),
            (Ability.DEX, 16, 3),
            (Ability.CON, 16, 3),  # temporary score, not the base 14
            (Ability.INT, 12, 1),
            (Ability.WIS, 10, 0),
            (Ability.CHA, 8, -1),
        ],
    )
    def test_ability_block(
        self, sheet: DerivedSheet, ability: Ability, score: int, modifier: int
    ) -> None:
        assert sheet.abilities[ability].score == score
        assert sheet.abilities[ability].modifier == modifier

    def test_only_constitution_is_flagged_temporary(self, sheet: DerivedSheet) -> None:
        temporary = {a for a, block in sheet.abilities.items() if block.is_temporary}
        assert temporary == {Ability.CON}


class TestArmorClass:
    def test_full_plate_caps_the_dexterity_bonus(self, sheet: DerivedSheet) -> None:
        """Dexterity 16 gives +3, but full plate allows only +1."""
        assert sheet.armor_class.effective_dex_bonus == 1

    def test_total(self, sheet: DerivedSheet) -> None:
        # 10 + 8 armour + 2 shield + 1 Dex + 1 size + 0 natural + 1 deflection + 0 misc
        assert sheet.armor_class.total == 23

    def test_touch_uses_the_same_capped_dexterity_bonus(self, sheet: DerivedSheet) -> None:
        """This is the composition error per-function tests miss: touch AC must use +1, not +3."""
        # 10 + 1 Dex + 1 size + 1 deflection + 0 misc
        assert sheet.armor_class.touch == 13

    def test_flat_footed_removes_the_capped_bonus(self, sheet: DerivedSheet) -> None:
        assert sheet.armor_class.flat_footed == 22

    def test_components_are_reported_separately(self, sheet: DerivedSheet) -> None:
        assert sheet.armor_class.armor_bonus == 8
        assert sheet.armor_class.shield_bonus == 2
        assert sheet.armor_class.size_modifier == 1
        assert sheet.armor_class.natural_armor == 0
        assert sheet.armor_class.deflection == 1
        assert sheet.armor_class.misc == 0


class TestCombat:
    def test_initiative_uses_the_uncapped_dexterity_modifier(self, sheet: DerivedSheet) -> None:
        """+3 from Dexterity 16 and +4 from Improved Initiative. Full plate does not cap this."""
        assert sheet.initiative == 7

    def test_grapple_uses_the_grapple_size_modifier_not_the_ac_one(
        self, sheet: DerivedSheet
    ) -> None:
        """Small: +1 to AC, but -4 to grapple. 6 BAB + 1 Str - 4 size = 3.

        Using ``ac_size`` here would give 8 — a difference of five, silently.
        """
        assert sheet.grapple_modifier == 3

    def test_armour_check_penalty_is_the_non_positive_sum(self, sheet: DerivedSheet) -> None:
        assert sheet.armor_check_penalty == -8


class TestSaves:
    def test_fortitude_uses_the_temporary_constitution(self, sheet: DerivedSheet) -> None:
        # 4 base + 3 Con (temporary 16, not base 14) + 1 magic
        assert sheet.saves["fortitude"].total == 8
        assert sheet.saves["fortitude"].ability_modifier == 3

    def test_reflex(self, sheet: DerivedSheet) -> None:
        """Reflex keys off the raw Dexterity modifier, not the armour-capped one."""
        assert sheet.saves["reflex"].total == 7
        assert sheet.saves["reflex"].ability_modifier == 3

    def test_will(self, sheet: DerivedSheet) -> None:
        assert sheet.saves["will"].total == 1
        assert sheet.saves["will"].ability_modifier == 0


class TestSkills:
    def test_every_row_is_returned_in_input_order(self, sheet: DerivedSheet) -> None:
        assert [row.name for row in sheet.skills] == [
            "Climb",
            "Swim",
            "Hide",
            "Tumble",
            "Diplomacy",
            "Spot",
            "Knowledge",
            "Ride",
            "Listen",
            "Autohypnosis",
        ]

    def test_climb_takes_the_check_penalty_once(self, sheet: DerivedSheet) -> None:
        # 10 ranks + 1 Str + 0 misc - 8 armour check penalty
        row = skill(sheet, "Climb")
        assert row.armor_check_penalty == -8
        assert row.total == 3

    def test_swim_takes_the_check_penalty_twice(self, sheet: DerivedSheet) -> None:
        """Double penalty for Swim: 5 ranks + 1 Str - 8 - 8 = -10.

        If the penalty were stored positive and subtracted, this would read +21.
        """
        row = skill(sheet, "Swim")
        assert row.armor_check_penalty == -16
        assert row.total == -10

    def test_diplomacy_ignores_the_check_penalty(self, sheet: DerivedSheet) -> None:
        # 2 ranks + -1 Cha
        row = skill(sheet, "Diplomacy")
        assert row.armor_check_penalty == 0
        assert row.total == 1

    def test_a_cross_class_rank_counts_in_full(self, sheet: DerivedSheet) -> None:
        """3 ranks in Tumble add 3: 3 + 3 Dex - 8 armour = -2.

        A rank is a whole number here and there is no fraction to discard, so a cross-class rank
        reaches the check exactly as a class one does. What remains of the distinction is the cost
        — two skill points — which this engine does not model.
        """
        row = skill(sheet, "Tumble")
        assert row.is_class_skill is False
        assert row.ranks == 3
        assert row.total == -2

    def test_a_cross_class_skill_caps_at_half_the_class_maximum(self, sheet: DerivedSheet) -> None:
        """Character level 7: a class skill caps at 10, a cross-class one at 10 // 2 = 5.

        Climb is a class skill here and Tumble is not, so the two columns of the same sheet carry
        different ceilings — which is what catches a `max_ranks` called without the flag, since
        one ceiling would then be silently wrong and the other right.
        """
        assert skill(sheet, "Tumble").is_class_skill is False
        assert skill(sheet, "Tumble").max_ranks == 5
        assert skill(sheet, "Climb").is_class_skill is True
        assert skill(sheet, "Climb").max_ranks == 10

    def test_specialisation_is_carried_through(self, sheet: DerivedSheet) -> None:
        row = skill(sheet, "Knowledge")
        assert row.specialization == "dungeoneering"
        assert row.total == 6  # 5 ranks + 1 Int
        assert row.usable_untrained is False

    def test_exactly_on_the_cross_class_maximum_is_not_over_it(self, sheet: DerivedSheet) -> None:
        """Knowledge (dungeoneering) is cross-class with 5 ranks, and the cross-class cap at
        character level 7 is 5. The comparison is strictly greater-than, so this row is legal and
        contributes no warning — see `TestWarnings`, which still expects exactly two."""
        row = skill(sheet, "Knowledge")
        assert row.is_class_skill is False
        assert (row.ranks, row.max_ranks) == (5, 5)

    def test_misc_modifier_reaches_the_total(self, sheet: DerivedSheet) -> None:
        assert skill(sheet, "Spot").total == 12  # 10 ranks + 0 Wis + 2 misc

    def test_an_unranked_skill_is_still_its_ability_modifier(self, sheet: DerivedSheet) -> None:
        assert skill(sheet, "Ride").total == 3

    def test_a_custom_row_uses_its_own_key_ability_and_takes_no_check_penalty(
        self, sheet: DerivedSheet
    ) -> None:
        row = skill(sheet, "Autohypnosis")
        assert row.skill_id is None
        assert row.key_ability is Ability.WIS
        assert row.armor_check_penalty == 0
        assert row.total == 6

    def test_a_skill_over_its_maximum_is_still_totalled(self, sheet: DerivedSheet) -> None:
        """The application reports; it does not refuse. Listen still adds all 12 ranks."""
        assert skill(sheet, "Listen").total == 12

    def test_total_ranks_counts_every_row_including_the_custom_one(
        self, sheet: DerivedSheet
    ) -> None:
        """10 + 5 + 4 + 3 + 2 + 10 + 5 + 0 + 12 across the SRD rows, plus 6 for Autohypnosis.

        The blank row at the bottom of the sheet holds ranks like any other and is counted; and
        Listen's 12 are counted despite being over the maximum, because the sum reports what is on
        the sheet rather than what the rules would have allowed.
        """
        assert sheet.total_ranks == 57
        assert sheet.total_ranks == sum(row.ranks for row in sheet.skills)


class TestEncumbrance:
    def test_carried_weight_is_possessions_plus_worn_gear(self, sheet: DerivedSheet) -> None:
        assert sheet.encumbrance.carried_weight == Decimal("100")

    def test_load_limits_for_strength_thirteen(self, sheet: DerivedSheet) -> None:
        assert sheet.encumbrance.light_load == 50
        assert sheet.encumbrance.medium_load == 100
        assert sheet.encumbrance.heavy_load == 150

    def test_exactly_on_the_boundary_is_the_lighter_category(self, sheet: DerivedSheet) -> None:
        """100 lb. is exactly the medium limit for Strength 13, so the load is medium."""
        assert sheet.encumbrance.category is LoadCategory.MEDIUM

    def test_lifting_figures(self, sheet: DerivedSheet) -> None:
        assert sheet.encumbrance.lift_over_head == 150
        assert sheet.encumbrance.lift_off_ground == 300
        assert sheet.encumbrance.push_or_drag == 750

    def test_one_more_pound_tips_into_a_heavy_load(
        self, bramwell: CharacterInput, srd_skills: list[SkillDefinition]
    ) -> None:
        overloaded = bramwell.model_copy(
            update={
                "possessions": [
                    *bramwell.possessions,
                    Possession(item="Chalk", weight=Decimal("1")),
                ]
            }
        )
        assert derive(overloaded, srd_skills).encumbrance.category is LoadCategory.HEAVY


class TestWarnings:
    def test_exactly_two_violations_are_reported(self, sheet: DerivedSheet) -> None:
        assert [warning.code for warning in sheet.warnings] == [
            WarningCode.DEX_BONUS_EXCEEDS_MAX_DEX,
            WarningCode.RANKS_OVER_MAXIMUM,
        ]

    def test_the_rank_warning_names_the_offending_row(self, sheet: DerivedSheet) -> None:
        warning = sheet.warnings[1]
        assert "Listen" in warning.message
        assert warning.field == f"srd-{SKILL_IDS['Listen']}-"

    def test_every_warning_carries_its_facts_as_tokens_beside_the_english(
        self, sheet: DerivedSheet
    ) -> None:
        """``params`` is what lets a client write the sentence in its own language.

        The engine has no locale and is not going to grow one, so ``message`` stays English. What
        it can do is hand over the same facts *unformatted* — an identifier, a number, and a
        ``kind`` token rather than the English word "cross-class". A client that spliced
        ``message`` apart, or read "cross-class" out of it, would produce half a translation.
        """
        dex, ranks = sheet.warnings

        assert dex.params == {"dex_modifier": "3", "max_dex": "1", "applied": "1"}

        assert ranks.params == {
            "skill_id": str(SKILL_IDS["Listen"]),
            "skill_name": "Listen",
            "kind": "class",
            "ranks": "12",
            "max_ranks": "10",
            "character_level": "7",
        }

    def test_nothing_raises(self, sheet: DerivedSheet) -> None:
        """Warnings, not exceptions. Getting this far is the assertion."""
        assert sheet.warnings
