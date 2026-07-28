/**
 * The order the skills are *shown* in.
 *
 * Alphabetical by the skill's name in the language on screen. The stored order cannot serve: rows
 * are created once, in the reference list's order, and that order is the English alphabet. Read in
 * French it is no order at all — *Estimation, Équilibre, Bluff, Escalade* — and a forty-row table
 * you cannot scan is a table you have to read end to end every time.
 *
 * **Display only.** Nothing here touches `ordinal`, the stored rows, or the order `derive()` is
 * given — a skill row is identified by its position in `draft.skills`, and that position is what
 * pairs it with its derived values and with a write. Sorting carries the original position along
 * rather than replacing it; see the callers.
 *
 * Shared by the sheet and the PDF export deliberately. Two copies of a comparator drift, and the
 * exported sheet disagreeing with the screen it was exported from is exactly the kind of drift
 * nobody notices until a player is reading the printout at a table.
 */
import type { SkillDefinition } from "../api/types";
import type { Locale, Translator } from "./translate";

/**
 * Locale-aware, and not `String.prototype.localeCompare` at each comparison: constructing the
 * collator once is the difference that matters over forty rows, and `Intl` is what knows that
 * French sorts *Équilibre* under E rather than after Z.
 */
export function skillCollator(locale: Locale): Intl.Collator {
  return new Intl.Collator(locale);
}

/**
 * Sort `items` by the name of the skill each one points at.
 *
 * Custom rows sort **last**, in the order they were added, rather than into the alphabet by the
 * name the player typed. Two reasons, and the second is the real one: the paper sheet keeps its
 * blank rows at the bottom, and a row that re-sorts itself on every keystroke jumps out from under
 * the cursor of the person naming it.
 *
 * For the same reason the key is the *definition's* name and never the row's full label — a Craft
 * row would otherwise move while its specialisation was being typed. Repeat rows of one skill
 * (Craft, Knowledge, Perform, Profession) therefore compare equal and stay in their stored order:
 * `Array.prototype.sort` has been stable since ES2019.
 */
export function sortBySkillName<T>(
  items: readonly T[],
  skillIdOf: (item: T) => number | null | undefined,
  definitions: readonly SkillDefinition[],
  translator: Translator,
  collator: Intl.Collator = skillCollator(translator.locale),
): T[] {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  const nameOf = (item: T): string | null => {
    const id = skillIdOf(item);
    if (id == null) return null;
    const definition = byId.get(id);
    // A row pointing at a skill this build has never heard of is as unplaceable as a custom one.
    return definition === undefined ? null : translator.skillName(definition);
  };

  return [...items].sort((left, right) => {
    const a = nameOf(left);
    const b = nameOf(right);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return collator.compare(a, b);
  });
}
