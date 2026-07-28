"""``derive`` — the single public entry point of the rules engine.

Skill definitions are passed in, never fetched: that is what keeps this package free of I/O and
what lets ``POST /api/derive`` answer without touching the database.

The engine never raises. Its input has already been validated at the Pydantic boundary, and rules
violations — ranks over maximum, a Dexterity bonus wider than the armour allows — come back as
warnings, because house rules and homebrew are normal play.
"""

from __future__ import annotations

from collections.abc import Sequence

from heroforge_rules.abilities import ability_modifiers
from heroforge_rules.combat import grapple_modifier, initiative
from heroforge_rules.defense import (
    armor_check_penalty,
    armor_class,
    effective_dex_bonus,
    flat_footed_ac,
    max_dex_cap,
    protective_bonus,
    shield_bonus,
    touch_ac,
    worn_armor_bonus,
)
from heroforge_rules.encumbrance import (
    carried_weight,
    lift_off_ground,
    lift_over_head,
    load_category,
    load_limits,
    push_or_drag,
)
from heroforge_rules.models import (
    Ability,
    CharacterInput,
    DerivedAbilities,
    DerivedArmorClass,
    DerivedEncumbrance,
    DerivedSave,
    DerivedSaves,
    DerivedSheet,
    DerivedSkill,
    LoadCategory,
    RuleWarning,
    SaveInput,
    SkillDefinition,
    SkillEntry,
    WarningCode,
)
from heroforge_rules.saves import SAVE_ABILITIES, save_total
from heroforge_rules.skills import max_ranks, skill_total, total_ranks


def derive(character: CharacterInput, skills: Sequence[SkillDefinition]) -> DerivedSheet:
    """Every number the paper sheet asks you to work out by hand."""
    warnings: list[RuleWarning] = []

    abilities = ability_modifiers(character.abilities)
    dex_modifier = abilities[Ability.DEX].modifier
    str_modifier = abilities[Ability.STR].modifier

    equipped = character.armor
    check_penalty = armor_check_penalty(equipped)
    dex_to_ac = effective_dex_bonus(dex_modifier, equipped)

    cap = max_dex_cap(equipped)
    if cap is not None and dex_modifier > cap:
        warnings.append(
            RuleWarning(
                code=WarningCode.DEX_BONUS_EXCEEDS_MAX_DEX,
                message=(
                    f"Dexterity bonus of +{dex_modifier} exceeds the armour's maximum "
                    f"Dexterity bonus of +{cap}; AC uses +{dex_to_ac}."
                ),
                field="armor",
                params={
                    "dex_modifier": str(dex_modifier),
                    "max_dex": str(cap),
                    "applied": str(dex_to_ac),
                },
            )
        )

    armor_bonus = worn_armor_bonus(equipped)
    shield = shield_bonus(equipped)
    # The two PROTECTIVE ITEM slots are neither an armour nor a shield bonus; the paper sheet
    # has nowhere else to put them, so they land in the misc column.
    misc_ac = character.ac_misc + protective_bonus(equipped)

    total_ac = armor_class(
        armor=armor_bonus,
        shield=shield,
        effective_dex=dex_to_ac,
        size=character.ac_size,
        natural=character.ac_natural,
        deflection=character.ac_deflection,
        misc=misc_ac,
    )
    defense = DerivedArmorClass(
        armor_bonus=armor_bonus,
        shield_bonus=shield,
        effective_dex_bonus=dex_to_ac,
        size_modifier=character.ac_size,
        natural_armor=character.ac_natural,
        deflection=character.ac_deflection,
        misc=misc_ac,
        total=total_ac,
        touch=touch_ac(
            effective_dex=dex_to_ac,
            size=character.ac_size,
            deflection=character.ac_deflection,
            misc=misc_ac,
        ),
        flat_footed=flat_footed_ac(total_ac, dex_to_ac),
    )

    saves = DerivedSaves(
        **{
            name: _derive_save(getattr(character, name), abilities[ability].modifier)
            for name, ability in SAVE_ABILITIES.items()
        }
    )

    character_level = character.character_level
    definitions = {definition.id: definition for definition in skills}
    derived_skills = [
        _derive_skill(
            entry,
            definitions,
            abilities=abilities,
            character_level=character_level,
            check_penalty=check_penalty,
            warnings=warnings,
        )
        for entry in character.skills
    ]

    weight = carried_weight(character.possessions, equipped)
    limits = load_limits(character.abilities.effective(Ability.STR))
    category = load_category(weight, limits)
    if category is LoadCategory.OVERLOADED:
        warnings.append(
            RuleWarning(
                code=WarningCode.OVERLOADED,
                message=(
                    f"Carrying {weight} lb. exceeds the maximum load of {limits[2]} lb. "
                    "The character can no longer move under this weight."
                ),
                field="possessions",
                params={"carried_weight": str(weight), "maximum_load": str(limits[2])},
            )
        )

    return DerivedSheet(
        character_level=character_level,
        abilities=abilities,
        armor_class=defense,
        initiative=initiative(dex_modifier, character.initiative_misc),
        grapple_modifier=grapple_modifier(
            character.base_attack_bonus,
            str_modifier,
            character.grapple_size_modifier,
            character.grapple_misc,
        ),
        armor_check_penalty=check_penalty,
        saves=saves,
        skills=derived_skills,
        total_ranks=total_ranks(row.ranks for row in derived_skills),
        encumbrance=DerivedEncumbrance(
            carried_weight=weight,
            light_load=limits[0],
            medium_load=limits[1],
            heavy_load=limits[2],
            category=category,
            lift_over_head=lift_over_head(limits),
            lift_off_ground=lift_off_ground(limits),
            push_or_drag=push_or_drag(limits),
        ),
        warnings=warnings,
    )


