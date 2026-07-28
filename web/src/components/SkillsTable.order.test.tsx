/**
 * The order the skills table is read in.
 *
 * Two separate things are pinned here, and the second is the one a plausible implementation gets
 * wrong. The first is that the list is alphabetical *in the language on screen* — the stored order
 * is the English alphabet, which read in French is no order at all.
 *
 * The second is that sorting is display only. A row is identified by its position in
 * `draft.skills`: that position pairs it with its `DerivedSkill` and it is what a write targets.
 * Sorting the rows and then using the *sorted* position for either attributes one skill's total to
 * another and types a rank into the wrong row — and both failures look like the rules engine is
 * broken rather than like the table is.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { SkillDefinition } from "../api/types";
import { I18nProvider } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { renderIn } from "../test/render";
import { character, derivedSheet, derivedSkill, DEFINITIONS } from "../test/fixtures";
import { CharacterSheet } from "./CharacterSheet";

function definition(over: Partial<SkillDefinition> & Pick<SkillDefinition, "id" | "name">) {
  return {
    name_fr: null,
    key_ability: "INT",
    armor_check_penalty: false,
    acp_double: false,
    usable_untrained: true,
    takes_specialization: false,
    sheet_rows: 1,
    ...over,
  } as SkillDefinition;
}

function row(skill_id: number, ordinal: number, over: Record<string, unknown> = {}) {
  return {
    ordinal,
    skill_id,
    custom_name: null,
    custom_key_ability: null,
    specialization: null,
    ranks: 0,
    misc_modifier: 0,
    is_class_skill: false,
    ...over,
  };
}

/**
 * Distinct totals, so a row wearing another row's derived values is visible immediately.
 *
 * Each carries ranks because the total column is blank for an unranked skill — a fixture of
 * rankless rows would show three empty totals and pin nothing.
 */
const DERIVED = [
  derivedSkill({ skill_id: 16, name: "Hide", key_ability: "DEX", ranks: 5, total: 7 }),
  derivedSkill({ skill_id: 19, name: "Knowledge", key_ability: "INT", ranks: 5, total: 8 }),
  derivedSkill({ skill_id: 32, name: "Swim", key_ability: "STR", ranks: 5, total: 9 }),
];

function sheet(locale: "en" | "fr", overrides: Record<string, unknown> = {}) {
  return renderIn(
    <CharacterSheet
      character={character({
        skills: [row(16, 0), row(19, 1), row(32, 2)],
        ...overrides,
      })}
      initialDerived={derivedSheet({ skills: DERIVED })}
      definitions={DEFINITIONS}
      onBack={() => {}}
    />,
    locale,
  );
}

/**
 * The name shown in each row, top to bottom.
 *
 * Reads the name element itself rather than the cell's text: the cell also carries the `*` and `T`
 * markers, and a specialisation input, none of which are part of the name being ordered by.
 */
function namesOnScreen(): string[] {
  const table = screen
    .getByRole("heading", { name: /Skills|Compétences/ })
    .closest("div")?.parentElement;
  const rows = within(table as HTMLElement).getAllByRole("row").slice(1);
  return rows.map((tr) => {
    const cell = within(tr).getAllByRole("cell")[1];
    const named = cell?.querySelector("span > span");
    if (named !== null && named !== undefined) return named.textContent?.trim() ?? "";
    return cell?.querySelector("input")?.value ?? "";
  });
}

