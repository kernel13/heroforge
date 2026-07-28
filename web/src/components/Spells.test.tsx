/**
 * The spellcasting blocks.
 *
 * Three things are pinned here. The first is that what a player types lands in `spells_raw` under
 * the structured shape and nothing else in that column is disturbed — the free-text notes have
 * been there since before the blocks existed, and a character whose spells are a paragraph must
 * not lose it the first time someone adds a caster.
 *
 * The second is that every control of every block has an accessible name of its own. A caster is
 * named by the class the player typed, and a block carries fifty-odd labelled controls; two blocks
 * that both said "spells per day, level 3" would make `getByLabelText` throw rather than fail
 * legibly, which is what the whole sheet is arranged to avoid.
 *
 * The third is that a spell level is written, not assembled: "1st" is an English ordinal and "1er"
 * is a French one, and neither is `${n}` plus a suffix a component made up.
 */
import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CharacterBody } from "../api/types";
import type { Locale } from "../i18n";
import { readSpellBook } from "../lib/spells";
import { renderIn } from "../test/render";
import { character } from "../test/fixtures";
import { SpellsBlock } from "./Spells";

/** The panel with a draft behind it, and the stored column readable beside it. */
function Harness({ initial }: { initial?: Record<string, unknown> }) {
  const [draft, setDraft] = useState<CharacterBody>(character({ spells_raw: initial ?? {} }));
  return (
    <>
      <SpellsBlock
        draft={draft}
        update={(changes) => setDraft((current) => ({ ...current, ...changes }))}
      />
      <pre data-testid="raw">{JSON.stringify(draft.spells_raw)}</pre>
    </>
  );
}

function stored(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId("raw").textContent ?? "{}") as Record<string, unknown>;
}

function renderPanel(initial?: Record<string, unknown>, locale: Locale = "en") {
  return renderIn(<Harness initial={initial} />, locale);
}

const WIZARD = {
  class_name: "Wizard",
  domains: "Evocation",
  save_dc_mod: "+4",
  arcane_failure: "0",
  levels: [
    { known: "4", save_dc: "14", per_day: "4", bonus: "" },
    { known: "3", save_dc: "15", per_day: "4", bonus: "1" },
  ],
};

describe("adding a spellcasting class", () => {
  it("writes an empty block with all ten spell levels", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Add a spellcasting class" }));

    const book = readSpellBook(stored());
    expect(book.casters).toHaveLength(1);
    expect(book.casters[0]?.levels).toHaveLength(10);
    // Nothing is filled in for the player: every figure on this form is typed, not derived.
    expect(book.casters[0]?.levels.every((row) => row.per_day === "")).toBe(true);
  });

  it("names its controls by the class until one is typed", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Add a spellcasting class" }));

    // What the block *shows* while it is unnamed is the prompt; what it is *named* is its
    // position. The two are deliberately different, and collapsing them is the obvious tidy-up:
    // the prompt on fifty controls would make two blank blocks answer to the same words.
    expect(screen.getByText("Enter your class")).toBeVisible();
    expect(screen.getByLabelText("Spellcasting class 1 spells per day, level 3")).toBeVisible();

    // The class is typed in the block's own legend, behind the rename control — there is no field
    // for it under the legend, because the legend is where the block is named.
    await user.click(screen.getByRole("button", { name: "Rename Spellcasting class 1" }));
    await user.type(screen.getByLabelText("Spellcasting class 1"), "Cleric");

    expect(screen.getByLabelText("Cleric spells per day, level 3")).toBeVisible();
  });
});

