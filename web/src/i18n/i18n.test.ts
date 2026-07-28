/**
 * The dictionaries, and the translator over them.
 *
 * `fr.ts` is typed as `Dictionary`, so a missing key is already a compile error — but a compile
 * error is only as good as the annotation, and an `as Dictionary` added in a hurry would silence
 * it. These check the same properties at runtime, where no annotation can lie, and add the one
 * thing the type cannot express at all: that a translation's `{placeholders}` match its original's.
 * A French sentence that spells `{max}` as `{maximum}` type-checks perfectly and renders the brace.
 */
import { describe, expect, it } from "vitest";
import { en } from "./en";
import { fr } from "./fr";
import { LOCALES, translatorFor } from "./translate";

const placeholders = (template: string): string[] =>
  [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string).sort();

describe("the French dictionary", () => {
  it("covers every key English has, and adds none of its own", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it("actually translates, rather than copying the English through", () => {
    // A handful of keys are the same word in both languages and legitimately identical.
    const IDENTICAL = new Set([
      "language.en",
      "language.fr",
      "language.en.short",
      "language.fr.short",
      "sheet.page1",
      "sheet.page2",
      "sheet.page3",
      // "Portrait" is the same word in French — the frame's alt text, not the sentence beside it.
      "sheet.portrait",
      "hp.total",
      "saves.head.base",
      // "Base" is the same word in French, in the rail as in the saves table.
      "rail.parts.base",
      "skills.head.total",
      "pdf.field.base",
      "field.race",
      "field.alignment",
      "field.campaign",
      "ability.constitution",
      "ability.intelligence",
      "money.platinum",
      "possessions.head.page",
      "lists.head.page",
      "gear.type",
      "attacks.type",
      "attacks.notes",
      "pdf.blank",
      "pdf.classFallback",
      "pdf.field.deflection",
      "classLevels.class",
      "hp.current",
      "skills.head.class",
      "pdf.field.armour",
      "pdf.section.money",
      "panel.possessions",
      "init.initiative",
      "pdf.page.label",
      // Proper names, not words: an edition of the SRD and the title of a licence.
      "app.srd",
      "app.srdLicence",
      // An SI symbol. It is "kg" in every language that uses it, which is the point of a symbol.
      "unit.kg",
      // "Notes" is the same word in French, on the panel as in the export.
      "spells.notes.label",
      "pdf.spells.notesHeading",
      // An em dash standing in for a level no class has been typed for yet. Punctuation.
      "characters.levelUnset",
      // Punctuation around two placeholders, and the digit zero: neither is a word to translate.
      // Every *other* spell level is an ordinal and differs — "1st" against "1er".
      "spells.caster.numbered",
      "spells.level.0",
    ]);
    const copied = Object.keys(en).filter(
      (key) =>
        !IDENTICAL.has(key) && fr[key as keyof typeof fr] === en[key as keyof typeof en],
    );
    expect(copied).toEqual([]);
  });

  it("keeps the same placeholders in every translated sentence", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(fr[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe("the translator", () => {
  it("fills placeholders and leaves an unsupplied one visible", () => {
    const { t } = translatorFor("en");
    expect(t("sheet.characterLevel", { level: 7 })).toBe("Character level 7");
    // Visible, not blank: a gap is a bug nobody reports.
    expect(t("sheet.characterLevel")).toBe("Character level {level}");
  });

  it("names a skill from the reference row, falling back to English", () => {
    const { skillName } = translatorFor("fr");
    expect(skillName({ name: "Hide", name_fr: "Discrétion" })).toBe("Discrétion");
    expect(skillName({ name: "Autohypnosis", name_fr: null })).toBe("Autohypnosis");
  });

  it("gives English its English name even where a French one exists", () => {
    // `name` is the row's identity — the name the rules engine is handed — not a fallback that
    // a translation should shadow.
    const { skillName } = translatorFor("en");
    expect(skillName({ name: "Hide", name_fr: "Discrétion" })).toBe("Hide");
  });

  it("leaves an English weight in the pounds the engine works in", () => {
    const { weight, weightNumber } = translatorFor("en");
    expect(weight(50)).toBe("50 lb.");
    expect(weight("148.5")).toBe("148.5 lb.");
    // Untouched, not reformatted: the engine's own string is what English has always printed.
    expect(weightNumber("148.5")).toBe("148.5");
  });

  it("writes a French weight in kilograms, with the separator French reads", () => {
    const { weight, weightNumber } = translatorFor("fr");
    expect(weight(50)).toBe("25 kg");
    expect(weight("300")).toBe("150 kg");
    expect(weightNumber(150)).toBe("75");
    // Halving lands on a half kilogram, and French writes that with a comma.
    expect(weight("149")).toBe("74,5 kg");
    // Four figures are reachable — a Strength-20 character pushes 2000 lb — and are *not* grouped.
    // French grouping is U+202F, which the PDF's body font need not have a glyph for, and English
    // has never grouped a weight. Written as a literal so a regression is a diff, not a mystery.
    expect(weight(2000)).toBe("1000 kg");
  });

  it("keeps a weight it cannot read as a number in the unit it arrived in", () => {
    // Relabelling an unparseable figure `kg` is the one failure worth avoiding: a wrong number is
    // visible on the page, a right number under the wrong unit is not.
    const { weight } = translatorFor("fr");
    expect(weight("")).toBe(" lb");
    expect(weight("—")).toBe("— lb");
  });

  it("offers a translator for every locale it advertises", () => {
    for (const locale of LOCALES) {
      expect(translatorFor(locale).locale).toBe(locale);
    }
  });
});
