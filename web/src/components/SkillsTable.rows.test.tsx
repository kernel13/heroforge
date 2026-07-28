/**
 * The rows of the skills table: the repeated SRD rows, and adding and removing a blank one.
 *
 * Two things are pinned here. The first is that every repeat of a skill the printed form gives
 * several rows to — Craft, Knowledge, Perform, Profession — is on screen. They carry identical
 * accessible names until someone types a specialisation, so a table that dropped one looks exactly
 * like a table that has them all until you count.
 *
 * The second is that removing a row removes *that* row. A row is identified by its position in
 * `draft.skills` and the table is sorted for display, so the two positions differ for every row
 * below the first out-of-order one; filtering on the sorted position deletes whichever skill
 * happened to sit there in the language on screen.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { SkillDefinition } from "../api/types";
import { renderIn } from "../test/render";
import { character, derivedSheet, derivedSkill, DEFINITIONS } from "../test/fixtures";
import { CharacterSheet } from "./CharacterSheet";

const PERFORM: SkillDefinition = {
  id: 23,
  name: "Perform",
  name_fr: "Représentation",
  key_ability: "CHA",
  armor_check_penalty: false,
  acp_double: false,
  usable_untrained: true,
  takes_specialization: true,
  sheet_rows: 3,
};

function row(skill_id: number | null, ordinal: number, over: Record<string, unknown> = {}) {
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

/** The skills panel, addressed by its heading so the rest of the sheet is out of the way. */
function table(): HTMLElement {
  const heading = screen.getByRole("heading", { name: /Skills|Compétences/ });
  return heading.closest("div")?.parentElement as HTMLElement;
}

beforeEach(() => {
  vi.spyOn(api, "derive").mockResolvedValue(derivedSheet());
  vi.spyOn(api, "patchCharacter").mockResolvedValue({
    character: character({ version: 2 }),
    derived: derivedSheet(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the repeated SRD rows", () => {
  it("shows one row per printed repeat, not one per skill", () => {
    renderIn(
      <CharacterSheet
        character={character({ skills: [row(23, 0), row(23, 1), row(23, 2)] })}
        initialDerived={derivedSheet({
          skills: [23, 23, 23].map((id) =>
            derivedSkill({ skill_id: id, name: "Perform", key_ability: "CHA" }),
          ),
        })}
        definitions={[...DEFINITIONS, PERFORM]}
        onBack={() => {}}
      />,
    );
    // Three, because the printed form gives Perform three lines. They are indistinguishable by
    // name, which is why this counts them rather than looking one up.
    expect(within(table()).getAllByLabelText("Perform ranks")).toHaveLength(3);
    expect(within(table()).getAllByLabelText("Perform specialisation")).toHaveLength(3);
  });
});

describe("a blank row", () => {
  it("can be removed again after it is added", async () => {
    const user = userEvent.setup();
    renderIn(
      <CharacterSheet
        character={character()}
        initialDerived={derivedSheet()}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
    );
    expect(within(table()).queryByLabelText("Skill name")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add a skill row" }));
    expect(within(table()).getByLabelText("Skill name")).toHaveValue("New skill");

    await user.click(screen.getByRole("button", { name: "Remove New skill" }));
    expect(within(table()).queryByLabelText("Skill name")).toBeNull();
  });

  it("removes the row it names and not the one in its place on screen", async () => {
    const user = userEvent.setup();
    // Stored Hide, the custom row, Swim — but custom rows sort last, so on screen the custom row
    // sits at position 2, where Swim is stored. Removing by the position on screen takes Swim.
    renderIn(
      <CharacterSheet
        character={character({
          skills: [
            row(16, 0),
            row(null, 1, { custom_name: "Aardvark lore", custom_key_ability: "INT" }),
            row(32, 2),
          ],
        })}
        initialDerived={derivedSheet({
          skills: [
            derivedSkill({ skill_id: 16, name: "Hide", key_ability: "DEX" }),
            derivedSkill({ skill_id: null, name: "Aardvark lore", key_ability: "INT" }),
            derivedSkill({ skill_id: 32, name: "Swim", key_ability: "STR" }),
          ],
        })}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove Aardvark lore" }));

    expect(within(table()).queryByLabelText("Skill name")).toBeNull();
    expect(within(table()).getByLabelText("Hide ranks")).toBeInTheDocument();
    expect(within(table()).getByLabelText("Swim ranks")).toBeInTheDocument();
  });

  it("is the only kind of row that offers to be removed", () => {
    // An SRD row is created once with the character and the sheet never reconciles the list; a
    // removable one would have to be synthesised back.
    renderIn(
      <CharacterSheet
        character={character({
          skills: [row(16, 0), row(null, 1, { custom_name: "Aardvark lore" })],
        })}
        initialDerived={derivedSheet({
          skills: [
            derivedSkill({ skill_id: 16, name: "Hide", key_ability: "DEX" }),
            derivedSkill({ skill_id: null, name: "Aardvark lore", key_ability: "INT" }),
          ],
        })}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
    );
    expect(within(table()).getAllByRole("button", { name: /^Remove/ })).toHaveLength(1);
    expect(within(table()).queryByRole("button", { name: "Remove Hide" })).toBeNull();
  });

  it("is not what a row pointing at a skill this build has never heard of becomes", () => {
    // Such a row has no definition and so wears the custom row's name input — which is exactly why
    // the gate reads `skill_id` and not the missing definition. Gating on the definition would arm
    // deletion of an SRD row against a bundle that is merely stale.
    renderIn(
      <CharacterSheet
        character={character({ skills: [row(999, 0)] })}
        initialDerived={derivedSheet({
          skills: [derivedSkill({ skill_id: 999, name: "Skill from a later seed" })],
        })}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
    );
    expect(within(table()).getByLabelText("Skill name")).toBeInTheDocument();
    expect(within(table()).queryByRole("button", { name: /^Remove/ })).toBeNull();
  });
});