describe("naming a block from its legend", () => {
  it("shows the class in the legend and lands what is typed in the stored block", async () => {
    const user = userEvent.setup();
    renderPanel({ casters: [WIZARD] });

    const legend = screen.getByRole("group", { name: /Wizard/ }).querySelector("legend");
    expect(legend?.textContent).toContain("Wizard");

    await user.click(screen.getByRole("button", { name: "Rename Wizard" }));
    await user.type(screen.getByLabelText("Spellcasting class 1"), " of Fire");

    expect(readSpellBook(stored()).casters[0]?.class_name).toBe("Wizard of Fire");
    // The name follows the typing, so every control the block owns is renamed with it.
    expect(screen.getByLabelText("Wizard of Fire spells known, level 0")).toBeVisible();
  });

  it("closes the editor on Enter and gives each block a rename control of its own", async () => {
    const user = userEvent.setup();
    renderPanel({ casters: [WIZARD, { ...WIZARD, class_name: "Cleric" }] });

    expect(screen.getAllByRole("button", { name: /^Rename/ })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Rename Cleric" }));
    expect(screen.getByLabelText("Spellcasting class 2")).toBeVisible();

    await user.keyboard("{Enter}");

    expect(screen.queryByLabelText("Spellcasting class 2")).toBeNull();
    // Focus goes back to the control the editor was opened from: the input has just left the tree
    // and a keyboard user would otherwise land nowhere.
    expect(screen.getByRole("button", { name: "Rename Cleric" })).toHaveFocus();
  });
});

describe("what a player types", () => {
  it("lands in the stored block", async () => {
    const user = userEvent.setup();
    renderPanel({ casters: [WIZARD] });

    await user.type(screen.getByLabelText("Wizard save DC, level 2"), "16");
    await user.type(screen.getByLabelText("Wizard spells per day, level 2"), "2");
    await user.clear(screen.getByLabelText("Wizard domains / specialty school"));
    await user.type(screen.getByLabelText("Wizard domains / specialty school"), "Conjuration");

    const caster = readSpellBook(stored()).casters[0];
    expect(caster?.levels[2]).toMatchObject({ save_dc: "16", per_day: "2" });
    expect(caster?.domains).toBe("Conjuration");
    // The rows either side are untouched — a level is edited by its own index.
    expect(caster?.levels[1]?.per_day).toBe("4");
    expect(caster?.levels[3]?.per_day).toBe("");
  });

  it("keeps the free-text notes and anything else already in the column", async () => {
    const user = userEvent.setup();
    // `familiar` is not a key this build knows. It is somebody's data all the same.
    renderPanel({ notes: "Spellbook is in the cart", familiar: "Raven", casters: [WIZARD] });

    await user.type(screen.getByLabelText("Wizard spells known, level 0"), "9");

    expect(stored()).toMatchObject({
      notes: "Spellbook is in the cart",
      familiar: "Raven",
    });
  });

  it("edits the notes without disturbing the casters", async () => {
    const user = userEvent.setup();
    renderPanel({ casters: [WIZARD] });

    await user.type(screen.getByLabelText("Notes"), "!");

    expect(readSpellBook(stored()).notes).toBe("!");
    expect(readSpellBook(stored()).casters).toHaveLength(1);
  });
});

describe("two spellcasting classes", () => {
  it("gives each block controls of its own", async () => {
    const user = userEvent.setup();
    renderPanel({ casters: [WIZARD, { ...WIZARD, class_name: "Cleric" }] });

    await user.type(screen.getByLabelText("Cleric spells per day, level 1"), "5");

    const book = readSpellBook(stored());
    expect(book.casters[1]?.levels[1]?.per_day).toBe("45");
    expect(book.casters[0]?.levels[1]?.per_day).toBe("4");
  });

  /**
   * A player may well write "Wizard" twice — a Wizard 3 / Wizard 5 gestalt, or simply a block
   * begun and abandoned. The name is what every accessible name in the block is built from, so
   * when it cannot tell two blocks apart the block's position does.
   */
  it("falls back to the position when the same class is written twice", async () => {
    const user = userEvent.setup();
    renderPanel({ casters: [WIZARD, { ...WIZARD }] });

    await user.type(screen.getByLabelText("Wizard (2) spells per day, level 1"), "9");

    expect(readSpellBook(stored()).casters[1]?.levels[1]?.per_day).toBe("49");
    expect(readSpellBook(stored()).casters[0]?.levels[1]?.per_day).toBe("4");
  });

  it("removes the block it names", async () => {
    const user = userEvent.setup();
    renderPanel({ casters: [WIZARD, { ...WIZARD, class_name: "Cleric" }] });

    // Each block's control reads "Remove" and is named for its own class: two buttons both
    // answering to "Remove" would make this query throw rather than pick the wrong block.
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Remove Wizard" }));

    const book = readSpellBook(stored());
    expect(book.casters).toHaveLength(1);
    expect(book.casters[0]?.class_name).toBe("Cleric");
  });
});

describe("in French", () => {
  it("writes the spell levels as French ordinals and names the controls in French", () => {
    renderPanel({ casters: [WIZARD] }, "fr");

    const panel = screen.getByRole("heading", { name: "Sorts" }).closest("div")
      ?.parentElement as HTMLElement;
    expect(within(panel).getByText("1er")).toBeVisible();
    expect(within(panel).getByText("2e")).toBeVisible();
    expect(within(panel).queryByText("1st")).toBeNull();

    expect(screen.getByLabelText("Sorts par jour de niveau 1 de Wizard")).toBeVisible();
  });
});
