/**
 * The spellcasting block: one panel, one section per spellcasting class.
 *
 * This follows the printed record sheet's SPELLS column — the domains/specialty school line, the
 * spell save DC modifier, the arcane spell failure chance, and the grid of spells known / save DC /
 * spells per day / bonus spells for levels 0 through 9. A character with two casting classes gets
 * two blocks, which is what the printed form has no room for and a Mystic Theurge needs.
 *
 * The spells *themselves* are not written out level by level here. They were, briefly, as ten more
 * text fields beside the grid; they are the free-text notes at the foot of the panel instead. Ten
 * boxes holding a comma-separated list each is a worse way to write a spell list than one
 * paragraph, and it doubled the height of every block to say so.
 *
 * **Nothing in here is computed.** Every figure is typed, exactly as the base attack bonus and the
 * base saves are: spells per day comes from class progression tables and a save DC from an ability
 * modifier the engine would have to be told which class casts with, and both are later phases. See
 * `lib/spells.ts` for why they are held as strings.
 *
 * Which class casts is *typed* too. `class_levels` holds free text and there is no class reference
 * data until phase 2, so nothing here can look at "Wizard 4 / Rogue 3" and know which half of it
 * prepares spells.
 */
import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import type { CharacterBody } from "../api/types";
import { useT, type TranslationKey } from "../i18n";
import {
  SPELL_LEVELS,
  casterNames,
  emptyCaster,
  emptyLevelRow,
  readSpellBook,
  spellLevelKey,
  writeSpellBook,
  type SpellBook,
  type SpellCaster,
  type SpellLevelRow,
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
import { cn } from "@/lib/utils";
import { IconSpells } from "./icons";
import { Fieldset, Note, Panel, Row, TextAreaField, TextField } from "./fields";

interface Props {
  draft: CharacterBody;
  update: (changes: Partial<CharacterBody>) => void;
}

const HEAD =
  "h-8 px-1 text-[0.62rem] leading-tight font-medium uppercase tracking-[0.04em] text-muted-foreground";
const CELL = "px-1 py-0.5";
/** Denser than the sheet's own controls: a block is ten rows of four, and there can be two. */
const TIGHT = "h-7 px-1.5 text-sm";
const LEVEL = "text-[0.8rem] font-semibold tabular-nums text-muted-foreground";

/**
 * The grid's columns, in the printed form's own order.
 *
 * `null` is where LEVEL goes — the form puts it in the *middle*, between what a caster knows and
 * what they can cast, not at the edge where a table would normally key its rows. The export's
 * `SPELL_FIGURES` is the same list, so the screen and the printout read in the same order.
 */
const COLUMNS = [
  { key: "known", head: "spells.head.known", aria: "spells.aria.known" },
  { key: "save_dc", head: "spells.head.saveDc", aria: "spells.aria.saveDc" },
  null,
  { key: "per_day", head: "spells.head.perDay", aria: "spells.aria.perDay" },
  { key: "bonus", head: "spells.head.bonus", aria: "spells.aria.bonus" },
] as const satisfies readonly ({
  key: keyof SpellLevelRow;
  head: TranslationKey;
  aria: TranslationKey;
} | null)[];

/**
 * The block's name, in its own `<legend>`, with the control that changes it beside it.
 *
 * The class used to be typed in a field under the legend, which meant the block wrote its own
 * title twice — once as the frame's label and once in the first box of the form inside it. The
 * name is the block's title, so it is edited *there*, and the row underneath gets the width back.
 *
 * A blank block *shows* the prompt and is *named* by its position: the prompt is what a player
 * needs on screen, where two empty boxes are already two visibly separate boxes, while every
 * accessible name in the block still comes from `casterNames()` — and there, two blocks answering
 * to the same words is a `getByLabelText` that throws rather than resolves.
 *
 * The glyph is `lucide-react`'s: this is an application control, like the header's back arrow and
 * the language switcher, not one of the sheet's section glyphs from `icons.tsx`. Lucide sets its
 * own `aria-hidden`, so the button's `aria-label` is the whole of its accessible name.
 */
function CasterLegend({
  name,
  value,
  editorLabel,
  renameLabel,
  placeholder,
  onChange,
}: {
  /** What the block is called on screen — never the raw `class_name`. */
  name: string;
  value: string;
  editorLabel: string;
  renameLabel: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // Set only on the keyboard's way out. Closing on blur means focus has already gone somewhere the
  // player chose — pulling it back to the pencil would take them out of the field they just
  // reached with Tab.
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (editing || !restoreFocus.current) return;
    restoreFocus.current = false;
    button.current?.focus();
  }, [editing]);

  const close = (fromKeyboard: boolean) => {
    restoreFocus.current = fromKeyboard;
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        type="text"
        // The legend is a 0.6rem letterspaced capital, which is a label. What the player is
        // typing is a name, so the editor is lettered as one.
        className="h-6 w-44 px-1.5 text-sm font-medium normal-case tracking-normal text-foreground"
        autoFocus
        aria-label={editorLabel}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => close(false)}
        onKeyDown={(event) => {
          // Both keys do the same thing, and neither is an undo: every keystroke is already in
          // the draft, exactly as it is for the two hundred other controls on this sheet.
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            close(true);
          }
        }}
      />
    );
  }

  return (
    <>
      {value.trim() === "" ? (
        // On screen a blank block asks for the class; two of them are two visibly separate boxes.
        // In the accessibility tree it is still `casterNames()`' positional fallback — that is what
        // this block's fifty-odd controls are named from, and there nothing tells them apart but
        // the position. `normal-case` because `field-label` would letter the prompt as a heading.
        <span className="normal-case italic">{placeholder}</span>
      ) : (
        name
      )}
      <button
        ref={button}
        type="button"
        aria-label={renameLabel}
        onClick={() => setEditing(true)}
        className={cn(
          "rounded-sm p-0.5 text-muted-foreground transition-colors",
          "hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        )}
      >
        <Pencil className="size-3" />
      </button>
    </>
  );
}

export function SpellsBlock({ draft, update }: Props) {
  const t = useT();
  // Read-only: the parse never writes a canonicalised copy back. An `update()` from a render would
  // advance the sheet's edit counter every pass, re-arming the derive debounce and restarting the
  // save timer for as long as the panel is on screen.
  const book = readSpellBook(draft.spells_raw);
  const names = casterNames(book.casters, t);

  const write = (changes: Partial<SpellBook>) => {
    update({ spells_raw: writeSpellBook({ ...book, ...changes }) });
  };

  const changeCaster = (index: number, changes: Partial<SpellCaster>) => {
    write({
      casters: book.casters.map((caster, position) =>
        position === index ? { ...caster, ...changes } : caster,
      ),
    });
  };

  const changeLevel = (index: number, level: number, changes: Partial<SpellLevelRow>) => {
    const caster = book.casters[index];
    if (caster === undefined) return;
    changeCaster(index, {
      levels: caster.levels.map((row, position) =>
        position === level ? { ...row, ...changes } : row,
      ),
    });
  };

  return (
    <Panel title={t("panel.spells")} icon={<IconSpells />}>
      {/* Two casting classes side by side wherever there is room, as the export lays them out — a
          block is five narrow columns wide, and stacking them spends the width of the page on
          nothing. `auto-fit` lets the block's own minimum decide when the row breaks. */}
      <div
        className={cn(
          "mb-3 grid items-start gap-x-5 gap-y-1 [&>fieldset]:mb-0",
          "[grid-template-columns:repeat(auto-fit,minmax(420px,1fr))]",
        )}
      >
        {book.casters.map((caster, index) => {
          const name = names[index] ?? "";
          return (
            <Fieldset
              key={index}
              legend={
                <CasterLegend
                  name={name}
                  value={caster.class_name}
                  editorLabel={t("spells.aria.class", { n: index + 1 })}
                  renameLabel={t("spells.caster.rename", { caster: name })}
                  placeholder={t("spells.caster.placeholder")}
                  onChange={(class_name) => changeCaster(index, { class_name })}
                />
              }
              icon={<IconSpells />}
            >
              <Row className="mb-3">
                <TextField
                  label={t("spells.caster.domains")}
                  aria={t("spells.aria.domains", { caster: name })}
                  value={caster.domains}
                  onChange={(domains) => changeCaster(index, { domains })}
                />
                <TextField
                  label={t("spells.caster.saveDcMod")}
                  aria={t("spells.aria.saveDcMod", { caster: name })}
                  value={caster.save_dc_mod}
                  onChange={(save_dc_mod) => changeCaster(index, { save_dc_mod })}
                  compact
                />
                <TextField
                  label={t("spells.caster.arcaneFailure")}
                  aria={t("spells.aria.arcaneFailure", { caster: name })}
                  value={caster.arcane_failure}
                  onChange={(arcane_failure) => changeCaster(index, { arcane_failure })}
                  compact
                />
              </Row>

              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map((column) => (
                      <TableHead
                        key={column?.key ?? "level"}
                        scope="col"
                        className={`${HEAD} text-center`}
                      >
                        {t(column === null ? "spells.head.level" : column.head)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SPELL_LEVELS.map((level) => {
                    const row = caster.levels[level] ?? emptyLevelRow();
                    return (
                      <TableRow key={level}>
                        {COLUMNS.map((column) =>
                          column === null ? (
                            // The *name* of the level is display; the accessible names carry the
                            // plain number. "level 3rd" is not a sentence in either language, and a
                            // label spelled the way a column heading is spelled is a label that
                            // changes every time the heading does.
                            <TableCell key="level" className={`${CELL} ${LEVEL} text-center`}>
                              {t(spellLevelKey(level))}
                            </TableCell>
                          ) : (
                            <TableCell key={column.key} className={CELL}>
                              <Input
                                type="text"
                                className={`${TIGHT} w-full min-w-10 text-center`}
                                aria-label={t(column.aria, { caster: name, level })}
                                value={row[column.key]}
                                onChange={(event) =>
                                  changeLevel(index, level, { [column.key]: event.target.value })
                                }
                              />
                            </TableCell>
                          ),
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Its own bordered control under the block, not a bare × among the fields.
                  A block is a page of boxes, and an unbordered glyph sitting on whichever line
                  the header happened to wrap onto is a control nobody finds — which is exactly
                  what happened to the first version of this. The visible word is short and the
                  accessible name says *which* class, so the two agree for someone driving the
                  sheet by voice. */}
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t("spells.aria.remove", { caster: name })}
                  onClick={() =>
                    write({ casters: book.casters.filter((_, position) => position !== index) })
                  }
                >
                  {t("spells.remove")}
                </Button>
              </div>
            </Fieldset>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => write({ casters: [...book.casters, emptyCaster()] })}
      >
        {t("spells.add")}
      </Button>
      <Note>{t("spells.casters.note")}</Note>

      <div className="mt-4">
        <TextAreaField
          label={t("spells.notes.label")}
          rows={5}
          value={book.notes}
          onChange={(notes) => write({ notes })}
        />
        <Note>{t("spells.note")}</Note>
      </div>
    </Panel>
  );
}
