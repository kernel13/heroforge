/**
 * Switching languages.
 *
 * The sheet is addressed by accessible name everywhere, in both suites — so the thing worth
 * pinning is not that some heading changed, but that *the whole naming scheme* moves together:
 * panel headings, field labels, the aria-labels on derived outputs, and the skill names that come
 * from the server all have to be in the same language at once, or a French sheet becomes a sheet
 * nobody can query and no user can read.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { I18nProvider } from "../i18n";
import { renderIn } from "../test/render";
import { character, derivedSheet, derivedSkill, DEFINITIONS } from "../test/fixtures";
import { Auth } from "./Auth";
import { CharacterSheet } from "./CharacterSheet";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * A stored row pointing at a reference skill, with everything else left at zero.
 *
 * Deliberately unannotated: the generated schema has a separate input and output shape for a
 * skill row, and naming either of them here picks a fight with `character()`'s.
 */
function row(skill_id: number, ordinal = 0) {
  return {
    ordinal,
    skill_id,
    custom_name: null,
    custom_key_ability: null,
    specialization: null,
    ranks: 0,
    misc_modifier: 0,
    is_class_skill: false,
  };
}

// Ranked, because the total column is blank for a skill with no ranks in it.
const SKILLS = [
  derivedSkill({ skill_id: 16, name: "Hide", key_ability: "DEX", ranks: 2, total: 4 }),
  derivedSkill({ skill_id: 32, name: "Swim", key_ability: "STR", ranks: 2, total: 1 }),
];

function sheet(locale: "en" | "fr") {
  return renderIn(
    <CharacterSheet
      character={character({ skills: [row(16), row(32, 1)] })}
      initialDerived={derivedSheet({ skills: SKILLS })}
      definitions={DEFINITIONS}
      onBack={() => {}}
    />,
    locale,
  );
}

