"""Ability scores and their modifiers."""

from __future__ import annotations

from heroforge_rules.models import Ability, AbilityBlock, AbilityScores


def ability_modifier(score: int) -> int:
    """floor((score - 10) / 2).

    Python's ``//`` floors toward negative infinity, which is what the SRD asks for: a score of 3
    gives -4, not the -3 that truncating division would produce.
    """
    return (score - 10) // 2


def ability_modifiers(scores: AbilityScores) -> dict[Ability, AbilityBlock]:
    """The whole ability table, using temporary scores where present."""
    blocks: dict[Ability, AbilityBlock] = {}
    for ability in Ability:
        effective = scores.effective(ability)
        temporary: int | None = getattr(scores, f"{ability.value.lower()}_temp")
        blocks[ability] = AbilityBlock(
            score=effective,
            modifier=ability_modifier(effective),
            is_temporary=temporary is not None,
        )
    return blocks
