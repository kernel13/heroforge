/**
 * "3 days ago", "il y a 3 jours" — when a character was last touched.
 *
 * `Intl.RelativeTimeFormat` writes the sentence, for the reason `Intl.NumberFormat` writes a weight
 * and `Intl.Collator` orders the skills table: the phrasing, the pluralisation and the word order
 * are the locale's, and a dictionary key per unit per language would be twelve strings that go
 * wrong in exactly the way `{max}` written as `{maximum}` goes wrong.
 *
 * It does not live on the `Translator`. `weight()` is there because `web/src/pdf/` renders outside
 * the provider tree and needs it; nothing prints `updated_at`, so this stays a plain function that
 * takes the locale it is writing for.
 *
 * `numeric: "auto"` is what turns a day into "yesterday" and a week into "last week" rather than
 * "1 day ago" — the reading a person would give the same fact aloud.
 */
import type { Locale } from "../i18n";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** The average Gregorian month and year, in seconds: 30.44 days and 365.25 of them. */
const MONTH = 2_629_800;
const YEAR = 31_557_600;

/**
 * Largest first: the unit reported is the largest one a whole number of which has passed, so
 * thirteen days is "2 weeks ago" and not "13 days ago".
 */
const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", YEAR],
  ["month", MONTH],
  ["week", WEEK],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
];

/**
 * `justNow` is the phrase for a character touched within the last minute, and is passed in rather
 * than left to `Intl`: `format(0, "second")` gives the bare adverb "now", and a foot that reads
 * "No campaign · now" is a sentence with a word missing. It is a dictionary key like any other
 * piece of interface copy — the only part of this that is copy at all.
 *
 * `now` is a parameter rather than a call inside, so a test can fix it and so two tiles rendered in
 * the same pass cannot disagree about what time it is.
 *
 * An unparseable stamp returns the empty string. A tile whose foot says "Invalid Date" is worse
 * than a tile whose foot says only which campaign it belongs to.
 */
export function since(
  iso: string,
  locale: Locale,
  justNow: string,
  now: number = Date.now(),
): string {
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return "";

  const seconds = Math.round((stamp - now) / 1000);
  const elapsed = Math.abs(seconds);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, size] of UNITS) {
    const value = Math.floor(elapsed / size);
    // Signed, so a stamp in the future — a clock a few seconds out, which is ordinary — reads "in
    // a minute" rather than being reported as having already happened.
    if (value >= 1) return format.format(Math.sign(seconds) * value, unit);
  }
  return justNow;
}
