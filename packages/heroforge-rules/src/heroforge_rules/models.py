"""Inputs and outputs of the rules engine.

Everything the engine reasons about crosses its boundary through these models. They are the
engine's public interface: the API layer composes its request and response schemas out of them
rather than restating their fields.
"""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from typing import Annotated, ClassVar, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Ability(StrEnum):
    """The six ability scores, used as skill keys and save keys."""

    STR = "STR"
    DEX = "DEX"
    CON = "CON"
    INT = "INT"
    WIS = "WIS"
    CHA = "CHA"


class ArmorSlot(StrEnum):
    """The four GEAR slots on page 2 of the sheet.

    Only ``armor`` and ``shield`` carry a max-Dex limit and a check penalty on the paper form;
    the two protective-item slots contribute an AC bonus and a weight.
    """

    ARMOR = "armor"
    SHIELD = "shield"
    PROTECTIVE_1 = "protective_1"
    PROTECTIVE_2 = "protective_2"


class LoadCategory(StrEnum):
    LIGHT = "light"
    MEDIUM = "medium"
    HEAVY = "heavy"
    OVERLOADED = "overloaded"


class WarningCode(StrEnum):
    RANKS_OVER_MAXIMUM = "ranks_over_maximum"
    DEX_BONUS_EXCEEDS_MAX_DEX = "dex_bonus_exceeds_max_dex"
    OVERLOADED = "overloaded"
    UNKNOWN_SKILL = "unknown_skill"


AbilityScore = Annotated[int, Field(ge=1, le=99)]
NonNegativeDecimal = Annotated[Decimal, Field(ge=0)]
CheckPenalty = Annotated[int, Field(le=0)]


class RuleWarning(BaseModel):
    """A rules violation that the application reports rather than refuses.

    House rules and homebrew are normal play, so nothing here is an error. Named ``RuleWarning``
    rather than ``Warning`` so it does not shadow the builtin.
    """

    model_config = ConfigDict(frozen=True)

    code: WarningCode
    message: str
    field: str | None = None


class SkillDefinition(BaseModel):
    """One row of the SRD skill list. Passed into ``derive``; never fetched by the engine."""

    model_config = ConfigDict(frozen=True)

    id: int
    name: str
    key_ability: Ability
    armor_check_penalty: bool = False
    acp_double: bool = False
    usable_untrained: bool = True
    takes_specialization: bool = False


class AbilityScores(BaseModel):
    """Base scores with optional temporary scores. Temporary wins where present."""

    model_config = ConfigDict(extra="forbid")

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

    def effective(self, ability: Ability) -> int:
        """The score the modifier is computed from: temporary where present, else base."""
        prefix = ability.value.lower()
        temporary: int | None = getattr(self, f"{prefix}_temp")
        if temporary is not None:
            return temporary
        base: int = getattr(self, f"{prefix}_score")
        return base


class ArmorPiece(BaseModel):
    """One equipped GEAR row. Feeds AC, the Dex cap, the check penalty, and carried weight."""

    model_config = ConfigDict(extra="forbid")

    slot: ArmorSlot
    name: str = ""
    type: str = ""
    ac_bonus: int = 0
    max_dex: int | None = None
    check_penalty: CheckPenalty = 0
    spell_failure: int = 0
    speed: str = ""
    weight: NonNegativeDecimal = Decimal(0)
    special_properties: str = ""


class Possession(BaseModel):
    """An OTHER POSSESSIONS row. Only ever summed."""

    model_config = ConfigDict(extra="forbid")

    item: str = ""
    page: str = ""
    weight: NonNegativeDecimal = Decimal(0)


class SaveInput(BaseModel):
    """The five boxes of one saving-throw row, minus the ability modifier the engine supplies."""

    model_config = ConfigDict(extra="forbid")

    base: int = 0
    magic: int = 0
    misc: int = 0
    temporary: int = 0


class ClassLevel(BaseModel):
    """One entry of CLASS AND LEVEL. Free text in phase 1."""

    model_config = ConfigDict(extra="forbid")

    class_name: str = ""
    level: Annotated[int, Field(ge=1)] = 1


class SkillEntry(BaseModel):
    """One SKILLS row of a character.

    Exactly one of ``skill_id`` and ``custom_name`` is set: a row either points at the SRD list or
    is one of the blank rows at the bottom of the sheet.
    """

    model_config = ConfigDict(extra="forbid")

    key: str | None = None
    """Stable identity for the row, echoed back on the derived skill so the UI can match them up."""

    skill_id: int | None = None
    custom_name: str | None = None
    specialization: str | None = None
    key_ability: Ability | None = None
    """Only meaningful for custom rows; SRD rows take the key ability from the definition."""

    ranks: NonNegativeDecimal = Decimal(0)
    misc_modifier: int = 0
    is_class_skill: bool = False

    @model_validator(mode="after")
    def exactly_one_identity(self) -> Self:
        if (self.skill_id is None) == (self.custom_name is None):
            raise ValueError("exactly one of skill_id and custom_name must be set")
        return self


