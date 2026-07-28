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
   * **Display only, and only for weights that came *out* of the engine.** The engine works in the
   * SRD's pounds and every weight the player types is a pound: nothing converted here may reach the
   * draft, a `PATCH`, or a `/api/derive` body, for the same reason the skills table's sorted
   * position never reaches a write. Converting a typed field would mean converting back on save,
   * and a 5 lb item that round-trips through a float comes back 4.9.
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
  };
}

export type { Dictionary, TranslationKey };