beforeEach(() => {
  vi.spyOn(api, "derive").mockResolvedValue(derivedSheet({ skills: DERIVED }));
  vi.spyOn(api, "patchCharacter").mockResolvedValue({
    character: character({ version: 2 }),
    derived: derivedSheet({ skills: DERIVED }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reading order", () => {
  it("is the alphabet of the language on screen, not of the stored order", () => {
    sheet("fr");
    // Stored Hide, Knowledge, Swim — shown Connaissances, Discrétion, Natation.
    expect(namesOnScreen()).toEqual(["Connaissances", "Discrétion", "Natation"]);
  });

  it("is alphabetical in English too", () => {
    sheet("en");
    expect(namesOnScreen()).toEqual(["Hide", "Knowledge", "Swim"]);
  });

  it("re-sorts when the language changes rather than keeping the old alphabet", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    // An unpinned provider, with the switcher beside the sheet: this is the one case where the
    // language has to actually change rather than be fixed at render.
    render(
      <I18nProvider>
        <LanguageSwitcher />
        <CharacterSheet
          character={character({ skills: [row(16, 0), row(19, 1), row(32, 2)] })}
          initialDerived={derivedSheet({ skills: DERIVED })}
          definitions={DEFINITIONS}
          onBack={() => {}}
        />
      </I18nProvider>,
    );
    expect(namesOnScreen()).toEqual(["Hide", "Knowledge", "Swim"]);

    await user.click(screen.getByRole("button", { name: "Français" }));
    expect(namesOnScreen()).toEqual(["Connaissances", "Discrétion", "Natation"]);
  });

  it("sorts accented names under their base letter, as French collation requires", () => {
    // Naive code-point ordering puts every accented capital after Z, which would strand
    // Équilibre, Équitation, and Évasion in a block at the bottom of the table. The two É names
    // also have to order against each other by their *second* letter, which is the part a
    // strip-the-accent shortcut gets right by accident and a code-point sort gets wrong.
    renderIn(
      <CharacterSheet
        character={character({ skills: [row(11, 0), row(12, 1), row(2, 2)] })}
        initialDerived={derivedSheet({
          skills: [
            derivedSkill({ skill_id: 11, name: "Escape Artist", key_ability: "DEX" }),
            derivedSkill({ skill_id: 12, name: "Forgery", key_ability: "INT" }),
            derivedSkill({ skill_id: 2, name: "Balance", key_ability: "DEX" }),
          ],
        })}
        definitions={[
          definition({ id: 11, name: "Escape Artist", name_fr: "Évasion", key_ability: "DEX" }),
          definition({ id: 12, name: "Forgery", name_fr: "Falsification" }),
          definition({ id: 2, name: "Balance", name_fr: "Équilibre", key_ability: "DEX" }),
        ]}
        onBack={() => {}}
      />,
      "fr",
    );
    expect(namesOnScreen()).toEqual(["Équilibre", "Évasion", "Falsification"]);
  });
});

describe("custom rows", () => {
  it("stay at the bottom instead of sorting into the alphabet by what was typed", () => {
    // The paper sheet keeps its blank rows at the bottom — and a row that re-sorts on every
    // keystroke jumps out from under the cursor of the person naming it.
    renderIn(
      <CharacterSheet
        character={character({
          skills: [
            row(16, 0),
            { ...row(0, 1), skill_id: null, custom_name: "Aardvark lore", custom_key_ability: "INT" },
            row(32, 2),
          ],
        })}
        initialDerived={derivedSheet({
          skills: [
            DERIVED[0]!,
            derivedSkill({ skill_id: null, name: "Aardvark lore", key_ability: "INT" }),
            DERIVED[2]!,
          ],
        })}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
      "fr",
    );
    const names = namesOnScreen();
    expect(names.slice(0, 2)).toEqual(["Discrétion", "Natation"]);
    expect(names[2]).toContain("Aardvark lore");
  });
});

describe("sorting is display only", () => {
  it("keeps each row's derived total with the row it belongs to", () => {
    sheet("fr");
    // Hide is stored first and shown second. Its total must follow the skill, not the position.
    expect(screen.getByLabelText("Total de Discrétion")).toHaveTextContent("+7");
    expect(screen.getByLabelText("Total de Connaissances")).toHaveTextContent("+8");
    expect(screen.getByLabelText("Total de Natation")).toHaveTextContent("+9");
  });

  it("writes an edit to the row that was edited, not to the one in that display position", async () => {
    const user = userEvent.setup();
    sheet("fr");

    // Connaissances is shown first but stored second. A sort that leaked into the write path
    // would put these ranks on Discrétion — the row that is stored first.
    await user.clear(screen.getByLabelText("Rangs de Connaissances"));
    await user.type(screen.getByLabelText("Rangs de Connaissances"), "5");

    expect(screen.getByLabelText("Rangs de Connaissances")).toHaveValue(5);
    expect(screen.getByLabelText("Rangs de Discrétion")).toHaveValue(0);
    expect(screen.getByLabelText("Rangs de Natation")).toHaveValue(0);
  });

  it("ticks the class-skill box of the row it was clicked on", async () => {
    const user = userEvent.setup();
    sheet("fr");

    await user.click(screen.getByLabelText("Connaissances est une compétence de classe"));

    expect(screen.getByLabelText("Connaissances est une compétence de classe")).toBeChecked();
    expect(screen.getByLabelText("Discrétion est une compétence de classe")).not.toBeChecked();
  });

  it("sends the rows to the server in their stored order, unsorted", async () => {
    const user = userEvent.setup();
    sheet("fr");

    await user.clear(screen.getByLabelText("Rangs de Connaissances"));
    await user.type(screen.getByLabelText("Rangs de Connaissances"), "5");

    await vi.waitFor(() => expect(api.derive).toHaveBeenCalled());
    const body = vi.mocked(api.derive).mock.calls.at(-1)?.[0] as {
      skills: { skill_id: number | null; ranks: number }[];
    };
    // Stored order is the reference order, and `ordinal` is untouched: display order is not
    // something the sheet persists or something the engine is told about.
    expect(body.skills.map((skill) => skill.skill_id)).toEqual([16, 19, 32]);
    expect(body.skills[1]?.ranks).toBe(5);
  });

  it("reads an emptied ranks field as zero ranks, and sends a number", async () => {
    const user = userEvent.setup();
    sheet("fr");

    /** The ranks the latest `POST /api/derive` carried for the row stored at `index`. */
    const ranksSent = (index: number) => {
      const body = vi.mocked(api.derive).mock.calls.at(-1)?.[0] as {
        skills: { ranks: number }[];
      };
      return body.skills[index]?.ranks;
    };

    // A `type="number"` input reports `""` for an empty field, and `Number("")` is 0. That is the
    // deliberate reading — an emptied rank column means no ranks, as it already does for the misc
    // column beside it — and it is pinned here because the alternative is a `NaN` reaching the
    // draft, where it would serialise as `null` and 422 the save two seconds later.
    // Ranked first, so clearing is a real transition rather than a no-op the row started in.
    await user.type(screen.getByLabelText("Rangs de Connaissances"), "4");
    await vi.waitFor(() =>
      expect(ranksSent(1)).toBe(4),
    );

    await user.clear(screen.getByLabelText("Rangs de Connaissances"));

    expect(screen.getByLabelText("Rangs de Connaissances")).toHaveValue(0);
    await vi.waitFor(() => expect(ranksSent(1)).toBe(0));
  });
});
