import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Locale } from "../i18n";
import { renderIn } from "../test/render";
import { character, derivedSheet, derivedSkill, DEFINITIONS } from "../test/fixtures";
import { CharacterSheet } from "./CharacterSheet";

function renderSheet(
  overrides: Parameters<typeof derivedSheet>[0] = {},
  locale: Locale = "en",
) {
  const initial = character();
  return renderIn(
    <CharacterSheet
      character={initial}
      initialDerived={derivedSheet(overrides)}
      definitions={DEFINITIONS}
      onBack={() => {}}
    />,
    locale,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(api, "derive").mockResolvedValue(derivedSheet());
  vi.spyOn(api, "patchCharacter").mockResolvedValue({
    character: character({ version: 2 }),
    derived: derivedSheet(),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("displaying derived values", () => {
  it("shows armour class, touch, and flat-footed as three separate numbers", () => {
    renderSheet();
    expect(screen.getByLabelText("Armour class")).toHaveTextContent("12");
    expect(screen.getByLabelText("Touch")).toHaveTextContent("12");
    expect(screen.getByLabelText("Flat-footed")).toHaveTextContent("10");
  });

  it("shows the modifier the engine is actually using, whichever score it came from", () => {
    renderSheet();

    // Constitution 14 base, 16 temporary. There is one modifier column and it reads the temporary
    // score, because that is what every derived number on the sheet was worked out from. The pair
    // of columns this replaced said the same thing by leaving one of them blank, which is the
    // least legible way a table can say anything.
    expect(screen.getByLabelText("Constitution modifier")).toHaveTextContent("+3");
    expect(screen.getByLabelText("Constitution score")).toHaveValue(14);
    expect(screen.getByLabelText("Constitution temporary score")).toHaveValue(16);

    // And with no temporary score, the base one.
    expect(screen.getByLabelText("Dexterity modifier")).toHaveTextContent("+2");
    expect(screen.getByLabelText("Dexterity temporary score")).toHaveValue(null);
  });

  it("shows every saving throw total", () => {
    renderSheet();
    expect(screen.getByLabelText("Fortitude total")).toHaveTextContent("+5");
    expect(screen.getByLabelText("Reflex total")).toHaveTextContent("+2");
    expect(screen.getByLabelText("Will total")).toHaveTextContent("+2");
  });

  it("shows the encumbrance figures the sheet asks you to work out", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    // Encumbrance sits with the possessions that drive it — page two of the record sheet.
    await user.click(screen.getByRole("tab", { name: "Page 2" }));

    expect(screen.getByLabelText("Light load")).toHaveTextContent("50 lb.");
    expect(screen.getByLabelText("Lift off ground")).toHaveTextContent("300 lb.");
    expect(screen.getByLabelText("Push or drag")).toHaveTextContent("750 lb.");
  });

  /**
   * The `**` beside the row, not the one in the key under the table.
   *
   * The flag is drawn from the row's *definition*, so the draft has to carry a Swim row for it to
   * appear at all — a derived Swim skill alone renders nothing, because the table walks the draft.
   * This assertion used to pass against the marks the note paragraph carried, which said nothing
   * about the row.
   */
  it("marks Swim as taking the armour check penalty twice", () => {
    const stored = character().skills![0]!;
    renderIn(
      <CharacterSheet
        character={character({
          skills: [{ ...stored, id: null, ordinal: 1, skill_id: 32 }],
        })}
        initialDerived={derivedSheet({
          skills: [
            derivedSkill({
              skill_id: 32,
              name: "Swim",
              key_ability: "STR",
              armor_check_penalty: -16,
            }),
          ],
        })}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
    );
    expect(screen.getByTitle("Armour check penalty applies twice")).toHaveTextContent("**");
  });

  /**
   * The key under the table, which is where the three marks are explained now that the note
   * paragraph no longer splices them into a sentence. Each mark is a `<dt>` and its meaning the
   * `<dd>` beside it, and the meanings are the same dictionary entries the row flags carry as
   * their `title` — so the table and its key cannot come to disagree.
   */
  it("explains each of the skills table's marks under it", () => {
    renderSheet();

    for (const [mark, meaning] of [
      ["*", "Armour check penalty applies"],
      ["**", "Armour check penalty applies twice"],
      ["T", "Trained only"],
    ]) {
      const term = screen.getByText(mark!, { selector: "dt" });
      expect(term.nextElementSibling).toHaveTextContent(meaning!);
    }
  });

  it("shows a skill total only once the skill has a rank in it", () => {
    const stored = character().skills![0]!;
    renderIn(
      <CharacterSheet
        character={character({
          // A row per derived skill: the table walks the draft and pairs by stored position.
          skills: [stored, { ...stored, id: null, ordinal: 1, skill_id: 32, ranks: 3 }],
        })}
        initialDerived={derivedSheet({
          skills: [
            derivedSkill({
              skill_id: 16,
              name: "Hide",
              key_ability: "DEX",
              ranks: 0,
              total: 2,
            }),
            derivedSkill({
              skill_id: 32,
              name: "Swim",
              key_ability: "STR",
              ranks: 3,
              total: 4,
            }),
          ],
        })}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
      "en",
    );

    // The unranked row's `<output>` is *empty*, not absent: it keeps its accessible name, because
    // every derived value in these suites is addressed by that name and the label sits in a
    // sibling element. An element removed from the tree fails as "unable to find" — which reads
    // like a renamed label rather than like a deliberately blank column.
    expect(screen.getByLabelText("Hide total")).toHaveTextContent("");
    expect(screen.getByLabelText("Swim total")).toHaveTextContent("+4");

    // The components either side of the total stay visible regardless — the ability modifier is
    // what an unranked skill is rolled with, and blanking it would hide the reason the row exists.
    expect(screen.getByLabelText("Hide ranks")).toHaveValue(0);
  });

  it("shows the engine's rank count beside the skills heading, without renaming the heading", () => {
    renderSheet({ total_ranks: 57 });

    expect(screen.getByLabelText("Total ranks assigned")).toHaveTextContent("57");

    // The count is a sibling of the `<h2>`, not part of it. Folded in, the heading would answer to
    // "Skills 57" and every `getByRole("heading", { name: "Skills" })` — here, in the ordering
    // suite, and in both Playwright tests — would stop finding it.
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
  });

  it("reports rules violations as warnings rather than refusing them", () => {
    renderSheet({
      warnings: [
        {
          code: "ranks_over_maximum",
          message: "Listen: 12 ranks exceeds the maximum of 10.",
          field: null,
          params: {
            skill_name: "Listen",
            kind: "cross_class",
            ranks: "12",
            max_ranks: "10",
            character_level: "7",
          },
        },
      ],
    });
    expect(screen.getByText(/12 ranks exceeds the cross-class maximum of 10/)).toBeInTheDocument();
    expect(screen.getByText(/house rules and homebrew are normal play/)).toBeInTheDocument();
  });
});

describe("the derived rail", () => {
  /**
   * The point of the rail, and the reason it is a sibling of the `Tabs` rather than a child of
   * either page. Moving it inside `TabsContent` would leave page two with no armour class,
   * initiative, grapple or saves at all — and it would look like an ordinary refactor.
   */
  it("keeps every worked-out value on screen through a page change", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    expect(screen.getByLabelText("Armour class")).toHaveTextContent("12");

    await user.click(screen.getByRole("tab", { name: "Page 2" }));

    // Page one's fields are gone; the numbers derived from them are not.
    expect(screen.queryByLabelText("Character name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Armour class")).toHaveTextContent("12");
    expect(screen.getByLabelText("Touch")).toHaveTextContent("12");
    expect(screen.getByLabelText("Initiative")).toHaveTextContent("+2");
    expect(screen.getByLabelText("Grapple")).toHaveTextContent("+1");
    expect(screen.getByLabelText("Fortitude total")).toHaveTextContent("+5");
  });

  /**
   * Each derived value has exactly one home. Two elements answering to "Armour class" is not a
   * cosmetic duplication: `getByLabelText` throws on it, so the failure lands in whichever suite
   * happens to read that name rather than in the component that grew the second copy.
   */
  it("is the only place each derived total is written", () => {
    renderSheet();
    for (const name of [
      "Armour class",
      "Touch",
      "Flat-footed",
      "Initiative",
      "Grapple",
      "Fortitude total",
      "Reflex total",
      "Will total",
    ]) {
      expect(screen.getAllByLabelText(name)).toHaveLength(1);
    }
  });

  /**
   * The initiative/grapple panel splits its six controls into two named groups, and the split is
   * only legible because of them: three of the six feed one total and three feed the other, and
   * "Base attack bonus" does not say grapple anywhere in its own label.
   *
   * The second half is the part that will be undone. A `<legend>` names the *group*; it does not
   * join the accessible names of the controls inside it, in jsdom or in a browser. So "Grapple
   * misc" cannot be shortened to "Misc" now that a Grapple legend sits above it — it would collide
   * with the initiative one, and `getByLabelText` throws on the ambiguity rather than failing with
   * something that points here.
   */
  it("groups initiative and grapple without merging their control names", () => {
    renderSheet();

    expect(screen.getByRole("group", { name: "Initiative" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Grapple" })).toBeInTheDocument();

    for (const name of [
      "Dexterity modifier (uncapped)",
      "Initiative misc",
      "Base attack bonus",
      "Strength modifier (grapple)",
      "Grapple size modifier",
      "Grapple misc",
    ]) {
      expect(screen.getAllByLabelText(name)).toHaveLength(1);
    }
  });

  /**
   * The other half of the same rule, and the one nothing else guards.
   *
   * The rail also echoes values the player *typed* — hit points, damage reduction, speed. Those go
   * through `Reading`, which carries no `aria-label`, precisely because the panel field they echo
   * already owns that name. Swapping one for a `Derived variant="rail"` looks like a tidy-up and
   * gives two elements the name "Speed", and the failure then surfaces in whichever suite next
   * calls `getByLabelText` — a long way from the file that changed.
   */
  it("echoes typed values in the rail without claiming their labels", () => {
    renderSheet();
    for (const name of [
      "Speed",
      "Total",
      "Current",
      "Nonlethal damage",
      "Damage reduction",
      "Spell resistance",
    ]) {
      expect(screen.getAllByLabelText(name)).toHaveLength(1);
    }
  });

  /**
   * The ability-modifier strip is the one deliberate repetition — page two would otherwise have no
   * modifiers to trace its numbers back to — so it carries no accessible name of its own and
   * `AbilityTable` keeps sole ownership of "Dexterity modifier".
   */
  it("repeats the ability modifiers without claiming the table's names", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    expect(screen.getAllByLabelText("Dexterity modifier")).toHaveLength(1);

    await user.click(screen.getByRole("tab", { name: "Page 2" }));
    // The table is unmounted with page one, and the strip in the rail still shows the modifier.
    expect(screen.queryByLabelText("Dexterity modifier")).not.toBeInTheDocument();
    expect(screen.getByText("DEX").parentElement).toHaveTextContent("+2");
  });

  /**
   * Components sit behind a disclosure rather than beside the total they add up to. Printed at the
   * same weight as their total, they get read as a sum still to be finished and people add it up
   * again — which is how a sheet that does the arithmetic ends up being checked by hand.
   */
  it("folds the armour-class components away until they are asked for", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    const disclosure = screen.getAllByText("How this was worked out")[0]!;
    const details = disclosure.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");

    await user.click(disclosure);
    expect(details).toHaveAttribute("open");
    expect(details).toHaveTextContent("Shield");
  });

  it("names the character and reads its identity back as a sentence", () => {
    renderIn(
      <CharacterSheet
        character={character({
          name: "Sera Valhen",
          race: "Human",
          alignment: "Neutral good",
          deity: "Kord",
          class_levels: [
            { id: null, ordinal: 0, class_name: "Fighter", level: 4 },
            { id: null, ordinal: 1, class_name: "Rogue", level: 3 },
          ],
        })}
        initialDerived={derivedSheet()}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
      "en",
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Sera Valhen");

    // The sentence is assembled from fragments and sets the character's own words apart in their
    // own elements, so it is matched on the paragraph's text content rather than as one text node.
    expect(heading.nextElementSibling).toHaveTextContent(
      "A Neutral good Human, Fighter 4 / Rogue 3, sworn to Kord.",
    );
  });

  /** A half-filled character is the normal state of a sheet's first evening. */
  it("says so plainly when there is nothing to make a sentence from", () => {
    renderIn(
      <CharacterSheet
        character={character({
          name: "",
          race: "",
          alignment: "",
          deity: "",
          class_levels: [],
        })}
        initialDerived={derivedSheet()}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
      "en",
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Unnamed character");
    expect(screen.getByText("A character with nothing filled in yet.")).toBeInTheDocument();
  });
});

describe("the two pages", () => {
  it("opens on page one and shows only page one's fields", () => {
    renderSheet();
    expect(screen.getByLabelText("Character name")).toBeInTheDocument();
    // Page two is unmounted rather than hidden, so its controls are out of the a11y tree.
    expect(screen.queryByLabelText("Campaign")).not.toBeInTheDocument();
  });

  it("swaps one page for the other", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    await user.click(screen.getByRole("tab", { name: "Page 2" }));
    expect(screen.getByLabelText("Campaign")).toBeInTheDocument();
    expect(screen.queryByLabelText("Character name")).not.toBeInTheDocument();
  });

  it("keeps the draft across a page change, so unmounting loses no edit", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    // The draft lives in `useSheet` on the sheet itself, not on either page. Were it to move
    // down into a page component, this round trip would silently discard the typing.
    await user.clear(screen.getByLabelText("Character name"));
    await user.type(screen.getByLabelText("Character name"), "Bramwell");

    await user.click(screen.getByRole("tab", { name: "Page 2" }));
    await user.type(screen.getByLabelText("Campaign"), "Sunless Citadel");
    await user.click(screen.getByRole("tab", { name: "Page 1" }));

    expect(screen.getByLabelText("Character name")).toHaveValue("Bramwell");

    await user.click(screen.getByRole("tab", { name: "Page 2" }));
    expect(screen.getByLabelText("Campaign")).toHaveValue("Sunless Citadel");
  });

  it("carries the draft onto page three, and the rail with it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    expect(screen.getAllByRole("tab")).toHaveLength(3);

    await user.click(screen.getByRole("tab", { name: "Page 3" }));

    // The spellbook is page three's whole content, and the level is a group heading rather than a
    // column, so this is what says the page is the one that opened.
    expect(screen.getByText("Level 0 spells")).toBeInTheDocument();
    expect(screen.getByText("Level 9 spells")).toBeInTheDocument();
    // Page two's grid is a different block in a different place; it must not have come along.
    expect(screen.queryByLabelText("Campaign")).not.toBeInTheDocument();

    // The rail is a sibling of the `Tabs`, so a third page changes nothing about it.
    expect(screen.getByLabelText("Armour class")).toBeInTheDocument();
  });

  it("keeps the save banner reachable from page two", async () => {
    const { ApiError } = await import("../api/client");
    vi.mocked(api.patchCharacter).mockRejectedValue(
      new ApiError(503, null, "Service unavailable"),
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    await user.type(screen.getByLabelText("Character name"), "!");
    await user.click(screen.getByRole("tab", { name: "Page 2" }));
    vi.advanceTimersByTime(2500);

    // A failed save must not be something you can navigate away from — the banner lives on the
    // sheet, above both pages.
    expect(await screen.findByRole("alert")).toHaveTextContent("Your changes are not saved.");
  });
});

describe("exporting to PDF", () => {
  /**
   * The export takes the *draft*, not the character the sheet was loaded with — a player who
   * changes Dexterity and exports before the two-second save lands should get the sheet in front
   * of them, not the one on the server.
   */
  it("offers the export and gives it the edited draft", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "derive").mockResolvedValue(derivedSheet({ initiative: 5 }));
    renderSheet();

    await user.clear(screen.getByLabelText("Character name"));
    await user.type(screen.getByLabelText("Character name"), "Beorn");

    const button = screen.getByRole("button", { name: "Export PDF" });
    expect(button).toBeEnabled();
    expect(screen.getByLabelText("Character name")).toHaveValue("Beorn");
  });
});

describe("the two debounces", () => {
  it("recomputes at 250 ms and only saves at 2 s", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    const dexterity = screen.getByLabelText("Dexterity score");
    await user.clear(dexterity);
    await user.type(dexterity, "16");

    vi.advanceTimersByTime(300);
    await waitFor(() => expect(api.derive).toHaveBeenCalled());
    expect(api.patchCharacter).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(api.patchCharacter).toHaveBeenCalled());
  });

  it("recomputes more often than it saves during a burst of typing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    const name = screen.getByLabelText("Character name");
    for (const letter of "Bram") {
      await user.type(name, letter);
      vi.advanceTimersByTime(300);
    }
    vi.advanceTimersByTime(2500);

    await waitFor(() => expect(api.patchCharacter).toHaveBeenCalled());
    // Merging the two debounces is the single easiest way to make this app feel right in a demo
    // and wrong in use: either recomputation lags typing, or every keystroke is a database write.
    expect(vi.mocked(api.derive).mock.calls.length).toBeGreaterThan(
      vi.mocked(api.patchCharacter).mock.calls.length,
    );
  });

  it("stops calling the server once the user stops typing", async () => {
    // A regression guard. Debouncing the draft object itself looks correct and passes a test
    // that only advances the clock once: a fresh object is allocated on every render, so the
    // recompute effect re-fires forever and each re-render restarts the save timer, which then
    // never completes. In real time that is a request every 250 ms and a sheet that never saves.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    await user.type(screen.getByLabelText("Character name"), "!");
    vi.advanceTimersByTime(3000);
    await waitFor(() => expect(api.patchCharacter).toHaveBeenCalled());

    const settled = vi.mocked(api.derive).mock.calls.length;
    vi.advanceTimersByTime(10_000);
    await Promise.resolve();

    expect(vi.mocked(api.derive).mock.calls.length).toBe(settled);
    expect(vi.mocked(api.patchCharacter).mock.calls.length).toBe(1);
  });

  it("sends the version it last read, so a concurrent save can be detected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    await user.type(screen.getByLabelText("Character name"), "!");
    vi.advanceTimersByTime(2500);

    await waitFor(() => expect(api.patchCharacter).toHaveBeenCalled());
    const [, patch] = vi.mocked(api.patchCharacter).mock.calls[0] ?? [];
    expect(patch?.version).toBe(1);
  });
});

