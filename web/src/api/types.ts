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

export type DerivedSheet = Schemas["DerivedSheet"];
export type DerivedAbilities = Schemas["DerivedAbilities"];
export type DerivedArmorClass = Schemas["DerivedArmorClass"];
export type DerivedEncumbrance = Schemas["DerivedEncumbrance"];
export type DerivedSave = Schemas["DerivedSave"];
export type DerivedSaves = Schemas["DerivedSaves"];
export type DerivedSkill = Schemas["DerivedSkill"];
export type RuleWarning = Schemas["RuleWarning"];

export type SkillDefinition = Schemas["SkillDefinitionRead"];
export type SkillRow = Schemas["SkillRow-Input"];
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

/** The six abilities, in the order the sheet prints them. */
export const ABILITIES = [
  { key: "strength", label: "Strength", short: "STR" },
  { key: "dexterity", label: "Dexterity", short: "DEX" },
  { key: "constitution", label: "Constitution", short: "CON" },
  { key: "intelligence", label: "Intelligence", short: "INT" },
  { key: "wisdom", label: "Wisdom", short: "WIS" },
  { key: "charisma", label: "Charisma", short: "CHA" },
] as const satisfies readonly {
  key: keyof DerivedAbilities;
  label: string;
  short: Ability;
}[];
