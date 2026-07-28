/**
 * Names for the generated schema types.
 *
 * `schema.d.ts` is produced by `openapi-typescript` from the API's OpenAPI document and is
 * committed; CI regenerates it and fails if it is stale. Never hand-edit it, and never hand-write
 * an API type here — add an alias and regenerate.
 */
import type { components } from "./schema";

type Schemas = components["schemas"];

export type CharacterBody = Schemas["CharacterBody"];
export type CharacterRead = Schemas["CharacterRead"];
export type CharacterSummary = Schemas["CharacterSummary"];
export type CharacterWithDerived = Schemas["CharacterWithDerived"];
export type CharacterPatch = Schemas["CharacterPatch"];
export type CharacterPortrait = Schemas["CharacterPortraitRead"];

export type DerivedSheet = Schemas["DerivedSheet"];
export type DerivedAbilities = Schemas["DerivedAbilities"];
export type DerivedArmorClass = Schemas["DerivedArmorClass"];
export type DerivedEncumbrance = Schemas["DerivedEncumbrance"];
export type DerivedSave = Schemas["DerivedSave"];
export type DerivedSaves = Schemas["DerivedSaves"];
export type DerivedSkill = Schemas["DerivedSkill"];
export type RuleWarning = Schemas["RuleWarning"];

export type SkillDefinition = Schemas["SkillDefinitionRead"];
/**
 * Not `SkillRow-Input`: the row holds no decimal, so its request and response schemas are
 * identical and FastAPI emits one `SkillRow` rather than splitting it. `ArmorRow` and
 * `PossessionRow` carry a weight and are still split.
 */
export type SkillRow = Schemas["SkillRow"];
export type ArmorRow = Schemas["ArmorRow-Input"];
export type AttackRow = Schemas["AttackRow"];
export type ClassLevelRow = Schemas["ClassLevelRow"];
export type PossessionRow = Schemas["PossessionRow-Input"];
export type NamedReference = Schemas["NamedReference"];

export type Ability = Schemas["Ability"];
export type ArmorSlot = Schemas["ArmorSlot"];
export type Problem = Schemas["Problem"];

/** The three saving throws, in the order the sheet prints them. */
export const SAVES = ["fortitude", "reflex", "will"] as const;
export type SaveName = (typeof SAVES)[number];

/**
 * The six abilities, in the order the sheet prints them.
 *
 * No display name here: the ability's name is translated, and lives under `ability.<key>` in the
 * dictionaries. `short` is the SRD's three-letter abbreviation and is not translated — it is the
 * value the API round-trips and what the `key_ability` column prints.
 */
export const ABILITIES = [
  { key: "strength", short: "STR" },
  { key: "dexterity", short: "DEX" },
  { key: "constitution", short: "CON" },
  { key: "intelligence", short: "INT" },
  { key: "wisdom", short: "WIS" },
  { key: "charisma", short: "CHA" },
] as const satisfies readonly {
  key: keyof DerivedAbilities;
  short: Ability;
}[];