describe("autosave failure", () => {
  it("raises a banner that stays put rather than a notice that vanishes", async () => {
    const { ApiError } = await import("../api/client");
    vi.mocked(api.patchCharacter).mockRejectedValue(
      new ApiError(503, null, "Service unavailable"),
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    await user.type(screen.getByLabelText("Character name"), "!");
    vi.advanceTimersByTime(2500);

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Your changes are not saved.");

    // Still there long after any toast would have gone.
    vi.advanceTimersByTime(30_000);
    expect(screen.getByRole("alert")).toHaveTextContent("Your changes are not saved.");
  });

  it("explains a version conflict in terms the user can act on", async () => {
    const { ApiError } = await import("../api/client");
    vi.mocked(api.patchCharacter).mockRejectedValue(new ApiError(409, null, "Conflict"));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    await user.type(screen.getByLabelText("Character name"), "!");
    vi.advanceTimersByTime(2500);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /changed in another tab or window/,
    );
  });
});

describe("section icons", () => {
  /** Every section of the sheet, in the order the pages present them. */
  const PAGE_ONE = [
    "Character",
    "Class and level",
    "Abilities",
    "Hit points",
    "Armour class",
    "Initiative and grapple",
    "Saving throws",
    "Attacks",
    "Skills",
  ];
  const PAGE_TWO = [
    "Campaign",
    "Gear",
    "Possessions",
    "Money",
    "Feats",
    "Special abilities",
    "Languages",
    "Spells",
  ];

  function iconOf(title: string): SVGElement | null {
    return screen.getByRole("heading", { name: title }).querySelector("svg");
  }

  it.each(PAGE_ONE)("gives the %s panel an icon", (title) => {
    renderSheet();
    expect(iconOf(title)).not.toBeNull();
  });

  it.each(PAGE_TWO)("gives the %s panel an icon", async (title) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();
    await user.click(screen.getByRole("tab", { name: "Page 2" }));
    expect(iconOf(title)).not.toBeNull();
  });

  it("hides every icon from the accessibility tree", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = renderSheet();

    // The heading is found by its exact name: an icon that reached the accessibility tree would
    // join that name and this query would miss. `lucide-react` hides its own icons, Iconify's
    // build-time SVGs do not, so `Panel` and `Fieldset` hide them in the wrapper.
    for (const title of PAGE_ONE) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("tab", { name: "Page 2" }));
    for (const title of PAGE_TWO) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }

    for (const svg of container.querySelectorAll("svg")) {
      expect(svg.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });

  it("gives each gear slot and each attack its own icon", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // An attack fieldset only exists once the character has an attack; the four gear slots are
    // always drawn, filled or not.
    renderIn(
      <CharacterSheet
        character={character({
          attacks: [
            {
              id: "bbbbbbbb-0000-0000-0000-000000000001",
              ordinal: 0,
              name: "Rapier",
              attack_bonus: "+5",
              damage: "1d6+1",
              critical: "18-20/×2",
              range: "",
              damage_type: "piercing",
              ammunition: "",
              notes: "",
            },
          ],
        })}
        initialDerived={derivedSheet()}
        definitions={DEFINITIONS}
        onBack={() => {}}
      />,
    );

    // The attack fieldsets are on page one; the gear slots on page two. Both queries are scoped
    // to the open page rather than to the document: the derived rail sits outside the `Tabs` and
    // names armour and shield among the armour-class components it can disclose, so an unscoped
    // `getAllByText("Armour")[0]` finds the rail's word and reports the *rail* has no icon.
    const pageOne = within(screen.getByRole("tabpanel"));
    expect(pageOne.getByText("Attack 1").querySelector("svg")).not.toBeNull();

    await user.click(screen.getByRole("tab", { name: "Page 2" }));
    const pageTwo = within(screen.getByRole("tabpanel"));
    for (const slot of ["Armour", "Shield", "Protective item"]) {
      const legend = pageTwo.getAllByText(slot)[0];
      expect(legend?.querySelector("svg")).not.toBeNull();
    }
  });
});

