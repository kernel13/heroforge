/**
 * Preparing an upload.
 *
 * The type guard is pinned here rather than in the component test: the file picker's `accept`
 * already stops a `.txt` reaching the handler in a browser, so the component can never exercise
 * it, and the guard exists precisely for the paths `accept` does not cover — a drag, a paste, a
 * file whose extension lies. The API refuses the same set again; this is the client half.
 */
import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_TYPES,
  PortraitError,
  preparePortrait,
} from "./portrait";

describe("preparePortrait", () => {
  it("refuses a file that is not an image the API will store", async () => {
    const file = new File(["notes"], "notes.txt", { type: "text/plain" });

    await expect(preparePortrait(file)).rejects.toBeInstanceOf(PortraitError);
    await expect(preparePortrait(file)).rejects.toMatchObject({
      key: "portraitType",
    });
  });

  it("refuses SVG, which the API refuses too", async () => {
    // Not an oversight on either side: an SVG is a document that can carry script, and it would
    // be served back from this application's own origin.
    expect(ACCEPTED_IMAGE_TYPES).not.toContain("image/svg+xml");

    const file = new File(["<svg/>"], "portrait.svg", {
      type: "image/svg+xml",
    });
    await expect(preparePortrait(file)).rejects.toMatchObject({
      key: "portraitType",
    });
  });
});
