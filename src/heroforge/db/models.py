"""SQLAlchemy models.

The rule applied throughout: **normalise what the engine reasons about, use JSONB for what it only
stores or sums.** ``character_armor``, ``character_skills``, and ``character_class_levels`` feed
formulas, so they are tables; ``possessions``, ``feats``, ``special_abilities``, ``languages``, and
``spells_raw`` are only stored or summed, so they are JSONB.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from fastapi_users_db_sqlalchemy.access_token import SQLAlchemyBaseAccessTokenTableUUID
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from heroforge.db.base import Base


class User(SQLAlchemyBaseUserTableUUID, Base):
    """`fastapi-users` supplies id, email, hashed_password, is_active, is_verified, is_superuser."""

    __tablename__ = "users"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    characters: Mapped[list[Character]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class AccessToken(SQLAlchemyBaseAccessTokenTableUUID, Base):
    """Server-side session tokens, so logging out genuinely invalidates the session.

    The mixin's own foreign key points at a table called ``user``; ours is ``users``, so the
    column is redeclared here.
    """

    __tablename__ = "access_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )


class Skill(Base):
    """One row of the SRD 3.5 skill list. Reference data, seeded from a versioned YAML file."""

    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name_fr: Mapped[str | None] = mapped_column(String(64), nullable=True)
    """The French name of the skill, for a client asking for French.

    Nullable, and nullable on purpose: a skill added through ``sqladmin`` before anyone has
    translated it is a skill the French sheet should still show, under its English name. The
    engine never sees this column — it reasons about identifiers, and ``name`` is the one name it
    is given.
    """

    key_ability: Mapped[str] = mapped_column(String(3), nullable=False)
    armor_check_penalty: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    acp_double: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    usable_untrained: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    takes_specialization: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sheet_rows: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    """How many blank rows the paper sheet prints for this skill.

    Craft has three, Knowledge five, Perform three, Profession two. ``POST /api/characters``
    creates that many zeroed rows so the sheet matches the printed form on first load.
    """

    __table_args__ = (
        CheckConstraint(
            "key_ability IN ('STR','DEX','CON','INT','WIS','CHA')", name="ck_skills_key_ability"
        ),
        CheckConstraint("sheet_rows >= 1", name="ck_skills_sheet_rows_positive"),
    )


class Character(Base):
    """One wide flat row mirroring the paper sheet."""

    __tablename__ = "characters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    """Bumped on every successful PATCH. A stale value in a request is a 409."""

    # Identity line.
    name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    player_name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    race: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    alignment: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    deity: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    size: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    age: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    gender: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    height: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    body_weight: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    """The character's own weight, from the identity line. Never part of ``carried_weight``."""
    eyes: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    hair: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    skin: Mapped[str] = mapped_column(String(30), default="", nullable=False)

    # Campaign.
    campaign: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    experience_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Abilities.
    str_score: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    dex_score: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    con_score: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    int_score: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    wis_score: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    cha_score: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    str_temp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dex_temp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    con_temp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    int_temp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wis_temp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cha_temp: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Health.
    hp_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hp_current: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    nonlethal_damage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    damage_reduction: Mapped[str] = mapped_column(String(60), default="", nullable=False)

    # Combat.
    speed: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    spell_resistance: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    base_attack_bonus: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    """User-entered in phase 1. Deriving it needs class progression tables."""
    grapple_misc: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    grapple_size_modifier: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    """The special size modifier for grapple checks. Not ``ac_size``: Small is +1 AC but -4 here."""
    initiative_misc: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Saves. The three bases are user-entered in phase 1.
    base_fortitude: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fortitude_magic: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fortitude_misc: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fortitude_temporary: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    base_reflex: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reflex_magic: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reflex_misc: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reflex_temporary: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    base_will: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    will_magic: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    will_misc: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    will_temporary: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    saves_conditional_modifiers: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # AC components other than armour and shield, which come from character_armor.
    ac_natural: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ac_deflection: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ac_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ac_misc: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Money.
    money_cp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    money_sp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    money_gp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    money_pp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Stored or summed only, never reasoned about.
    possessions: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False, server_default="[]"
    )
    feats: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False, server_default="[]"
    )
    special_abilities: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False, server_default="[]"
    )
    languages: Mapped[list[str]] = mapped_column(
        JSONB, default=list, nullable=False, server_default="[]"
    )
    spells_raw: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False, server_default="{}"
    )

    # The portrait.
    #
    # Deliberately outside the versioned document: it is uploaded from the character list, and
    # bumping ``version`` there would 409 a sheet the same user has open in another tab on its next
    # autosave. ``PATCH`` never touches these two columns; the portrait routes never touch
    # ``version``.
    #
    # ``deferred``, because every ordinary character read would otherwise drag a few hundred
    # kilobytes of image out of the database to render a sheet that does not show it. Only
    # ``GET /api/characters/{id}/portrait`` loads the bytes, and it selects the column explicitly.
    portrait_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, deferred=True)
    portrait_media_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    portrait_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    """Null where there is no portrait. Doubles as the list card's cache-buster: without it the
    browser keeps serving the previous image from its own cache after a replacement. Not
    ``updated_at``, which moves on every write to the row and would re-fetch the picture each time
    the character's name was edited."""

    owner: Mapped[User] = relationship(back_populates="characters")
    class_levels: Mapped[list[CharacterClassLevel]] = relationship(
        back_populates="character",
        cascade="all, delete-orphan",
        order_by="CharacterClassLevel.ordinal",
    )
    skills: Mapped[list[CharacterSkill]] = relationship(
        back_populates="character", cascade="all, delete-orphan", order_by="CharacterSkill.ordinal"
    )
    armor: Mapped[list[CharacterArmor]] = relationship(
        back_populates="character", cascade="all, delete-orphan", order_by="CharacterArmor.slot"
    )
    attacks: Mapped[list[CharacterAttack]] = relationship(
        back_populates="character", cascade="all, delete-orphan", order_by="CharacterAttack.ordinal"
    )


