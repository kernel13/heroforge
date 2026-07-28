/**
 * The export path.
 *
 * The document itself is checked by rendering it — `pdf().toBlob()` runs the same layout engine the
 * browser does, so a component that hands react-pdf something it cannot lay out fails here rather
 * than in the user's download. What it deliberately does not do is assert on the glyphs: pinning
 * the visual result of a layout engine to a byte comparison makes every deliberate design change a
 * test failure with nothing to tell you.
 *
 * Both languages are rendered for real. The document takes its translator as a prop because
 * react-pdf's reconciler cannot reach a React context, and the failure mode of getting that wrong
 * — a `useI18n()` that throws inside the layout engine — only shows up when the document is
 * actually laid out.
 */
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { sortBySkillName, translatorFor } from "../i18n";
import { character, derivedSheet, derivedSkill, DEFINITIONS } from "../test/fixtures";
import { exportCharacterPdf, pdfFilename, renderCharacterPdf } from "./exportCharacterPdf";

const EN = translatorFor("en");
const FR = translatorFor("fr");

/** What `ExportPdfButton` passes down, with the language under test. */
const options = (translator = EN) => ({ translator, definitions: DEFINITIONS });

describe("naming the file", () => {
  it("uses the character's name", () => {
    expect(pdfFilename("Beorn Ironhand", EN)).toBe("Beorn Ironhand — character sheet.pdf");
  });

  it("falls back for a character that has not been named yet", () => {
    expect(pdfFilename("", EN)).toBe("character — character sheet.pdf");
    expect(pdfFilename("   ", EN)).toBe("character — character sheet.pdf");
    expect(pdfFilename(null, EN)).toBe("character — character sheet.pdf");
  });

  it("strips the separators a filesystem would read as a path", () => {
    expect(pdfFilename("Nine/Tenths: a \\ b", EN)).toBe(
      "Nine-Tenths- a - b — character sheet.pdf",
    );
  });

  it("names the file in the language the sheet was exported in", () => {
    // The name a download lands under is part of the interface: a French user should not have to
    // read "character sheet" to find the file they just asked for.
    expect(pdfFilename("Beorn Ironhand", FR)).toBe("Beorn Ironhand — feuille de personnage.pdf");
    expect(pdfFilename("", FR)).toBe("personnage — feuille de personnage.pdf");
  });
});

