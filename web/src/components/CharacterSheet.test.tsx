import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { character, derivedSheet, derivedSkill, DEFINITIONS } from "../test/fixtures";
import { CharacterSheet } from "./CharacterSheet";

function renderSheet(overrides: Parameters<typeof derivedSheet>[0] = {}) {
  const initial = character();
  return render(
    <CharacterSheet
      character={initial}
      initialDerived={derivedSheet(overrides)}
      definitions={DEFINITIONS}
      onBack={() => {}}
    />,
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

  it("shows the ability modifier in the temporary column when a temporary score is set", () => {
    renderSheet();
    // Constitution 14 base, 16 temporary: the modifier belongs to the temporary column.
    expect(screen.getByLabelText("Constitution temporary modifier")).toHaveTextContent("+3");
    expect(screen.getByLabelText("Constitution modifier")).toHaveTextContent("");
    expect(screen.getByLabelText("Dexterity modifier")).toHaveTextContent("+2");
  });

  it("shows every saving throw total", () => {
    renderSheet();
    expect(screen.getByLabelText("Fortitude total")).toHaveTextContent("+5");
    expect(screen.getByLabelText("Reflex total")).toHaveTextContent("+2");
    expect(screen.getByLabelText("Will total")).toHaveTextContent("+2");
  });

  it("shows the encumbrance figures the sheet asks you to work out", () => {
    renderSheet();
    expect(screen.getByLabelText("Light load")).toHaveTextContent("50 lb.");
    expect(screen.getByLabelText("Lift off ground")).toHaveTextContent("300 lb.");
    expect(screen.getByLabelText("Push or drag")).toHaveTextContent("750 lb.");
  });

  it("marks Swim as taking the armour check penalty twice", () => {
    renderSheet({
      skills: [
        derivedSkill({ skill_id: 32, name: "Swim", key_ability: "STR", armor_check_penalty: -16 }),
      ],
    });
    expect(screen.getByTitle("Armour check penalty applies twice")).toHaveTextContent("**");
  });

  it("reports rules violations as warnings rather than refusing them", () => {
    renderSheet({
      warnings: [
        { code: "ranks_over_maximum", message: "Listen: 12 ranks exceeds the maximum of 10.", field: null },
      ],
    });
    expect(screen.getByText(/12 ranks exceeds the maximum/)).toBeInTheDocument();
    expect(screen.getByText(/house rules and homebrew are normal play/)).toBeInTheDocument();
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
