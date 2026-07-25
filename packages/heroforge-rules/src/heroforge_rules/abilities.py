"""Ability scores and their modifiers."""

from __future__ import annotations

from heroforge_rules.models import Ability, AbilityBlock, AbilityScores, DerivedAbilities


def ability_modifier(score: int) -> int:
    """floor((score - 10) / 2).

    Python's ``//`` floors toward negative infinity, which is what the SRD asks for: a score of 3
    gives -4, not the -3 that truncating division would produce.
    """
    return (score - 10) // 2


def ability_modifiers(scores: AbilityScores) -> DerivedAbilities:
    """The whole ability table, using temporary scores where present."""

    def block(ability: Ability) -> AbilityBlock:
        effective = scores.effective(ability)
        temporary: int | None = getattr(scores, f"{ability.value.lower()}_temp")
        return AbilityBlock(
            score=effective,
            modifier=ability_modifier(effective),
            is_temporary=temporary is not None,
        )

    return DerivedAbilities(
        strength=block(Ability.STR),
        dexterity=block(Ability.DEX),
        constitution=block(Ability.CON),
        intelligence=block(Ability.INT),
        wisdom=block(Ability.WIS),
        charisma=block(Ability.CHA),
    )