describe("rendering the document", () => {
  it("produces a PDF", async () => {
    const blob = await renderCharacterPdf(character(), derivedSheet(), options());
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("lays out a character carrying armour, skills, and possessions", async () => {
    const blob = await renderCharacterPdf(
      character({
        name: "Beorn Ironhand",
        armor: [
          {
            slot: "armor",
            name: "Full plate",
            type: "Heavy",
            ac_bonus: 8,
            max_dex: 1,
            check_penalty: -6,
            spell_failure: 35,
            speed: "20 ft.",
            weight: "50",
            special_properties: "Masterwork",
          },
        ],
        possessions: [{ item: "Backpack", page: "126", weight: "2" }],
        feats: [{ name: "Power Attack", page: "98" }],
        special_abilities: [{ name: "Darkvision 60 ft.", page: "15" }],
        languages: ["Common", "Dwarven"],
        class_levels: [{ class_name: "Fighter", level: 5, ordinal: 0 }],
        spells_raw: { notes: "Magic missile ×2" },
      }),
      derivedSheet({
        skills: [
          derivedSkill({ name: "Swim", key_ability: "STR", armor_check_penalty: -12, total: 1 }),
          derivedSkill({
            name: "Knowledge",
            specialization: "arcana",
            key_ability: "INT",
            usable_untrained: false,
            ranks: 3,
            total: 4,
          }),
        ],
      }),
      options(),
    );
    expect(blob.type).toBe("application/pdf");
  }, 20_000);

  it("renders a character with nothing filled in at all", async () => {
    const blob = await renderCharacterPdf(
      character({
        name: "",
        armor: [],
        attacks: [],
        possessions: [],
        feats: [],
        special_abilities: [],
        languages: [],
        class_levels: [],
        spells_raw: {},
      }),
      derivedSheet({ skills: [], warnings: [] }),
      options(),
    );
    expect(blob.size).toBeGreaterThan(1000);
  });

  /**
   * The French document is laid out for real, not asserted on: what this guards is that nothing
   * under the document reaches for a React context react-pdf has no way to provide, and that no
   * longer French string breaks a fixed-width column.
   */
  it("lays out the whole sheet in French", async () => {
    const blob = await renderCharacterPdf(
      character({
        name: "Beorn Ironhand",
        class_levels: [{ class_name: "Guerrier", level: 5, ordinal: 0 }],
        possessions: [{ item: "Sac à dos", page: "126", weight: "2" }],
        languages: ["Commun", "Nain"],
      }),
      derivedSheet({
        skills: [
          derivedSkill({ skill_id: 32, name: "Swim", key_ability: "STR", total: 1 }),
          derivedSkill({
            skill_id: 19,
            name: "Knowledge",
            specialization: "arcanes",
            key_ability: "INT",
            usable_untrained: false,
            ranks: 3,
            total: 4,
          }),
        ],
      }),
      options(FR),
    );
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
  }, 20_000);

  /**
   * Two spellcasting classes side by side, which is what the printed form has no room for.
   *
   * Laid out for real in both languages: the grid's five columns are a few points wide each, and
   * the French headings are abbreviated *because* of that — a translation that overflowed one of
   * them would push the column off the block, which is a thing only the layout engine can find.
   */
  it.each([
    ["English", EN],
    ["French", FR],
  ])("lays out two spellcasting classes side by side in %s", async (_language, translator) => {
    const caster = (class_name: string, domains: string) => ({
      class_name,
      domains,
      save_dc_mod: "+4",
      arcane_failure: "35",
      levels: [
        { spells: "Detect magic, Light", known: "4", save_dc: "14", per_day: "4", bonus: "" },
        { spells: "Magic missile", known: "3", save_dc: "15", per_day: "4", bonus: "1" },
        { spells: "", known: "", save_dc: "", per_day: "", bonus: "" },
      ],
    });
    const blob = await renderCharacterPdf(
      character({
        name: "Beorn Ironhand",
        class_levels: [
          { class_name: "Wizard", level: 4, ordinal: 0 },
          { class_name: "Cleric", level: 3, ordinal: 1 },
        ],
        spells_raw: {
          notes: "Spellbook left in the cart",
          casters: [caster("Wizard", "Evocation"), caster("Cleric", "War, Strength")],
        },
      }),
      derivedSheet(),
      options(translator),
    );
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
  }, 20_000);

  /**
   * The spellbook page, laid out for real with a book big enough to break across pages.
   *
   * A book is unbounded — this is the one part of the export that has no length the page can be
   * sized around — so what is being checked is that the layout engine paginates it instead of
   * clipping it, in both languages: `École` and a French spell name are wider than the English in
   * a half-page column.
   */
  it.each([
    ["English", EN],
    ["French", FR],
  ])("lays out a spellbook long enough to need a page break in %s", async (_language, translator) => {
    // Sixty spells, spread unevenly: level 1 alone is longer than a page column holds.
    const spellbook = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) =>
      Array.from({ length: level === 1 ? 24 : 4 }, (_, index) => ({
        name: `Sort de niveau ${level} numéro ${index + 1}`,
        school: "Enchantement (charme)",
        page: `${200 + index}`,
      })),
    );
    const blob = await renderCharacterPdf(
      character({ name: "Beorn Ironhand", spells_raw: { spellbook } }),
      derivedSheet(),
      options(translator),
    );
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
  }, 20_000);

  /**
   * Whether the third page exists at all, checked on the element tree rather than the bytes.
   *
   * A blank page headed SPELLBOOK on every non-caster's export is the defect this guards, and the
   * blob cannot be asked how many pages it has without the byte comparison this file's docstring
   * rules out.
   */
  it("adds the spellbook page only for a character who has scribed something", async () => {
    const { CharacterSheetDocument } = await import("./CharacterSheetDocument");
    const { Page } = await import("@react-pdf/renderer");
    const pages = (spells_raw: Record<string, unknown>) => {
      const document = CharacterSheetDocument({
        character: character({ spells_raw }),
        derived: derivedSheet(),
        translator: EN,
        definitions: DEFINITIONS,
      });
      const children = document.props.children as ReactNode[];
      return children.filter(
        (child) => isValidElement(child) && child.type === Page,
      ).length;
    };

    expect(pages({})).toBe(2);
    // A row a player added and never filled in is not a spell; a page of ruled blanks is not a
    // book. Same rule the entry lines apply one level down.
    expect(pages({ spellbook: [[{ name: "", school: "", page: "" }]] })).toBe(2);
    expect(pages({ spellbook: [[], [{ name: "Magic missile", school: "Evocation", page: "251" }]] })).toBe(3);
  });

  /**
   * The exported sheet is read at a table, next to the screen it came from. If the two disagree
   * about the order of forty skills, the printout is the one nobody trusts again.
   */
  it("orders the skill column the way the sheet does", async () => {
    const { CharacterSheetDocument } = await import("./CharacterSheetDocument");
    const skills = [
      derivedSkill({ skill_id: 32, name: "Swim", key_ability: "STR" }),
      derivedSkill({ skill_id: 16, name: "Hide", key_ability: "DEX" }),
      derivedSkill({ skill_id: 19, name: "Knowledge", key_ability: "INT" }),
    ];
    // Rendered rather than inspected: the ordering has to survive into the laid-out document.
    const { pdf } = await import("@react-pdf/renderer");
    const blob = await pdf(
      <CharacterSheetDocument
        character={character()}
        derived={derivedSheet({ skills })}
        translator={FR}
        definitions={DEFINITIONS}
      />,
    ).toBlob();
    expect(blob.type).toBe("application/pdf");

    // The rule itself, checked directly — the document applies this and nothing else.
    const ordered = sortBySkillName(skills, (skill) => skill.skill_id, DEFINITIONS, FR);
    expect(ordered.map((skill) => FR.skillName({ name: skill.name, name_fr: null }))).toEqual([
      "Knowledge",
      "Hide",
      "Swim",
    ]);
    expect(ordered.map((skill) => skill.skill_id)).toEqual([19, 16, 32]);
  }, 20_000);
});

describe("handing the file to the browser", () => {
  it("downloads it under the character's name and releases the object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:sheet");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const clicked: HTMLAnchorElement[] = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this);
      });

    try {
      await exportCharacterPdf(
        character({ name: "Beorn Ironhand" }),
        derivedSheet(),
        options(),
      );

      expect(click).toHaveBeenCalledOnce();
      expect(clicked[0]?.download).toBe("Beorn Ironhand — character sheet.pdf");
      expect(clicked[0]?.href).toContain("blob:sheet");
      expect(document.querySelector("a[download]")).toBeNull();

      await vi.waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:sheet"));
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
