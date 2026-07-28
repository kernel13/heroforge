"""Request and response schemas.

These compose the engine's models rather than restate them: ``DerivedSheet`` is returned exactly
as ``heroforge_rules`` produces it, and ``to_engine_input`` is the single place where a stored
sheet becomes a ``CharacterInput``.

All validation lives here, at the Pydantic boundary. The engine is given input it can trust and
therefore never raises.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, Self

from heroforge_rules.models import (
    Ability,
    AbilityScores,
    ArmorPiece,
    ArmorSlot,
    CharacterInput,
    ClassLevel,
    DerivedSheet,
    Possession,
    SaveInput,
    SkillEntry,
)
from pydantic import BaseModel, ConfigDict, Field, model_validator

AbilityScore = Annotated[int, Field(ge=1, le=99)]
NonNegative = Annotated[Decimal, Field(ge=0)]
CheckPenalty = Annotated[int, Field(le=0)]


class SkillRow(BaseModel):
    """One SKILLS row as stored. Exactly one of ``skill_id`` and ``custom_name`` is set."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None = None
    ordinal: int = 0
    skill_id: int | None = None
    custom_name: str | None = None
    custom_key_ability: Ability | None = None
    specialization: str | None = None
    ranks: NonNegative = Decimal(0)
    misc_modifier: int = 0
    is_class_skill: bool = False

    @model_validator(mode="after")
    def exactly_one_identity(self) -> Self:
        if (self.skill_id is None) == (self.custom_name is None):
            raise ValueError("exactly one of skill_id and custom_name must be set")
        return self


class ArmorRow(BaseModel):
    """One GEAR slot as stored."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None = None
    slot: ArmorSlot
    name: str = ""
    type: str = ""
    ac_bonus: int = 0
    max_dex: int | None = None
    check_penalty: CheckPenalty = 0
    """Non-positive, as on the SRD armour table: full plate is -6, not 6."""
    spell_failure: int = 0
    speed: str = ""
    weight: NonNegative = Decimal(0)
    special_properties: str = ""


class AttackRow(BaseModel):
    """One ATTACK block. ``attack_bonus`` and ``damage`` are typed by the user in phase 1."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None = None
    ordinal: int = 0
    name: str = ""
    attack_bonus: str = ""
    damage: str = ""
    critical: str = ""
    range: str = ""
    damage_type: str = ""
    notes: str = ""
    ammunition: str = ""


class ClassLevelRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None = None
    ordinal: int = 0
    class_name: str = ""
    level: Annotated[int, Field(ge=1)] = 1


class PossessionRow(BaseModel):
    """An OTHER POSSESSIONS row. Stored in JSONB because it is only ever summed."""

    item: str = ""
    page: str = ""
    weight: NonNegative = Decimal(0)


class NamedReference(BaseModel):
    """A feat or special ability, with the **PG.** column the paper sheet prints beside it."""

    name: str = ""
    page: str = ""


class CharacterBody(BaseModel):
    """Every field on both pages of the paper sheet, including those not yet computed.

    Every field has a default, so ``model_dump(exclude_unset=True)`` gives true partial-update
    semantics on ``PATCH`` without a parallel all-optional model.
    """

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    # Identity line.
    name: str = ""
    player_name: str = ""
    race: str = ""
    alignment: str = ""
    deity: str = ""
    size: str = ""
    age: str = ""
    gender: str = ""
    height: str = ""
    body_weight: str = ""
    """The character's own weight. Unrelated to the derived ``carried_weight``."""
    eyes: str = ""
    hair: str = ""
    skin: str = ""

    campaign: str = ""
    experience_points: int = 0

    str_score: AbilityScore = 10
    dex_score: AbilityScore = 10
    con_score: AbilityScore = 10
    int_score: AbilityScore = 10
    wis_score: AbilityScore = 10
    cha_score: AbilityScore = 10
    str_temp: AbilityScore | None = None
    dex_temp: AbilityScore | None = None
    con_temp: AbilityScore | None = None
    int_temp: AbilityScore | None = None
    wis_temp: AbilityScore | None = None
    cha_temp: AbilityScore | None = None

    hp_total: int = 0
    hp_current: int = 0
    nonlethal_damage: int = 0
    damage_reduction: str = ""

    speed: str = ""
    spell_resistance: str = ""
    base_attack_bonus: int = 0
    grapple_misc: int = 0
    grapple_size_modifier: int = 0
    """Not ``ac_size``. A Small creature has +1 AC but -4 to grapple."""
    initiative_misc: int = 0

    base_fortitude: int = 0
    fortitude_magic: int = 0
    fortitude_misc: int = 0
    fortitude_temporary: int = 0
    base_reflex: int = 0
    reflex_magic: int = 0
    reflex_misc: int = 0
    reflex_temporary: int = 0
    base_will: int = 0
    will_magic: int = 0
    will_misc: int = 0
    will_temporary: int = 0
    saves_conditional_modifiers: str = ""

    ac_natural: int = 0
    ac_deflection: int = 0
    ac_size: int = 0
    ac_misc: int = 0

    money_cp: int = 0
    money_sp: int = 0
    money_gp: int = 0
    money_pp: int = 0

    possessions: list[PossessionRow] = Field(default_factory=list)
    feats: list[NamedReference] = Field(default_factory=list)
    special_abilities: list[NamedReference] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    spells_raw: dict[str, Any] = Field(default_factory=dict)

    class_levels: list[ClassLevelRow] = Field(default_factory=list)
    skills: list[SkillRow] = Field(default_factory=list)
    armor: list[ArmorRow] = Field(default_factory=list)
    attacks: list[AttackRow] = Field(default_factory=list)


