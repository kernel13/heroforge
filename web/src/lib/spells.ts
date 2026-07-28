/**
 * The shape the sheet keeps inside `spells_raw`.
 *
 * `spells_raw` is JSONB on the server and `{ [key: string]: unknown }` in the generated schema —
 * deliberately so, because spellcasting is a later phase and the column exists to hold whatever a
 * player writes until then. That freedom is what this module fences: the parser reads a shape out
 * of an untyped object without ever trusting it, and the writer puts one back **without dropping
 * the keys it did not recognise**. The free-text `notes` predates the structured blocks and is
 * still edited beside them; a character whose only spell data is that paragraph must not lose it
 * the first time someone adds a caster.
 *
 * **Nothing here is derived.** Spells known, save DC, spells per day and bonus spells are typed,
 * exactly as the base attack bonus and the base saves are — deriving them needs class progression
 * and ability reference data that phase 1 does not have. They are held as *strings* for the reason
 * `DecimalField` holds decimals as strings: a blank box is a real value on this form, and a
 * `number` field would write a `0` into fifty boxes that the player never filled in.
 *
 * Parsing happens on read, in render. It must never write back a canonicalised copy — an `update()`
 * from a render or an effect advances the sheet's edit counter every pass, which re-arms the 250 ms
 * derive and restarts the 2 s save timer forever. `useSheet.ts` says so and a Vitest case guards it.
 */

import type { TranslationKey, Translator } from "../i18n";

/** Spell levels 0 through 9, the rows of the paper form's grid. */
export const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type SpellLevel = (typeof SPELL_LEVELS)[number];

/** One row of one caster's grid: the four figures the form asks for at that spell level. */
export interface SpellLevelRow {
  known: string;
  save_dc: string;
  per_day: string;
  bonus: string;
}

/**
 * One spellcasting class.
 *
 * `class_name` is typed rather than chosen from the character's class levels: which of a
 * character's classes casts spells is class reference data, which is phase 2. A player who is a
 * Wizard 4 / Rogue 3 writes "Wizard" here, and a Mystic Theurge writes both blocks out.
 */
export interface SpellCaster {
  class_name: string;
  /** The form's DOMAINS/SPECIALTY SCHOOL line. */
  domains: string;
  /** The form's DC MOD box, beside SPELL SAVE. */
  save_dc_mod: string;
  /** The form's ARCANE SPELL FAILURE box, in per cent. */
  arcane_failure: string;
  /** Always ten rows, indexed by spell level. */
  levels: SpellLevelRow[];
}

/**
 * One spell written into the book.
 *
 * Strings for the reason every other figure here is a string: a blank box is a real value on this
 * form. `page` is the rulebook reference, the same column the feats and special-abilities lists
 * carry under the heading `Pg.`
 */
export interface SpellbookEntry {
  name: string;
  school: string;
  page: string;
}

/**
 * The book itself: **exactly ten groups, indexed by spell level**, as `SpellCaster.levels` is
 * exactly ten rows.
 *
 * Making the level the *position* rather than a field on the entry is what keeps a spell level out
 * of the data a player can get wrong. There is no level to parse, no level to validate, and no way
 * to store a spell at level 12 — the shape of the book is the constraint. Padding is the same
 * discipline `readLevels` applies, and for the same reason: a book written by an older build, or by
 * hand, must not leave the component indexing past the end of an array.
 *
 * Within a level the entries are in the order the player added them. Nothing sorts them: a row that
 * re-sorted itself as its name was typed would jump out from under the cursor of the person naming
 * it, which is the rule `SkillsTable` states for its custom rows.
 */
export type Spellbook = SpellbookEntry[][];

