"""The SRD 3.5 skill list, as the engine's callers supply it.

In the application these rows come from the ``skills`` table, seeded from
``src/heroforge/db/seeds/skills.yaml``. The engine never fetches them, so the tests build them
here and pass them in exactly as the API layer's startup cache does.
"""

from __future__ import annotations

from heroforge_rules.models import Ability, SkillDefinition

# name, key ability, armour check penalty, doubled penalty, usable untrained, specialised
_SRD_SKILLS: list[tuple[str, Ability, bool, bool, bool, bool]] = [
    ("Appraise", Ability.INT, False, False, True, False),
    ("Balance", Ability.DEX, True, False, True, False),
    ("Bluff", Ability.CHA, False, False, True, False),
    ("Climb", Ability.STR, True, False, True, False),
    ("Concentration", Ability.CON, False, False, True, False),
    ("Craft", Ability.INT, False, False, True, True),
    ("Decipher Script", Ability.INT, False, False, False, False),
    ("Diplomacy", Ability.CHA, False, False, True, False),
    ("Disable Device", Ability.INT, False, False, False, False),
    ("Disguise", Ability.CHA, False, False, True, False),
    ("Escape Artist", Ability.DEX, True, False, True, False),
    ("Forgery", Ability.INT, False, False, True, False),
    ("Gather Information", Ability.CHA, False, False, True, False),
    ("Handle Animal", Ability.CHA, False, False, False, False),
    ("Heal", Ability.WIS, False, False, True, False),
    ("Hide", Ability.DEX, True, False, True, False),
    ("Intimidate", Ability.CHA, False, False, True, False),
    ("Jump", Ability.STR, True, False, True, False),
    ("Knowledge", Ability.INT, False, False, False, True),
    ("Listen", Ability.WIS, False, False, True, False),
    ("Move Silently", Ability.DEX, True, False, True, False),
    ("Open Lock", Ability.DEX, False, False, False, False),
    ("Perform", Ability.CHA, False, False, True, True),
    ("Profession", Ability.WIS, False, False, False, True),
    ("Ride", Ability.DEX, False, False, True, False),
    ("Search", Ability.INT, False, False, True, False),
    ("Sense Motive", Ability.WIS, False, False, True, False),
    ("Sleight of Hand", Ability.DEX, True, False, False, False),
    ("Spellcraft", Ability.INT, False, False, False, False),
    ("Spot", Ability.WIS, False, False, True, False),
    ("Survival", Ability.WIS, False, False, True, False),
    ("Swim", Ability.STR, True, True, True, False),
    ("Tumble", Ability.DEX, True, False, False, False),
    ("Use Magic Device", Ability.CHA, False, False, False, False),
    ("Use Rope", Ability.DEX, False, False, True, False),
]

SRD_SKILLS: list[SkillDefinition] = [
    SkillDefinition(
        id=index,
        name=name,
        key_ability=key_ability,
        armor_check_penalty=acp,
        acp_double=acp_double,
        usable_untrained=untrained,
        takes_specialization=specialised,
    )
    for index, (name, key_ability, acp, acp_double, untrained, specialised) in enumerate(
        _SRD_SKILLS, start=1
    )
]

SKILL_IDS: dict[str, int] = {definition.name: definition.id for definition in SRD_SKILLS}