class CharacterCreate(BaseModel):
    """Creating a character asks for a name and nothing else; everything else has a default."""

    model_config = ConfigDict(extra="forbid")

    name: str = "New character"
    player_name: str = ""
    campaign: str = ""


class CharacterPatch(CharacterBody):
    """A partial update. ``version`` is the value the client last read; a stale one is a 409."""

    version: int


class CharacterRead(CharacterBody):
    id: uuid.UUID
    version: int
    created_at: datetime
    updated_at: datetime


class CharacterSummary(BaseModel):
    """A row of the character list. Deliberately narrow — the list does not derive anything."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    player_name: str
    campaign: str
    race: str
    version: int
    updated_at: datetime
    class_levels: list[ClassLevelRow] = Field(default_factory=list)


class CharacterWithDerived(BaseModel):
    """What ``GET`` and ``PATCH`` of a single character return."""

    character: CharacterRead
    derived: DerivedSheet


class SkillDefinitionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    name_fr: str | None = None
    """Null where nobody has translated the skill yet; the client falls back to ``name``."""

    key_ability: Ability
    armor_check_penalty: bool
    acp_double: bool
    usable_untrained: bool
    takes_specialization: bool
    sheet_rows: int


class Problem(BaseModel):
    """RFC 7807 ``application/problem+json``."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None


def to_engine_input(body: CharacterBody) -> CharacterInput:
    """The single place a stored sheet becomes engine input."""
    return CharacterInput(
        # CharacterBody names the twelve ability columns exactly as AbilityScores does.
        abilities=AbilityScores(
            **{field: getattr(body, field) for field in AbilityScores.model_fields}
        ),
        class_levels=[
            ClassLevel(class_name=row.class_name, level=row.level) for row in body.class_levels
        ],
        armor=[
            ArmorPiece(
                slot=row.slot,
                name=row.name,
                type=row.type,
                ac_bonus=row.ac_bonus,
                max_dex=row.max_dex,
                check_penalty=row.check_penalty,
                spell_failure=row.spell_failure,
                speed=row.speed,
                weight=row.weight,
                special_properties=row.special_properties,
            )
            for row in body.armor
        ],
        skills=[
            SkillEntry(
                key=str(row.id) if row.id is not None else f"row-{row.ordinal}",
                skill_id=row.skill_id,
                custom_name=row.custom_name,
                specialization=row.specialization,
                key_ability=row.custom_key_ability,
                ranks=row.ranks,
                misc_modifier=row.misc_modifier,
                is_class_skill=row.is_class_skill,
            )
            for row in body.skills
        ],
        possessions=[
            Possession(item=row.item, page=row.page, weight=row.weight) for row in body.possessions
        ],
        base_attack_bonus=body.base_attack_bonus,
        grapple_size_modifier=body.grapple_size_modifier,
        grapple_misc=body.grapple_misc,
        initiative_misc=body.initiative_misc,
        ac_natural=body.ac_natural,
        ac_deflection=body.ac_deflection,
        ac_size=body.ac_size,
        ac_misc=body.ac_misc,
        fortitude=SaveInput(
            base=body.base_fortitude,
            magic=body.fortitude_magic,
            misc=body.fortitude_misc,
            temporary=body.fortitude_temporary,
        ),
        reflex=SaveInput(
            base=body.base_reflex,
            magic=body.reflex_magic,
            misc=body.reflex_misc,
            temporary=body.reflex_temporary,
        ),
        will=SaveInput(
            base=body.base_will,
            magic=body.will_magic,
            misc=body.will_misc,
            temporary=body.will_temporary,
        ),
    )
