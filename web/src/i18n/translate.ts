/**
 * The translator itself — no React, so the PDF document and the tests can use it directly.
 *
 * `@react-pdf/renderer` renders through its own reconciler, outside this application's provider
 * tree, so a `useT()` inside the exported document would find no context at all. Keeping the
 * translator a plain object means `ExportPdfButton` — which *is* inside the tree — can hand one
 * down as a prop and the document needs no React context of its own.
 */
import type { SkillDefinition } from "../api/types";
import { en, type Dictionary, type TranslationKey } from "./en";
import { fr } from "./fr";

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

/** English is the fallback and the source of truth for what keys exist. */
export const DEFAULT_LOCALE: Locale = "en";

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export type Params = Record<string, string | number>;

/**
 * Pounds to kilograms, for the French sheet.
 *
 * **0.5, not the physical 0.45359237.** The reader of a French sheet has the French rulebooks open
 * beside it, and those print a simplified halving — full plate is 25 kg there, not 22,7. A figure
 * on screen that disagrees by half a kilogram with the table a player is copying from is worse than
 * no conversion at all, because it reads as an arithmetic fault in the thing that exists to do the
 * arithmetic. The rounding is exact either way: halving a whole number of pounds lands on a whole
 * or a half kilogram and never needs a hidden rounding step.
 *
 * This is a unit written two ways, not a rule computed twice: there is no Python counterpart for it
 * to drift from, the engine keeps working in the SRD's pounds, and nothing converted here is ever
 * sent back — see `weight` below.
 */
const POUNDS_TO_KILOGRAMS = 0.5;

/**
 * `{name}` is replaced; anything unmatched is left alone rather than blanked.
 *
 * A template whose placeholder a caller forgot should be conspicuous in the interface, not
 * silently rendered as an empty gap that reads like a translation someone truncated.
 */
function fill(template: string, params: Params | undefined): string {
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  );
}

export interface Translator {
  readonly locale: Locale;
  /** The string for `key`, with `{placeholders}` filled in. */
  t: (key: TranslationKey, params?: Params) => string;
  /**
   * The name of a skill in this locale, falling back to its English name.
   *
   * A skill added through `sqladmin` and not yet translated must still appear on a French sheet.
   * `name` is the row's identity — the name the rules engine is handed — so it is what a missing
   * `name_fr` falls back to.
   */
  skillName: (definition: Pick<SkillDefinition, "name" | "name_fr">) => string;
  /**
   * A weight the engine worked out, written with the unit this locale reads in — `50 lb.` in
   * English, `25 kg` in French.
   *
   * **Display only.** It rounds — `maximumFractionDigits: 1` — so it must never be the value in an
   * editable control. A field that reformatted what the player typed through this would quietly
   * truncate their third decimal. Typed weights convert through `weightInput` / `weightToPounds`
   * below, which do not round.
   *
   * It lives on the translator rather than in a hook because `web/src/pdf/` renders outside this
   * application's provider tree — the printed sheet and the screen have to reach the same
   * formatter or they will disagree about what a load weighs.
   */
  weight: (value: number | string) => string;
  /**
   * The same figure with no unit after it, for the places that print a row of weights under one
   * heading — the rail's load scale, the PDF's limit fields. Converted exactly as `weight` is, so a
   * scale cannot be in pounds while the sentence under it is in kilograms.
   */
  weightNumber: (value: number | string) => string;
  /**
   * A **stored** weight in pounds, written for the reader to edit in their own unit.
   *
   * This is the half of the conversion that `weight` deliberately is not. It returns a bare figure
   * with the locale's decimal separator and **no rounding and no unit**, because the result goes
   * into an `<input>` the player is about to change: `Intl.NumberFormat` would settle 0.05 kg to
   * `0,1` and the next keystroke would store double what was there.
   *
   * The round trip is exact, and it is the factor that makes it so. 0.5 is a power of two, so `×`
   * and `÷` by it are exact in IEEE 754 — no bits are lost — and `String(number)` round-trips a
   * double without loss. `weightToPounds(weightInput(x))` is `x` for every finite `x`. That is a
   * property of **this** factor: with the physical 0.45359237 a 5 lb item genuinely would come
   * back 4.9, which is why converting typed fields used to be forbidden outright.
   *
   * Anything that will not parse as a number is passed back **unchanged**, for the reason
   * `inLocalUnit` passes it through in pounds: a value nobody can read is visible, and a value
   * silently replaced is not.
   */
  weightInput: (pounds: string) => string;
  /** The inverse of `weightInput`. What a player typed, back in the pounds everything stores. */
  weightToPounds: (typed: string) => string;
}

