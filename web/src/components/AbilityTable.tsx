/**
 * The ability block: score, temporary score, and the modifier actually in use.
 *
 * One modifier column, not two. The pair existed so that a reader could see which of the base and
 * temporary scores the engine had taken the modifier from — one column blank, the other filled.
 * That is a lot of table to say one thing, and it says it by *absence*, which is the least legible
 * way to say anything. The single column shows the modifier in use and the row shows both scores,
 * so the same fact reads off the row directly.
 *
 * The ability's full name, not its three-letter abbreviation: this table has four columns now and
 * the room for it, and "Strength" needs no `<abbr title>` to be understood.
 */
import type { CharacterBody, DerivedSheet } from "../api/types";
import { ABILITIES } from "../api/types";
import { useT } from "../i18n";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { numberClass, signed } from "./fields";

interface Props {
  draft: CharacterBody;
  derived: DerivedSheet;
  update: (changes: Partial<CharacterBody>) => void;
}

type ScoreField = "str_score" | "dex_score" | "con_score" | "int_score" | "wis_score" | "cha_score";
type TempField = "str_temp" | "dex_temp" | "con_temp" | "int_temp" | "wis_temp" | "cha_temp";

/**
 * Column headings wrap; `TableHead` forbids it by default.
 *
 * The heading is the widest thing in three of these four columns, so a heading that cannot break is
 * what sets the table's minimum width — and in French "Modificateur utilisé" set that minimum past
 * the panel, which put a horizontal scrollbar under the table and slid "Caractéristique" out of
 * view on the left. Two lines of heading cost the header row a few pixels of height once; a
 * scrollbar costs the reader the first column every time they look. The rows keep `nowrap`: an
 * ability's name is what the row is called and breaking "Constitution" says nothing.
 */
const HEAD =
  "h-8 px-2 text-[0.68rem] font-medium uppercase tracking-[0.05em] whitespace-normal text-muted-foreground";
const CELL = "px-2 py-1";

/**
 * A score box, floored as well as capped.
 *
 * `max-w-20` alone is what a wide panel needs; the `min-w-16` is what a narrow one needs. This
 * table is `w-auto`, so its columns are sized by their content — and the widest content in the
 * score columns is the *header*, which is "Score" in one and "Temp. score" in the other. Beside the
 * derived rail the abilities panel is narrow enough that the short header lets its column collapse
 * to about forty pixels, and a two-digit number plus a spinner does not fit in forty pixels: the
 * value is still there, still correct, and simply not visible. A field that silently stops showing
 * what is in it is worse than one that overflows.
 */
const SCORE = `${numberClass} min-w-16 max-w-20`;

export function AbilityTable({ draft, derived, update }: Props) {
  const t = useT();
  return (
    // Full width now that there are four columns and the widest is a name: the modifier in use
    // belongs at the right-hand rule where every other total on the sheet sits.
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className={HEAD}>
            {t("abilities.head.ability")}
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            {t("abilities.head.score")}
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            {t("abilities.head.tempScore")}
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            {t("abilities.head.modifierInUse")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ABILITIES.map(({ key, short }) => {
          const score = `${short.toLowerCase()}_score` as ScoreField;
          const temp = `${short.toLowerCase()}_temp` as TempField;
          const block = derived.abilities[key];
          // Every control in this row is addressed by the ability's name, so the name has to be
          // the translated one. `short` is still the SRD abbreviation the draft's field names are
          // built from — `str_score`, `str_temp` — and is not shown any more.
          const label = t(`ability.${key}`);
          return (
            <TableRow key={key}>
              <TableHead scope="row" className={`${CELL} font-medium whitespace-nowrap`}>
                {label}
              </TableHead>
              <TableCell className={CELL}>
                <Input
                  aria-label={t("abilities.aria.score", { ability: label })}
                  className={SCORE}
                  type="number"
                  min={1}
                  max={99}
                  value={draft[score] ?? 10}
                  onChange={(event) => update({ [score]: Number(event.target.value) })}
                />
              </TableCell>
              <TableCell className={CELL}>
                <Input
                  aria-label={t("abilities.aria.tempScore", { ability: label })}
                  className={SCORE}
                  type="number"
                  min={1}
                  max={99}
                  value={draft[temp] ?? ""}
                  onChange={(event) =>
                    update({ [temp]: event.target.value === "" ? null : Number(event.target.value) })
                  }
                />
              </TableCell>
              <TableCell className={CELL}>
                {/* The modifier the engine is actually using, whichever score it came from. */}
                <output
                  aria-label={t("abilities.aria.modifier", { ability: label })}
                  className="block text-right font-semibold text-primary"
                >
                  {signed(block.modifier)}
                </output>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