describe("the portrait frame", () => {
  function renderWithPortrait(updatedAt: string | null, locale: Locale = "en") {
    return renderIn(
      <CharacterSheet
        character={character()}
        initialDerived={derivedSheet()}
        definitions={DEFINITIONS}
        onBack={() => {}}
        portraitUpdatedAt={updatedAt}
      />,
      locale,
    );
  }

  it("draws the picture beside the identity fields, cache-busted by its stamp", () => {
    renderWithPortrait("2026-07-27T11:30:00Z");

    // The stamp is on the URL rather than beside it: a portrait replaced from the list is then a
    // different URL, and the browser fetches it instead of the copy it cached for a day.
    expect(screen.getByRole("img", { name: "Portrait" })).toHaveAttribute(
      "src",
      "/api/characters/11111111-2222-3333-4444-555555555555/portrait?v=2026-07-27T11%3A30%3A00Z",
    );

    // Inside the identity panel, beside the fields it belongs with, rather than in a panel of
    // its own — which is the whole of what was asked for.
    const panel = screen.getByRole("heading", { name: "Character" }).closest("[data-slot='card']");
    const identity = within(panel as HTMLElement);
    expect(identity.getByRole("img", { name: "Portrait" })).toBeInTheDocument();
    expect(identity.getByLabelText("Character name")).toHaveValue("Bramwell");
  });

  it("keeps the frame when there is no picture, and says where one comes from", () => {
    renderWithPortrait(null);

    expect(screen.queryByRole("img", { name: "Portrait" })).toBeNull();
    expect(
      screen.getByText("No portrait yet. Add one from the character list."),
    ).toBeInTheDocument();
  });

  it("names the picture in the language on screen", () => {
    renderWithPortrait("2026-07-27T11:30:00Z", "fr");
    expect(screen.getByRole("img", { name: "Portrait" })).toBeInTheDocument();
  });

  it("draws no upload control: the portrait is uploaded from the list", () => {
    // Not a tidiness assertion. The portrait sits outside the versioned document, and a control
    // here would put an upload on the same screen as the autosave it must never bump.
    renderWithPortrait(null);
    expect(screen.queryByRole("button", { name: /portrait/i })).toBeNull();
  });
});

describe("no rules arithmetic in the frontend", () => {
  it("leaves derived numbers unchanged until the server answers", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    const dexterity = screen.getByLabelText("Dexterity score");
    await user.clear(dexterity);
    await user.type(dexterity, "18");

    // The component has not recomputed anything itself: AC is still what the server last said.
    expect(screen.getByLabelText("Armour class")).toHaveTextContent("12");
  });

  it("takes the new numbers from the derive response", async () => {
    vi.mocked(api.derive).mockResolvedValue(
      derivedSheet({
        armor_class: {
          armor_bonus: 0,
          shield_bonus: 0,
          effective_dex_bonus: 4,
          size_modifier: 0,
          natural_armor: 0,
          deflection: 0,
          misc: 0,
          total: 14,
          touch: 14,
          flat_footed: 10,
        },
        initiative: 4,
      }),
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSheet();

    const dexterity = screen.getByLabelText("Dexterity score");
    await user.clear(dexterity);
    await user.type(dexterity, "18");
    vi.advanceTimersByTime(300);

    await waitFor(() =>
      expect(screen.getByLabelText("Armour class")).toHaveTextContent("14"),
    );
    expect(screen.getByLabelText("Initiative")).toHaveTextContent("+4");
  });
});
