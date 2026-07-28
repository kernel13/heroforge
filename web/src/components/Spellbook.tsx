/**
 * The spellbook — page three.
 *
 * This is the wizard's *book*: the spells scribed in it, level by level. It is deliberately not the
 * grid on page two, which says how many spells of each level the character knows and can cast per
 * day. A wizard's book holds far more spells than they prepare, and the two answer different
 * questions at the table — "what could I prepare tomorrow?" against "how many can I cast today?"
 * Page two keeps its grid; this page lists the contents.
 *
 * **The level is the row's position, not a field on it.** `Spellbook` is ten groups indexed by
 * spell level, so there is no level to type, mistype, or validate, and the table cannot hold a
 * spell at a level the game has none of. See `lib/spells.ts`.
 *
 * **Nothing here is computed**, and there is nothing here that could be: a spell's level and school
 * are reference data this application does not have until a later phase, so both are typed. There
 * is deliberately no inference from the character's class levels to which levels of the book are
 * "available" — `class_levels` is free text, and a book greyed out at level 6 because a component
 * guessed the character was a Wizard 10 would be the sheet refusing to hold what a player wrote.
 *
 * Every group's rows are player-added, like the feats and languages lists and unlike the skills
 * table, so there is no eager row creation and every row is removable.
 */
import type { CharacterBody } from "../api/types";
import { useT, type TranslationKey } from "../i18n";
import {
  SPELL_LEVELS,
  emptySpellbookEntry,
  readSpellBook,
  writeSpellBook,
  type Spellbook,
  type SpellbookEntry,
} from "../lib/spells";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconSpellbook } from "./icons";
import { Note, Panel, controlClass, numberClass } from "./fields";

interface Props {
  draft: CharacterBody;
  update: (changes: Partial<CharacterBody>) => void;
}

const HEAD =
  "h-8 px-1.5 text-[0.68rem] font-medium uppercase tracking-[0.05em] text-muted-foreground";
const CELL = "px-1.5 py-0.5";
/** The bar that opens each level's group of rows. */
const GROUP =
  "h-8 px-1.5 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-heading";

/**
 * The three typed columns, in the order a player reads a spell entry in a rulebook.
 *
 * `page` reuses the feats and possessions lists' `Pg.` heading and its `title`: it is the same
 * rulebook reference under the same abbreviation, and writing it twice is how two columns that mean
 * one thing drift apart.
 */
const COLUMNS = [
  { key: "name", head: "spellbook.head.name", aria: "spellbook.aria.name", cell: controlClass },
  {
    key: "school",
    head: "spellbook.head.school",
    aria: "spellbook.aria.school",
    cell: controlClass,
  },
  {
    key: "page",
    head: "lists.head.page",
    aria: "spellbook.aria.page",
    cell: `${numberClass} max-w-16`,
  },
] as const satisfies readonly {
  key: keyof SpellbookEntry;
  head: TranslationKey;
  aria: TranslationKey;
  cell: string;
}[];

export function SpellbookPage({ draft, update }: Props) {
  const t = useT();
  // Read-only, exactly as `SpellsBlock` reads it: the parse never writes a canonicalised copy back.
  // An `update()` from a render advances the sheet's edit counter every pass, which re-arms the
  // 250 ms derive and restarts the 2 s save timer for as long as the page is on screen.
  const book = readSpellBook(draft.spells_raw);

  const write = (spellbook: Spellbook) => {
    update({ spells_raw: writeSpellBook({ ...book, spellbook }) });
  };

  /** Replace one level's group, leaving the other nine as they were. */
  const changeLevel = (level: number, entries: SpellbookEntry[]) => {
    write(book.spellbook.map((group, position) => (position === level ? entries : group)));
  };

  const changeEntry = (level: number, index: number, changes: Partial<SpellbookEntry>) => {
    const group = book.spellbook[level] ?? [];
    changeLevel(
      level,
      group.map((entry, position) => (position === index ? { ...entry, ...changes } : entry)),
    );
  };

  return (
    <Panel title={t("panel.spellbook")} icon={<IconSpellbook />}>
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead
                key={column.key}
                scope="col"
                className={HEAD}
                title={column.key === "page" ? t("lists.head.page.title") : undefined}
              >
                {t(column.head)}
              </TableHead>
            ))}
            <TableHead scope="col" className={HEAD} />
          </TableRow>
        </TableHeader>

        {/* One `<tbody>` per spell level, each opened by a `scope="rowgroup"` heading. That is what
            makes the level the *heading* of the rows under it rather than a repeated column, which
            is the whole reason the level is a position in the data and not a field on a row.
            A level with nothing in it still draws its bar: the bar carries the control that adds
            the first spell to it. */}
        {SPELL_LEVELS.map((level) => {
          const group = book.spellbook[level] ?? [];
          return (
            <TableBody key={level}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {/* One key per language, interpolating the plain number. Not the written ordinal
                    from `spells.level.*`: "Level 3rd" is not a sentence, and each language puts
                    the number somewhere else in the phrase anyway. */}
                <TableHead scope="rowgroup" colSpan={COLUMNS.length} className={GROUP}>
                  {t("spellbook.group", { level })}
                </TableHead>
                {/* The control sits in its own cell rather than inside the heading. A `<th>` with
                    a button in it has "Add" appended to the accessible name of the heading, which
                    is the same defect as an icon leaking into a control's name — one level up, and
                    on the element that tells a screen-reader user which level's rows follow. */}
                <TableCell className={`${CELL} text-right`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t("spellbook.aria.add", { level })}
                    onClick={() => changeLevel(level, [...group, emptySpellbookEntry()])}
                  >
                    {t("spellbook.add")}
                  </Button>
                </TableCell>
              </TableRow>

              {group.map((entry, index) => (
                <TableRow key={index}>
                  {COLUMNS.map((column) => (
                    <TableCell key={column.key} className={CELL}>
                      <Input
                        type="text"
                        className={column.cell}
                        aria-label={t(column.aria, { level, n: index + 1 })}
                        value={entry[column.key]}
                        onChange={(event) =>
                          changeEntry(level, index, { [column.key]: event.target.value })
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell className={CELL}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("spellbook.aria.remove", { level, n: index + 1 })}
                      onClick={() =>
                        changeLevel(
                          level,
                          group.filter((_, position) => position !== index),
                        )
                      }
                    >
                      ×
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          );
        })}
      </Table>

      <Note>{t("spellbook.note")}</Note>
    </Panel>
  );
}