class CharacterClassLevel(Base):
    """One CLASS AND LEVEL entry. Free text in phase 1; a foreign key in phase 2."""

    __tablename__ = "character_class_levels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    ordinal: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    class_name: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    character: Mapped[Character] = relationship(back_populates="class_levels")

    __table_args__ = (
        CheckConstraint("level >= 1", name="ck_class_levels_level_positive"),
        Index("ix_character_class_levels_character_id", "character_id"),
    )


class CharacterSkill(Base):
    """One SKILLS row. Either an SRD skill or one of the blank rows at the bottom of the sheet."""

    __tablename__ = "character_skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    ordinal: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skill_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("skills.id", ondelete="RESTRICT"), nullable=True
    )
    custom_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    custom_key_ability: Mapped[str | None] = mapped_column(String(3), nullable=True)
    specialization: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ranks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    """The rank count as written on the sheet, not skill points spent. A whole number: this
    application does not model the two-points-per-rank cross-class cost that halves would come
    from."""
    misc_modifier: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_class_skill: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    character: Mapped[Character] = relationship(back_populates="skills")

    __table_args__ = (
        CheckConstraint(
            "(skill_id IS NULL) <> (custom_name IS NULL)",
            name="ck_character_skills_exactly_one_identity",
        ),
        CheckConstraint("ranks >= 0", name="ck_character_skills_ranks_non_negative"),
        Index("ix_character_skills_character_id", "character_id"),
    )


class CharacterArmor(Base):
    """One GEAR slot. Normalised because it feeds AC, the Dex cap, the ACP, and carried weight."""

    __tablename__ = "character_armor"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    slot: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    type: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    ac_bonus: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_dex: Mapped[int | None] = mapped_column(Integer, nullable=True)
    check_penalty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    """Stored non-positive, as on the SRD armour table and the paper sheet. Full plate is -6."""
    spell_failure: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    speed: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(7, 2), default=Decimal(0), nullable=False)
    special_properties: Mapped[str] = mapped_column(Text, default="", nullable=False)

    character: Mapped[Character] = relationship(back_populates="armor")

    __table_args__ = (
        CheckConstraint(
            "slot IN ('armor','shield','protective_1','protective_2')",
            name="ck_character_armor_slot",
        ),
        CheckConstraint("check_penalty <= 0", name="ck_character_armor_check_penalty_non_positive"),
        CheckConstraint("weight >= 0", name="ck_character_armor_weight_non_negative"),
        UniqueConstraint("character_id", "slot", name="uq_character_armor_slot"),
    )


class CharacterAttack(Base):
    """One ATTACK block. ``attack_bonus`` and ``damage`` are text, not derived.

    There is no fixed number of them: the sheet adds and removes blocks, and ``ordinal`` is
    rewritten from the order sent on every save.
    """

    __tablename__ = "character_attacks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    ordinal: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    attack_bonus: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    damage: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    critical: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    range: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    damage_type: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    ammunition: Mapped[str] = mapped_column(String(120), default="", nullable=False)

    character: Mapped[Character] = relationship(back_populates="attacks")

    __table_args__ = (Index("ix_character_attacks_character_id", "character_id"),)
