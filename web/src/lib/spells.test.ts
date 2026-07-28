/**
 * Reading and writing the spell block.
 *
 * `spells_raw` is a JSONB column with no server-side shape at all, which is deliberate — it holds
 * whatever a player writes until spellcasting gets a phase of its own. Everything that could be in
 * there therefore arrives here: a character saved before the blocks existed, one edited by a build
 * that stored something else, one whose `casters` is a string because somebody sent a `PATCH` by
 * hand. None of that may throw, and none of it may be silently thrown away.
 */
import { describe, expect, it } from "vitest";
import { translatorFor } from "../i18n";
import {
  casterIsEmpty,
  casterNames,
  emptyCaster,
  emptySpellbook,
  readSpellBook,
  writeSpellBook,
} from "./spells";

const EN = translatorFor("en").t;

describe("reading", () => {
  it("reads nothing out of nothing", () => {
    const empty = { notes: "", casters: [], spellbook: emptySpellbook(), rest: {} };
    expect(readSpellBook(undefined)).toEqual(empty);
    expect(readSpellBook({})).toEqual(empty);
  });

  it("keeps a character whose spells are the paragraph they always were", () => {
    expect(readSpellBook({ notes: "Cure light wounds ×3" }).notes).toBe("Cure light wounds ×3");
  });

  it("pads every caster to ten spell levels", () => {
    const book = readSpellBook({ casters: [{ class_name: "Bard", levels: [{ known: "4" }] }] });
    expect(book.casters[0]?.levels).toHaveLength(10);
    expect(book.casters[0]?.levels[0]?.known).toBe("4");
    expect(book.casters[0]?.levels[9]).toEqual({
      known: "",
      save_dc: "",
      per_day: "",
      bonus: "",
    });
  });

  it("refuses to trust anything in the column", () => {
    const book = readSpellBook({
      notes: 7,
      casters: [null, "Wizard", { class_name: 3, levels: "none" }],
    });
    expect(book.notes).toBe("");
    expect(book.casters).toHaveLength(3);
    expect(book.casters.every((caster) => caster.levels.length === 10)).toBe(true);
    expect(book.casters[2]?.class_name).toBe("");
  });

  it("does not read a caster list that is not a list", () => {
    expect(readSpellBook({ casters: "Wizard" }).casters).toEqual([]);
  });
});

describe("writing", () => {
  it("carries through the keys it did not recognise", () => {
    // Somebody's data, written by something else. Dropping it is the one unrecoverable outcome.
    const book = readSpellBook({ familiar: "Raven", notes: "in the cart" });
    expect(writeSpellBook({ ...book, notes: "found it" })).toEqual({
      familiar: "Raven",
      notes: "found it",
      casters: [],
      spellbook: emptySpellbook(),
    });
  });

  it("round-trips a book unchanged", () => {
    const raw = {
      notes: "n",
      casters: [{ ...emptyCaster(), class_name: "Sorcerer" }],
      spellbook: emptySpellbook(),
    };
    expect(writeSpellBook(readSpellBook(raw))).toEqual(raw);
  });
});

describe("naming a caster", () => {
  it("uses the class the player typed", () => {
    expect(
      casterNames([{ ...emptyCaster(), class_name: "Wizard" }], EN),
    ).toEqual(["Wizard"]);
  });

  it("falls back to the block's position when it is unnamed or repeated", () => {
    // Every one of a block's fifty-odd controls is named from this, so two blocks answering to the
    // same string is not a cosmetic problem: it is a `getByLabelText` that throws.
    expect(
      casterNames(
        [
          { ...emptyCaster(), class_name: "Wizard" },
          { ...emptyCaster(), class_name: "Wizard" },
          emptyCaster(),
        ],
        EN,
      ),
    ).toEqual(["Wizard (1)", "Wizard (2)", "Spellcasting class 3"]);
  });
});

describe("an empty caster", () => {
  it("is the one the export leaves out", () => {
    expect(casterIsEmpty(emptyCaster())).toBe(true);
    expect(casterIsEmpty({ ...emptyCaster(), class_name: "Druid" })).toBe(false);

    const withOneFigure = emptyCaster();
    withOneFigure.levels[3] = { ...withOneFigure.levels[3]!, per_day: "2" };
    expect(casterIsEmpty(withOneFigure)).toBe(false);
  });
});