class CharacterInput(BaseModel):
    """Everything the phase-1 formulas read. A superset of it is what the sheet stores."""

    model_config = ConfigDict(extra="forbid")

    abilities: AbilityScores = Field(default_factory=AbilityScores)
    class_levels: list[ClassLevel] = Field(default_factory=list)

    armor: list[ArmorPiece] = Field(default_factory=list)
    skills: list[SkillEntry] = Field(default_factory=list)
    possessions: list[Possession] = Field(default_factory=list)

    # Combat. base_attack_bonus is typed by the user in phase 1, not derived.
    base_attack_bonus: int = 0
    grapple_size_modifier: int = 0
    grapple_misc: int = 0
    initiative_misc: int = 0

    # AC components other than armour, shield, and Dexterity.
    ac_natural: int = 0
    ac_deflection: int = 0
    ac_size: int = 0
    ac_misc: int = 0

    fortitude: SaveInput = Field(default_factory=SaveInput)
    reflex: SaveInput = Field(default_factory=SaveInput)
    will: SaveInput = Field(default_factory=SaveInput)

    @property
    def character_level(self) -> int:
        """Sum of class levels — what drives ``max_ranks``. Zero when no class rows exist."""
        return sum(entry.level for entry in self.class_levels)


class AbilityBlock(BaseModel):
    """One row of the ability table: the score actually in effect and its modifier."""

    model_config = ConfigDict(frozen=True)

    score: int
    modifier: int
    is_temporary: bool = False


class DerivedAbilities(BaseModel):
    """The six ability rows.

    Named fields rather than a dictionary keyed by ``Ability``: a mapping schema generates a
    TypeScript index signature, and the frontend would lose the guarantee that every ability is
    present. Indexing by ``Ability`` still works for the engine's own use.
    """

    model_config = ConfigDict(frozen=True)

    strength: AbilityBlock
    dexterity: AbilityBlock
    constitution: AbilityBlock
    intelligence: AbilityBlock
    wisdom: AbilityBlock
    charisma: AbilityBlock

    _FIELDS: ClassVar[dict[Ability, str]] = {
        Ability.STR: "strength",
        Ability.DEX: "dexterity",
        Ability.CON: "constitution",
        Ability.INT: "intelligence",
        Ability.WIS: "wisdom",
        Ability.CHA: "charisma",
    }

    def __getitem__(self, ability: Ability) -> AbilityBlock:
        block: AbilityBlock = getattr(self, self._FIELDS[ability])
        return block

    def items(self) -> list[tuple[Ability, AbilityBlock]]:
        return [(ability, self[ability]) for ability in Ability]


class DerivedSave(BaseModel):
    model_config = ConfigDict(frozen=True)

    base: int
    ability_modifier: int
    magic: int
    misc: int
    temporary: int
    total: int


class DerivedSaves(BaseModel):
    """The three saving-throw rows, named for the same reason the abilities are."""

    model_config = ConfigDict(frozen=True)

    fortitude: DerivedSave
    reflex: DerivedSave
    will: DerivedSave

    def __getitem__(self, save: str) -> DerivedSave:
        result: DerivedSave = getattr(self, save)
        return result


class DerivedArmorClass(BaseModel):
    model_config = ConfigDict(frozen=True)

    armor_bonus: int
    shield_bonus: int
    effective_dex_bonus: int
    size_modifier: int
    natural_armor: int
    deflection: int
    misc: int
    total: int
    touch: int
    flat_footed: int


class DerivedSkill(BaseModel):
    model_config = ConfigDict(frozen=True)

    key: str | None
    skill_id: int | None
    name: str
    specialization: str | None
    key_ability: Ability
    is_class_skill: bool
    usable_untrained: bool
    ranks: Decimal
    effective_ranks: int
    ability_modifier: int
    misc_modifier: int
    armor_check_penalty: int
    total: int
    max_ranks: Decimal


class DerivedEncumbrance(BaseModel):
    model_config = ConfigDict(frozen=True)

    carried_weight: Decimal
    light_load: int
    medium_load: int
    heavy_load: int
    category: LoadCategory
    lift_over_head: int
    lift_off_ground: int
    push_or_drag: int


class DerivedSheet(BaseModel):
    """Every number the paper sheet asks you to work out by hand."""

    model_config = ConfigDict(frozen=True)

    character_level: int
    abilities: DerivedAbilities
    armor_class: DerivedArmorClass
    initiative: int
    grapple_modifier: int
    armor_check_penalty: int
    saves: DerivedSaves
    skills: list[DerivedSkill]
    encumbrance: DerivedEncumbrance
    warnings: list[RuleWarning] = Field(default_factory=list)
