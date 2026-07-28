/**
 * The tile's foot says when a character was last touched, and the bucketing that decides whether
 * that is minutes, days or months is arithmetic this repository wrote — so it is pinned.
 *
 * The clock is frozen. Against a real one, every expectation here would be true on the day it was
 * written and quietly wrong afterwards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { since } from "./since";

const NOW = Date.parse("2026-07-28T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** `n` units before the frozen now, as the ISO stamp `updated_at` carries. */
const ago = (seconds: number): string => new Date(NOW - seconds * 1000).toISOString();

describe("how long ago", () => {
  it("reports the largest whole unit that has passed", () => {
    expect(since(ago(6 * 60), "en", "Just now")).toBe("6 minutes ago");
    expect(since(ago(2 * 3600), "en", "Just now")).toBe("2 hours ago");
    expect(since(ago(3 * 86400), "en", "Just now")).toBe("3 days ago");
    // Not "21 days ago": thirteen days is two weeks and three weeks is three weeks.
    expect(since(ago(21 * 86400), "en", "Just now")).toBe("3 weeks ago");
    expect(since(ago(150 * 86400), "en", "Just now")).toBe("4 months ago");
    expect(since(ago(400 * 86400), "en", "Just now")).toBe("last year");
  });

  it("writes the sentence in the language on screen", () => {
    expect(since(ago(3 * 86400), "fr", "À l'instant")).toBe("il y a 3 jours");
  });

  it("says yesterday rather than counting to one", () => {
    // `numeric: "auto"` — the reading a person would give the same fact aloud.
    expect(since(ago(30 * 3600), "en", "Just now")).toBe("yesterday");
    expect(since(ago(30 * 3600), "fr", "À l'instant")).toBe("hier");
  });

  it("uses the phrase it was given under a minute, not Intl's bare adverb", () => {
    // "No campaign · now" is a sentence with a word missing; the caller passes the copy.
    expect(since(ago(20), "en", "Just now")).toBe("Just now");
    expect(since(ago(20), "fr", "À l'instant")).toBe("À l'instant");
  });

  it("does not report a clock a few seconds fast as something that already happened", () => {
    expect(since(ago(-90), "en", "Just now")).toBe("in 1 minute");
  });

  it("returns nothing at all for a stamp it cannot read", () => {
    // The foot then carries only the campaign. A tile saying "Invalid Date" is worse than a tile
    // saying less.
    expect(since("not a date", "en", "Just now")).toBe("");
  });
});