export function translatorFor(locale: Locale): Translator {
  const dictionary = DICTIONARIES[locale];
  const t: Translator["t"] = (key, params) => fill(dictionary[key] ?? en[key], params);

  /*
   * The locale's own decimal separator: "74,5 kg" in French. A decimal point in a French interface
   * is the same class of mistake as sorting *Évasion* after Z, and has the same fix.
   *
   * `useGrouping: false` is deliberate and reachable. A Strength-20 character pushes 2000 lb, and
   * French would otherwise group that as `1 000 kg` — with U+202F, a narrow no-break space, which
   * the self-hosted PDF body font is not guaranteed to have a glyph for and which the French export
   * test's `blob.size` would not notice going tofu. English has never grouped a weight, so grouping
   * only French would be a second difference between the two locales on top of the one intended.
   */
  const decimal = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    useGrouping: false,
  });

  /**
   * The figure and the unit it is now in.
   *
   * Anything that is not a finite number is passed through **in pounds**, keeping the unit it
   * actually arrived in. Relabelling an unparseable value `kg` would be the one failure mode worth
   * avoiding here: a wrong number is visible, a right number under a wrong unit is not.
   */
  const inLocalUnit = (value: number | string): { figure: string; unit: TranslationKey } => {
    const pounds = typeof value === "number" ? value : Number(value);
    if (locale === "en" || String(value).trim() === "" || !Number.isFinite(pounds)) {
      return { figure: String(value), unit: "unit.lb" };
    }
    return { figure: decimal.format(pounds * POUNDS_TO_KILOGRAMS), unit: "unit.kg" };
  };

  /**
   * The two directions of a typed weight.
   *
   * They are separate functions rather than one with a factor because their *output separators*
   * differ, and that asymmetry is the whole point: what the reader edits carries the locale's
   * separator, and what the draft stores carries a `.` — it is a decimal string bound for a
   * `PATCH` and `/api/derive`, and the server has no locale. A single helper would have to be told
   * which way it was going anyway.
   *
   * Neither rounds. See `weightInput` on the interface for why the round trip is exact.
   */
  const separator = locale === "fr" ? "," : ".";

  const weightInput: Translator["weightInput"] = (pounds) => {
    if (locale === "en" || pounds.trim() === "") return pounds;
    // The stored figure is a decimal string and always uses a `.`, whatever the reader writes.
    const value = Number(pounds.trim());
    if (!Number.isFinite(value)) return pounds;
    return String(value * POUNDS_TO_KILOGRAMS).replace(".", separator);
  };

  const weightToPounds: Translator["weightToPounds"] = (typed) => {
    if (locale === "en" || typed.trim() === "") return typed;
    const value = Number(typed.trim().replace(separator, "."));
    if (!Number.isFinite(value)) return typed;
    return String(value / POUNDS_TO_KILOGRAMS);
  };

  return {
    locale,
    t,
    skillName: (definition) =>
      locale === "en" ? definition.name : (definition.name_fr ?? definition.name),
    weight: (value) => {
      const { figure, unit } = inLocalUnit(value);
      return `${figure} ${t(unit)}`;
    },
    weightNumber: (value) => inLocalUnit(value).figure,
    weightInput,
    weightToPounds,
  };
}

export type { Dictionary, TranslationKey };
