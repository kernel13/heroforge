/**
 * The character list's tiles.
 *
 * Two things here are easy to undo and are pinned as a result: the portrait control is icon-only,
 * so its accessible name is its `aria-label` and nothing else — a glyph that leaked into it would
 * make every assertion below read a name nobody wrote — and a tile names the character's classes
 * and their total level, which is the whole of what the tile is for.
 *
 * The level is a figure with its caption in a sibling element, as every derived value on this
 * application is, so it is read by its accessible name rather than as the text "Level 7". With no
 * classes typed it has no name at all: "Level 0" is a statement about a character nobody has
 * finished making, and printing it would be the tile inventing a fact.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { CharacterSummary } from "../api/types";
import type { Locale } from "../i18n";
import { renderIn } from "../test/render";
import { CharacterList } from "./CharacterList";

function summary(overrides: Partial<CharacterSummary> = {}): CharacterSummary {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Bramwell",
    player_name: "",
    campaign: "",
    race: "Halfling",
    version: 1,
    updated_at: "2026-07-27T10:00:00Z",
    class_levels: [
      { class_name: "Rogue", level: 4, ordinal: 0 },
      { class_name: "Fighter", level: 3, ordinal: 1 },
    ],
    portrait_updated_at: null,
    ...overrides,
  };
}

function renderList(rows: CharacterSummary[], locale: Locale = "en") {
  vi.spyOn(api, "listCharacters").mockResolvedValue(rows);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderIn(
    <QueryClientProvider client={client}>
      <CharacterList onOpen={() => {}} />
    </QueryClientProvider>,
    locale,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("what a tile says", () => {
  it("names the character and its race, and totals its classes in the band", async () => {
    renderList([summary()]);

    // The control names itself, so the name does not depend on how two spans are concatenated —
    // jsdom and a browser disagree about that, and a tile is not the place to find out.
    const open = await screen.findByRole("button", { name: "Open Bramwell" });
    expect(open).toHaveTextContent("Bramwell");
    expect(open).toHaveTextContent("Halfling");
    expect(screen.getByLabelText("Level 7")).toHaveTextContent("7");
  });

  it("sets the classes as a ledger, one row each", async () => {
    // The whole of this design: three classes are three rows whose levels line up under the total,
    // not one "Rogue 4 / Fighter 3" string that wraps into soup at any tile width.
    renderList([summary()]);

    const rows = await screen.findAllByRole("listitem");
    const ledger = rows.filter((row) => row.textContent?.match(/^(Rogue|Fighter)/));
    expect(ledger.map((row) => row.textContent)).toEqual(["Rogue4", "Fighter3"]);
  });

  it("says so rather than going blank when there is no class yet", async () => {
    renderList([summary({ class_levels: [] })]);

    expect(await screen.findByText("No class yet")).toBeInTheDocument();
    // No level is named, because there is no level: a tile that printed "Level 0" would be
    // stating something about the character that nobody typed.
    expect(screen.queryByLabelText(/^Level /)).toBeNull();
  });

  it("says which fields are simply not filled in yet", async () => {
    renderList([summary({ race: "", campaign: "" })]);

    expect(await screen.findByText("Race not set")).toBeInTheDocument();
    expect(screen.getByText(/^No campaign · /)).toBeInTheDocument();
  });

  it("names an unnamed character on every control, so two of them stay apart", async () => {
    renderList([summary({ name: "" })]);

    expect(
      await screen.findByRole("button", { name: "Open Unnamed character" }),
    ).toBeInTheDocument();
    // Not "Delete": a tile whose delete button is named after nothing is a button a screen
    // reader cannot tell from the next tile's.
    expect(
      screen.getByRole("button", { name: "Delete Unnamed character" }),
    ).toBeInTheDocument();
  });
});

describe("the portrait", () => {
  it("offers to add one, and shows no image, when the character has none", async () => {
    renderList([summary()]);

    const control = await screen.findByRole("button", {
      name: "Add a portrait for Bramwell",
    });
    // Queried as an element, not by role: an `alt=""` image maps to `presentation`, so a
    // `queryByRole("img")` here would be null whether or not the picture was rendered.
    expect(control.querySelector("img")).toBeNull();
  });

  it("shows the image, cache-busted, once there is one", async () => {
    renderList([summary({ portrait_updated_at: "2026-07-27T11:30:00Z" })]);

    const control = await screen.findByRole("button", {
      name: "Change the portrait of Bramwell",
    });
    // The glyph and the image are both decorative: the button's label is the whole accessible
    // name, which is what keeps `getByRole` above unambiguous.
    const image = control.querySelector("img");
    expect(image?.getAttribute("src")).toContain("2026-07-27T11%3A30%3A00Z");
    expect(image).toHaveAttribute("alt", "");
  });

  it("only offers removal where there is something to remove", async () => {
    renderList([summary({ portrait_updated_at: "2026-07-27T11:30:00Z" })]);

    expect(
      await screen.findByRole("button", {
        name: "Remove the portrait of Bramwell",
      }),
    ).toBeInTheDocument();
  });

  it("does not offer removal when there is no portrait", async () => {
    renderList([summary()]);

    await screen.findByRole("button", { name: "Add a portrait for Bramwell" });
    expect(
      screen.queryByRole("button", { name: /Remove the portrait/ }),
    ).toBeNull();
  });

  it("reports a file it cannot decode, and does not send it", async () => {
    // A file the picker's `accept` would let through but the browser cannot turn into a bitmap —
    // a renamed document, a truncated download. The card has to say something rather than sit
    // there having silently done nothing.
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.reject(new Error("not an image"))),
    );
    const upload = vi.spyOn(api, "uploadPortrait");
    renderList([summary()]);
    await screen.findByRole("button", { name: "Add a portrait for Bramwell" });

    const picker = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await userEvent.upload(
      picker,
      new File(["nonsense"], "portrait.png", { type: "image/png" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("That image could not be read."),
      ).toBeInTheDocument(),
    );
    expect(upload).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("in French", () => {
  it("labels the portrait control in the language on screen", async () => {
    renderList([summary()], "fr");

    expect(
      await screen.findByRole("button", {
        name: "Ajouter un portrait pour Bramwell",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Niveau 7")).toHaveTextContent("7");
    // The caption over it is translated too, and it is what a sighted reader actually sees.
    expect(screen.getByText("Niveau")).toBeInTheDocument();
  });
});

describe("the heading", () => {
  beforeEach(() => renderList([]));

  it("is a heading, so the list has an outline of its own", async () => {
    expect(
      await screen.findByRole("heading", { name: "Your characters" }),
    ).toBeInTheDocument();
  });
});