def _derive_save(inputs: SaveInput, ability_modifier: int) -> DerivedSave:
    return DerivedSave(
        base=inputs.base,
        ability_modifier=ability_modifier,
        magic=inputs.magic,
        misc=inputs.misc,
        temporary=inputs.temporary,
        total=save_total(
            inputs.base, ability_modifier, inputs.magic, inputs.misc, inputs.temporary
        ),
    )


def _derive_skill(
    entry: SkillEntry,
    definitions: dict[int, SkillDefinition],
    *,
    abilities: DerivedAbilities,
    character_level: int,
    check_penalty: int,
    warnings: list[RuleWarning],
) -> DerivedSkill:
    definition = definitions.get(entry.skill_id) if entry.skill_id is not None else None

    if entry.skill_id is not None and definition is None:
        warnings.append(
            RuleWarning(
                code=WarningCode.UNKNOWN_SKILL,
                message=f"Skill {entry.skill_id} is not in the reference list.",
                field=entry.key,
                params={"skill_id": str(entry.skill_id)},
            )
        )

    if definition is not None:
        name = definition.name
        key_ability = definition.key_ability
        applies_acp = definition.armor_check_penalty
        doubles_acp = definition.acp_double
        usable_untrained = definition.usable_untrained
    else:
        # A blank row from the bottom of the sheet, or a reference row we cannot resolve.
        name = entry.custom_name or ""
        key_ability = entry.key_ability or Ability.INT
        applies_acp = False
        doubles_acp = False
        usable_untrained = True

    ability_modifier = abilities[key_ability].modifier
    cap = max_ranks(character_level, is_class_skill=entry.is_class_skill)

    if entry.ranks > cap:
        kind = "class" if entry.is_class_skill else "cross-class"
        label = f"{name} ({entry.specialization})" if entry.specialization else name
        # `skill_name` is the fallback for a row the client cannot name itself — a custom row has
        # no reference identifier to look a translation up by. `kind` is a token, not the English
        # word: spliced into a French sentence, "cross-class" would read as half a translation.
        params = {
            "skill_name": name,
            "kind": "class" if entry.is_class_skill else "cross_class",
            "ranks": str(entry.ranks),
            "max_ranks": str(cap),
            "character_level": str(character_level),
        }
        if entry.skill_id is not None:
            params["skill_id"] = str(entry.skill_id)
        if entry.specialization:
            params["specialization"] = entry.specialization
        warnings.append(
            RuleWarning(
                code=WarningCode.RANKS_OVER_MAXIMUM,
                message=(
                    f"{label}: {entry.ranks} ranks exceeds the {kind} maximum of {cap} "
                    f"at character level {character_level}."
                ),
                field=entry.key,
                params=params,
            )
        )

    return DerivedSkill(
        key=entry.key,
        skill_id=entry.skill_id,
        name=name,
        specialization=entry.specialization,
        key_ability=key_ability,
        is_class_skill=entry.is_class_skill,
        usable_untrained=usable_untrained,
        ranks=entry.ranks,
        ability_modifier=ability_modifier,
        misc_modifier=entry.misc_modifier,
        armor_check_penalty=_applied_penalty(check_penalty, applies_acp, doubles_acp),
        total=skill_total(
            ranks=entry.ranks,
            ability_modifier=ability_modifier,
            misc_modifier=entry.misc_modifier,
            armor_check_penalty=check_penalty,
            applies_armor_check_penalty=applies_acp,
            doubles_armor_check_penalty=doubles_acp,
        ),
        max_ranks=cap,
    )


def _applied_penalty(check_penalty: int, applies: bool, doubles: bool) -> int:
    """How much of the armour check penalty this particular skill actually takes."""
    if not applies:
        return 0
    return check_penalty * 2 if doubles else check_penalty


__all__ = ["derive"]