export interface SpellBook {
  /** The free-text paragraph the panel has always carried. */
  notes: string;
  casters: SpellCaster[];
  /** The wizard's book — page three's table. Ten groups, one per spell level. */
  spellbook: Spellbook;
  /** Anything else already in `spells_raw`, carried through untouched. */
  rest: Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function emptyLevelRow(): SpellLevelRow {
  return { known: "", save_dc: "", per_day: "", bonus: "" };
}

export function emptyCaster(): SpellCaster {
  return {
    class_name: "",
    domains: "",
    save_dc_mod: "",
    arcane_failure: "",
    levels: SPELL_LEVELS.map(() => emptyLevelRow()),
  };
}

function readLevels(value: unknown): SpellLevelRow[] {
  const rows = Array.isArray(value) ? value : [];
  // Exactly ten, whatever was stored: the grid is a fixed form, and a caster written by an older
  // build — or by hand — must not leave the component indexing past the end of an array.
  return SPELL_LEVELS.map((level) => {
    const row = rows[level];
    if (row === null || typeof row !== "object") return emptyLevelRow();
    const record = row as Record<string, unknown>;
    return {
      known: asString(record.known),
      save_dc: asString(record.save_dc),
      per_day: asString(record.per_day),
      bonus: asString(record.bonus),
    };
  });
}

export function emptySpellbookEntry(): SpellbookEntry {
  return { name: "", school: "", page: "" };
}

export function emptySpellbook(): Spellbook {
  return SPELL_LEVELS.map(() => []);
}

function readSpellbookEntry(value: unknown): SpellbookEntry {
  if (value === null || typeof value !== "object") return emptySpellbookEntry();
  const record = value as Record<string, unknown>;
  return {
    name: asString(record.name),
    school: asString(record.school),
    page: asString(record.page),
  };
}

function readSpellbook(value: unknown): Spellbook {
  const groups = Array.isArray(value) ? value : [];
  // Ten groups whatever was stored, and anything at an eleventh position is dropped rather than
  // rendered: there is no eleventh spell level to draw it at.
  return SPELL_LEVELS.map((level) => {
    const group = groups[level];
    return Array.isArray(group) ? group.map(readSpellbookEntry) : [];
  });
}

function readCaster(value: unknown): SpellCaster {
  if (value === null || typeof value !== "object") return emptyCaster();
  const record = value as Record<string, unknown>;
  return {
    class_name: asString(record.class_name),
    domains: asString(record.domains),
    save_dc_mod: asString(record.save_dc_mod),
    arcane_failure: asString(record.arcane_failure),
    levels: readLevels(record.levels),
  };
}

/** Reads the block out of a character's `spells_raw`, tolerating anything that is in there. */
export function readSpellBook(raw: Record<string, unknown> | null | undefined): SpellBook {
  // Every key this module understands comes out of `rest` here. A recognised key left in `rest`
  // would be written twice by `writeSpellBook` — once from the spread and once from the field —
  // and the spread losing that race would silently restore whatever was in the column before.
  const { notes, casters, spellbook, ...rest } = raw ?? {};
  return {
    notes: asString(notes),
    casters: Array.isArray(casters) ? casters.map(readCaster) : [],
    spellbook: readSpellbook(spellbook),
    rest,
  };
}

/**
 * Puts a block back, with the unrecognised keys where they were.
 *
 * The result is what a `PATCH` and the next `/api/derive` body will carry, so it is a plain
 * JSON-shaped object and nothing else.
 */
export function writeSpellBook(book: SpellBook): Record<string, unknown> {
  return { ...book.rest, notes: book.notes, casters: book.casters, spellbook: book.spellbook };
}

/** A spell level's own name. Never `${level}${suffix}`: “1st” and “1er” are language, not maths. */
export function spellLevelKey(level: number): TranslationKey {
  return `spells.level.${level as SpellLevel}` as const;
}

/**
 * What to call each caster — in a `<legend>`, in a PDF heading, and inside every one of its
 * controls' accessible names.
 *
 * A caster is named by the class the player typed, which is the only thing on the block that tells
 * two of them apart. But that name can be blank, and two blocks can carry the same one, and each
 * block puts its name into fifty-odd `aria-label`s: a collision there is not a cosmetic problem but
 * a `getByLabelText` that throws instead of resolving, which is the failure this repository
 * arranges the whole sheet to avoid. So a name is used **only when it is both filled in and unique
 * among the casters**; otherwise the block's position on the panel disambiguates it.
 */
export function casterNames(casters: SpellCaster[], t: Translator["t"]): string[] {
  const counts = new Map<string, number>();
  for (const caster of casters) {
    const name = caster.class_name.trim();
    if (name !== "") counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return casters.map((caster, index) => {
    const name = caster.class_name.trim();
    if (name === "") return t("spells.caster.unnamed", { n: index + 1 });
    if ((counts.get(name) ?? 0) > 1) return t("spells.caster.numbered", { name, n: index + 1 });
    return name;
  });
}

/** Whether a caster carries anything at all — what decides if the export prints its block. */
export function casterIsEmpty(caster: SpellCaster): boolean {
  return (
    caster.class_name === "" &&
    caster.domains === "" &&
    caster.save_dc_mod === "" &&
    caster.arcane_failure === "" &&
    caster.levels.every(
      (row) =>
        row.known === "" &&
        row.save_dc === "" &&
        row.per_day === "" &&
        row.bonus === "",
    )
  );
}
