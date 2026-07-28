import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "../i18n";
import { renderIn } from "../test/render";
import { character, derivedSheet, DEFINITIONS } from "../test/fixtures";
import { ExportPdfButton } from "./ExportPdfButton";

const exportCharacterPdf = vi.hoisted(() => vi.fn());
vi.mock("../pdf/exportCharacterPdf", () => ({ exportCharacterPdf }));

function renderButton(locale: Locale = "en") {
  return renderIn(
    <ExportPdfButton
      character={character()}
      derived={derivedSheet()}
      definitions={DEFINITIONS}
    />,
    locale,
  );
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("exporting", () => {
  it("hands the current draft and the derived sheet to the exporter", async () => {
    exportCharacterPdf.mockResolvedValue(undefined);
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    await waitFor(() => expect(exportCharacterPdf).toHaveBeenCalledOnce());
    const [passedCharacter, passedDerived, passedOptions] = exportCharacterPdf.mock.calls[0] ?? [];
    expect(passedCharacter).toMatchObject({ name: character().name });
    expect(passedDerived).toMatchObject({ armor_class: derivedSheet().armor_class });
    // The document cannot reach the provider itself, so the button has to hand it down.
    expect(passedOptions).toMatchObject({ definitions: DEFINITIONS });
    expect(passedOptions?.translator?.locale).toBe("en");
  });

  it("exports in the language the sheet is being read in", async () => {
    exportCharacterPdf.mockResolvedValue(undefined);
    renderButton("fr");

    await userEvent.click(screen.getByRole("button", { name: "Exporter en PDF" }));

    await waitFor(() => expect(exportCharacterPdf).toHaveBeenCalledOnce());
    const [, , passedOptions] = exportCharacterPdf.mock.calls[0] ?? [];
    expect(passedOptions?.translator?.locale).toBe("fr");
  });

  it("reports progress and refuses a second run while one is in flight", async () => {
    let finish = () => {};
    exportCharacterPdf.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    const button = await screen.findByRole("button", { name: "Preparing PDF…" });
    expect(button).toBeDisabled();

    finish();
    await screen.findByRole("button", { name: "Export PDF" });
    expect(exportCharacterPdf).toHaveBeenCalledOnce();
  });

  /**
   * The same reasoning as the autosave banner: a failure the user did not happen to be looking at
   * is a failure they will assume did not happen.
   */
  it("leaves the failure on screen rather than letting it vanish", async () => {
    exportCharacterPdf.mockRejectedValue(new Error("layout blew up"));
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The PDF could not be built");

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("clears a previous failure when a later export succeeds", async () => {
    exportCharacterPdf.mockRejectedValueOnce(new Error("nope")).mockResolvedValueOnce(undefined);
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
