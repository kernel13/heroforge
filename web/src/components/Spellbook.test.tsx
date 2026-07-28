/**
 * The spellbook page.
 *
 * Four things are pinned. The first is that the level is the row's *position*: what a player types
 * under one level's bar lands in that level's group of `spells_raw.spellbook` and nowhere else,
 * which is the whole reason the shape has no level field to get wrong.
 *
 * The second is that page three writes into the same column page two does without disturbing it.
 * `spells_raw` holds the free-text notes, the casting blocks, and now the book; a player who adds
 * a spell must not lose the paragraph they wrote before the page existed, nor the keys some other
 * build put in the column.
 *
 * The third is that every control is addressable. A book has ten groups of rows and each group
 * repeats the same three columns, so "spell 1 name" without its level is a name that resolves to
 * ten elements — which is a `getByLabelText` that throws rather than fails legibly.
 *
 * The fourth is that the group heading is a sentence each dictionary writes for itself. English
 * puts the number after the word and French after "niveau"; neither is `${n}` with a suffix a
 * component made up.
 */
import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CharacterBody } from "../api/types";
import type { Locale } from "../i18n";
import { SPELL_LEVELS, readSpellBook } from "../lib/spells";
import { renderIn } from "../test/render";
import { character } from "../test/fixtures";
import { SpellbookPage } from "./Spellbook";

/** The page with a draft behind it, and the stored column readable beside it. */
function Harness({ initial }: { initial?: Record<string, unknown> }) {
  const [draft, setDraft] = useState<CharacterBody>(character({ spells_raw: initial ?? {} }));
  return (
    <>
      <SpellbookPage
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

function show(initial?: Record<string, unknown>, locale: Locale = "en") {
  renderIn(<Harness initial={initial} />, locale);
  return userEvent.setup();
}

describe("the table", () => {
  it("draws a group for every spell level, and only those", () => {
    show();
    for (const level of SPELL_LEVELS) {
      expect(screen.getByText(`Level ${level} spells`)).toBeInTheDocument();
    }
    expect(screen.queryByText("Level 10 spells")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Add a spell at level/ })).toHaveLength(10);
  });

  it("names each group by its level alone, with the control beside it and not inside it", () => {
    show();
    // A `<th>` wrapping the add button would be announced as "Level 3 spells Add" — the same
    // defect as an icon leaking into a control's accessible name, on the element that tells a
    // screen-reader user which level's rows come next.
    expect(
      screen.getByRole("rowheader", { name: "Level 3 spells" }),
    ).toBeInTheDocument();
  });

  it("starts every level empty — nothing is created eagerly", () => {
    show();
    expect(screen.queryByLabelText("Level 0 spell 1 name")).not.toBeInTheDocument();
  });
});

describe("writing a spell", () => {
  it("puts it in its own level's group and leaves the other nine alone", async () => {
    const user = show();
    await user.click(screen.getByRole("button", { name: "Add a spell at level 3" }));
    await user.type(screen.getByLabelText("Level 3 spell 1 name"), "Fireball");
    await user.type(screen.getByLabelText("Level 3 spell 1 school"), "Evocation");
    await user.type(screen.getByLabelText("Level 3 spell 1 page"), "231");

    const book = readSpellBook(stored());
    expect(book.spellbook[3]).toEqual([{ name: "Fireball", school: "Evocation", page: "231" }]);
    expect(book.spellbook.filter((group) => group.length > 0)).toHaveLength(1);
    expect(book.spellbook).toHaveLength(10);
  });

  it("keeps two levels apart even at the same position in each", async () => {
    const user = show();
    await user.click(screen.getByRole("button", { name: "Add a spell at level 1" }));
    await user.click(screen.getByRole("button", { name: "Add a spell at level 2" }));
    await user.type(screen.getByLabelText("Level 1 spell 1 name"), "Magic missile");
    await user.type(screen.getByLabelText("Level 2 spell 1 name"), "Mirror image");

    const book = readSpellBook(stored());
    expect(book.spellbook[1]?.[0]?.name).toBe("Magic missile");
    expect(book.spellbook[2]?.[0]?.name).toBe("Mirror image");
  });

  it("disturbs nothing else in the column", async () => {
    // The paragraph predates the page, and `familiar` is somebody else's key. Losing either is the
    // one outcome nothing recovers from.
    const user = show({ notes: "in the cart", familiar: "Raven" });
    await user.click(screen.getByRole("button", { name: "Add a spell at level 0" }));
    await user.type(screen.getByLabelText("Level 0 spell 1 name"), "Light");

    const raw = stored();
    expect(raw.notes).toBe("in the cart");
    expect(raw.familiar).toBe("Raven");
    expect(readSpellBook(raw).spellbook[0]?.[0]?.name).toBe("Light");
  });
});

describe("removing a spell", () => {
  it("takes out the row it names and renumbers the rest", async () => {
    const user = show({
      spellbook: [
        [],
        [
          { name: "Shield", school: "Abjuration", page: "278" },
          { name: "Sleep", school: "Enchantment", page: "280" },
        ],
      ],
    });
    expect(screen.getByLabelText("Level 1 spell 1 name")).toHaveValue("Shield");

    await user.click(screen.getByRole("button", { name: "Remove level 1 spell 1" }));

    expect(readSpellBook(stored()).spellbook[1]).toEqual([
      { name: "Sleep", school: "Enchantment", page: "280" },
    ]);
    expect(screen.getByLabelText("Level 1 spell 1 name")).toHaveValue("Sleep");
    expect(screen.queryByLabelText("Level 1 spell 2 name")).not.toBeInTheDocument();
  });
});

describe("in French", () => {
  it("writes the group heading as its own sentence, not an English one translated word by word", () => {
    show(undefined, "fr");
    expect(screen.getByText("Sorts de niveau 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ajouter un sort de niveau 3" }),
    ).toBeInTheDocument();
  });

  it("names every control in French", async () => {
    const user = show(undefined, "fr");
    await user.click(screen.getByRole("button", { name: "Ajouter un sort de niveau 5" }));
    await user.type(screen.getByLabelText("Nom du sort 1 de niveau 5"), "Téléportation");
    expect(readSpellBook(stored()).spellbook[5]?.[0]?.name).toBe("Téléportation");
  });
});

describe("what is already in the column", () => {
  it("renders a book stored by something that is not this build", () => {
    // A hand-written `PATCH`, an older build, a level past the ninth. None of it may throw, and
    // the eleventh group has no level to be drawn at.
    show({
      spellbook: [
        "not a group",
        [{ name: "Grease", school: 7 }, null],
        undefined,
        ...Array(8).fill([]),
        [{ name: "Wish at level ten" }],
      ],
    });
    expect(screen.getByLabelText("Level 1 spell 1 name")).toHaveValue("Grease");
    // The school was a number and the second entry was null: read through, blanked, not dropped.
    expect(screen.getByLabelText("Level 1 spell 1 school")).toHaveValue("");
    expect(screen.getByLabelText("Level 1 spell 2 name")).toHaveValue("");
    expect(screen.queryByDisplayValue("Wish at level ten")).not.toBeInTheDocument();
  });
});