beforeEach(() => {
  vi.spyOn(api, "derive").mockResolvedValue(derivedSheet({ skills: SKILLS }));
  vi.spyOn(api, "patchCharacter").mockResolvedValue({
    character: character({ version: 2 }),
    derived: derivedSheet({ skills: SKILLS }),
  });
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the control", () => {
  it("offers both languages and says which one is on", async () => {
    renderIn(<LanguageSwitcher />, "en");
    const group = screen.getByRole("group", { name: "Choose a language" });

    expect(within(group).getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "Français" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("names each language in its own language, in either interface", () => {
    // A user who cannot read the current interface has to be able to find their own language in
    // it. "French" would be no help to the person who most needs the control.
    renderIn(<LanguageSwitcher />, "fr");
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Français" })).toBeInTheDocument();
  });

  it("switches the interface and remembers the choice", async () => {
    const user = userEvent.setup();
    // Not pinned: this is the case where the switcher actually has to change something.
    renderIn(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Français" }));

    expect(screen.getByRole("group", { name: "Choisir une langue" })).toBeInTheDocument();
    expect(window.localStorage.getItem("heroforge.locale")).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");
  });
});

describe("a message already on screen", () => {
  it("follows a language change instead of freezing in the language it was raised in", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "register").mockResolvedValue(undefined);
    renderIn(
      <I18nProvider>
        <Auth onSignedIn={() => {}} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("tab", { name: "Create an account" }));
    await user.type(screen.getByLabelText("Email"), "someone@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery-staple");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Check your email");

    // Reaching for the switcher right after registering is exactly when a French speaker would.
    // A notice held as a resolved string would be the one line on the card still in English.
    await user.click(screen.getByRole("button", { name: "Français" }));
    expect(screen.getByRole("status")).toHaveTextContent("Consultez votre boîte mail");
  });
});

describe("the sheet in French", () => {
  it("translates the panel headings", () => {
    sheet("fr");
    expect(screen.getByRole("heading", { name: "Caractéristiques" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Classe d'armure" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jets de sauvegarde" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Compétences" })).toBeInTheDocument();
  });

  it("translates the accessible name of a derived value, not only its heading", () => {
    // The output's *text* is the engine's number and must not change; only the name it is
    // addressed by does.
    sheet("fr");
    expect(screen.getByLabelText("Classe d'armure")).toHaveTextContent("12");
    expect(screen.getByLabelText("Total de Vigueur")).toHaveTextContent("+5");
    expect(screen.getByLabelText("Valeur de Dextérité")).toHaveValue(14);
  });

  it("names skills from the reference data, not from a dictionary", async () => {
    // Skill names are reference data: they arrive with `name_fr` on the definition and are looked
    // up by identifier, so a skill curated through sqladmin is translated without a frontend
    // release.
    sheet("fr");
    expect(screen.getByText("Discrétion")).toBeInTheDocument();
    expect(screen.getByLabelText("Total de Natation")).toHaveTextContent("+1");
    expect(screen.getByLabelText("Discrétion est une compétence de classe")).toBeInTheDocument();
  });

  it("falls back to the English name for a skill nobody has translated", () => {
    renderIn(
      <CharacterSheet
        character={character({ skills: [row(99)] })}
        initialDerived={derivedSheet({
          skills: [derivedSkill({ skill_id: 99, name: "Autohypnosis", key_ability: "WIS" })],
        })}
        definitions={[
          ...DEFINITIONS,
          {
            id: 99,
            name: "Autohypnosis",
            name_fr: null,
            key_ability: "WIS",
            armor_check_penalty: false,
            acp_double: false,
            usable_untrained: true,
            takes_specialization: false,
            sheet_rows: 1,
          },
        ]}
        onBack={() => {}}
      />,
      "fr",
    );
    // An untranslated skill still appears, under the name the engine knows it by.
    expect(screen.getByText("Autohypnosis")).toBeInTheDocument();
  });

  it("rebuilds a rules warning in French rather than showing the engine's English", () => {
    renderIn(
      <CharacterSheet
        character={character()}
        initialDerived={derivedSheet({
          warnings: [
            {
              code: "ranks_over_maximum",
              message: "Hide: 12 ranks exceeds the cross-class maximum of 5 at character level 7.",
              field: "skill-16",
              params: {
                skill_id: "16",
                skill_name: "Hide",
                kind: "cross_class",
                ranks: "12",
                max_ranks: "5",
                character_level: "7",
              },
            },
          ],
        })}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
      "fr",
    );

    // The skill is named from the reference data and the "cross-class" token is translated —
    // splicing the engine's English into a French sentence is exactly what `params` avoids.
    expect(
      screen.getByText("Discrétion : 12 rangs dépassent le maximum hors classe de 5 au niveau de personnage 7."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/cross-class/)).toBeNull();
  });

  it("leaves a param the engine renamed visible rather than silently blank", () => {
    // `fill()` prints an unmatched `{placeholder}` on purpose, and `RuleWarnings` must not undo
    // that with a `?? ""`. An engine that renames `max_ranks` should produce a line somebody
    // reports, not a sentence with a hole in it that reads as a translation error.
    renderIn(
      <CharacterSheet
        character={character()}
        initialDerived={derivedSheet({
          warnings: [
            {
              code: "ranks_over_maximum",
              message: "Hide: 12 ranks exceeds the cross-class maximum of 5.",
              field: "skill-16",
              params: { skill_id: "16", kind: "cross_class", ranks: "12" },
            },
          ],
        })}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
      "fr",
    );

    expect(screen.getByText(/\{max\}/)).toBeInTheDocument();
    expect(screen.getByText(/\{level\}/)).toBeInTheDocument();
    // The parts that did arrive are still translated and still named from the reference data.
    // Both in one assertion, on the warning's own line: "hors classe" is also the wording the
    // skills note uses for the cross-class rank maximum, and a bare /hors classe/ now matches
    // that paragraph too.
    expect(screen.getByText(/Discrétion : 12 rangs.*hors classe/)).toBeInTheDocument();
  });

  it("keeps the tab strip and both pages in the same language", async () => {
    const user = userEvent.setup();
    sheet("fr");

    await user.click(screen.getByRole("tab", { name: "Page 2" }));
    expect(screen.getByRole("heading", { name: "Possessions" })).toBeInTheDocument();
    // The load is the one derived figure whose *unit* is the reader's and not the engine's: the
    // engine returned 50 pounds and a French sheet reads 25 kg. The English case in
    // `CharacterSheet.test.tsx` still expects "50 lb.", which is what makes this locale-gated
    // rather than a conversion that leaked into the engine's own numbers.
    expect(screen.getByLabelText("Charge légère")).toHaveTextContent("25 kg");
    expect(screen.getByLabelText("Campagne")).toBeInTheDocument();
  });
});
