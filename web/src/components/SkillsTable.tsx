/**
 * The skills table.
 *
 * Every derived column — the ability modifier, the armour check penalty actually applied, the
 * total, and the maximum ranks — comes from the `DerivedSheet` and is matched to its draft row by
 * the row's identifier. Ranks are whole numbers, so the column is a plain number input; the API
 * refuses a fraction rather than storing one the engine would then have to floor.
 *
 * The trained-only and armour-check flags stay plain `<abbr title>` rather than becoming a
 * tooltip: a tooltip moves the explanation into `aria-describedby` and drops the `title`
 * attribute, and forty rows of hover-only affordances is worse than forty rows of `title`.
 */
import { useMemo } from "react";
import type { CharacterBody, DerivedSkill, SkillDefinition, SkillRow } from "../api/types";
import {
  interpolate,
  skillCollator,
  sortBySkillName,
  useI18n,
  type TranslationKey,
} from "../i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Note, Panel, controlClass, numberClass, signed } from "./fields";
import { IconSkills } from "./icons";

interface Props {
  draft: CharacterBody;
  skills: DerivedSkill[];
  /** `DerivedSheet.total_ranks` — summed by the engine, not by a `reduce()` over `draft.skills`. */
  totalRanks: number;
  definitions: SkillDefinition[];
  update: (changes: Partial<CharacterBody>) => void;
}

const HEAD = "h-8 px-1.5 text-[0.68rem] font-medium uppercase tracking-[0.05em] text-muted-foreground";
const CELL = "px-1.5 py-0.5";
const COMPONENT = "block text-right text-muted-foreground";

/**
 * The row's display name — the name every control in the row is addressed by.
 *
 * A reference row is named by its definition, which carries the translation; a custom row is
 * named by what the player typed, which is theirs and is not translated.
 */
function label(
  row: SkillRow,
  definition: SkillDefinition | undefined,
  skillName: (definition: SkillDefinition) => string,
): string {
  const base = definition === undefined ? (row.custom_name ?? "") : skillName(definition);
  return row.specialization != null && row.specialization !== ""
    ? `${base} (${row.specialization})`
    : base;
}

const HEADINGS = [
  { key: "skills.head.class", title: "skills.head.class.title" },
  { key: "skills.head.skill" },
  { key: "skills.head.keyAbility" },
  { key: "skills.head.total" },
  { key: "skills.head.ranks" },
  { key: "skills.head.ability" },
  { key: "skills.head.armour", title: "skills.head.armour.title" },
  { key: "skills.head.misc" },
  { key: "skills.head.maxRanks" },
] as const satisfies readonly { key: TranslationKey; title?: TranslationKey }[];

export function SkillsTable({ draft, skills, totalRanks, definitions, update }: Props) {
  const i18n = useI18n();
  const { t, skillName } = i18n;
  const rows = draft.skills ?? [];
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const derivedFor = (index: number): DerivedSkill | undefined => skills[index];

  /**
   * The rows in reading order, each still carrying **where it is stored**.
   *
   * `index` is a row's position in `draft.skills`, and that position is load-bearing twice over:
   * it is how a row is paired with its `DerivedSkill`, and it is what a write targets. Sorting the
   * rows and then using the sorted position for either would silently attribute one skill's total
   * to another and write a rank into the wrong row — a bug that looks like the engine is wrong.
   * So the sort reorders a list of positions; nothing downstream changes.
   */
  const collator = useMemo(() => skillCollator(i18n.locale), [i18n.locale]);
  const ordered = sortBySkillName(
    rows.map((row, index) => ({ row, index })),
    (entry) => entry.row.skill_id,
    definitions,
    i18n,
    collator,
  );

  const change = (index: number, changes: Partial<SkillRow>) => {
    update({
      skills: rows.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    });
  };

  /**
   * Drop a row.
   *
   * `index` is the row's position in `draft.skills`, never its position on screen — the sort is
   * display only, and filtering on the sorted position deletes whichever skill happens to sit
   * there in the current language.
   *
   * Only the blank rows a player added are removable. The SRD rows are created with the character,
   * eagerly and once; letting one go would put the reconciliation that eager creation exists to
   * avoid back into both the list endpoint and this component.
   *
   * One known window: `derivedFor` pairs positionally, so for the 250 ms until the recompute lands
   * every row stored *after* the removed one reads the derived values of its neighbour. Removing
   * the last row — which is where a custom row sits, since they are appended and reload in
   * `ordinal` order — shifts nothing, so it takes two custom rows to see it, and it heals itself.
   * `DerivedSkill.key` exists to pair the two lists by identity instead; that is a change to every
   * column of this table, not to this function.
   */
  const removeRow = (index: number) => {
    update({ skills: rows.filter((_, position) => position !== index) });
  };

  const addCustomRow = () => {
    update({
      skills: [
        ...rows,
        {
          // One past the highest ordinal in use, not `rows.length`: once a row can be removed the
          // count collides with an ordinal still on another row.
          ordinal: rows.reduce((highest, row) => Math.max(highest, row.ordinal ?? 0), -1) + 1,
          custom_name: t("skills.newSkill"),
          custom_key_ability: "INT",
          ranks: 0,
          misc_modifier: 0,
          is_class_skill: false,
        },
      ],
    });
  };

  return (
    <Panel
      title={t("panel.skills")}
      icon={<IconSkills />}
      meta={interpolate(t("skills.totalRanks"), {
        total: (
          <output aria-label={t("skills.aria.totalRanks")} className="font-semibold text-foreground">
            {totalRanks}
          </output>
        ),
      })}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {HEADINGS.map((heading) => (
              <TableHead
                key={heading.key}
                scope="col"
                className={HEAD}
                title={"title" in heading ? t(heading.title) : undefined}
              >
                {t(heading.key)}
              </TableHead>
            ))}
            {/* The remove column. Unlabelled, as in the possessions and reference lists: each
                button carries the name of the row it removes. */}
            <TableHead scope="col" className={HEAD} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map(({ row, index }) => {
            const definition = row.skill_id != null ? byId.get(row.skill_id) : undefined;
            const derived = derivedFor(index);
            const name = label(row, definition, skillName);
            const untrained = definition?.usable_untrained ?? true;
            const unusable = !untrained && (row.ranks ?? 0) < 1;

            return (
              <TableRow
                key={row.id ?? `row-${index}`}
                className={cn(unusable && "text-muted-foreground")}
              >
                <TableCell className={CELL}>
                  <Checkbox
                    aria-label={t("skills.aria.classSkill", { skill: name })}
                    checked={row.is_class_skill ?? false}
                    onCheckedChange={(checked) =>
                      change(index, { is_class_skill: checked === true })
                    }
                  />
                </TableCell>
                <TableCell className={`${CELL} min-w-56 whitespace-normal`}>
                  {definition === undefined ? (
                    <Input
                      type="text"
                      aria-label={t("skills.aria.name")}
                      className={controlClass}
                      value={row.custom_name ?? ""}
                      onChange={(event) => change(index, { custom_name: event.target.value })}
                    />
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span>{skillName(definition)}</span>
                      {definition.takes_specialization && (
                        <Input
                          type="text"
                          className={`${controlClass} max-w-40`}
                          aria-label={t("skills.aria.specialisation", { skill: skillName(definition) })}
                          placeholder={t("skills.placeholder.specialisation")}
                          value={row.specialization ?? ""}
                          onChange={(event) =>
                            change(index, { specialization: event.target.value })
                          }
                        />
                      )}
                      {!definition.usable_untrained && (
                        <abbr
                          className="text-xs text-primary no-underline"
                          title={t("skills.trainedOnly")}
                        >
                          T
                        </abbr>
                      )}
                      {definition.armor_check_penalty && (
                        <abbr
                          className="text-xs text-primary no-underline"
                          title={t(definition.acp_double ? "skills.acpDouble" : "skills.acp")}
                        >
                          {definition.acp_double ? "**" : "*"}
                        </abbr>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className={`${CELL} text-xs text-muted-foreground`}>
                  {derived?.key_ability ?? ""}
                </TableCell>
                <TableCell className={CELL}>
                  {/*
                   * Blank until the skill has a rank in it. The gate reads the **derived** row's
                   * ranks, not the draft's: they arrive together, so a rank just typed cannot
                   * briefly reveal the total computed from the previous one. The `<output>` itself
                   * stays in the tree with its accessible name — every suite here addresses a
                   * derived value by that name, and removing the element makes it unfindable
                   * rather than empty.
                   */}
                  <output aria-label={t("skills.aria.total", { skill: name })} className="block text-right font-semibold">
                    {derived === undefined || derived.ranks === 0 ? "" : signed(derived.total)}
                  </output>
                </TableCell>
                <TableCell className={CELL}>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className={`${numberClass} max-w-20`}
                    aria-label={t("skills.aria.ranks", { skill: name })}
                    value={row.ranks ?? 0}
                    onChange={(event) => change(index, { ranks: Number(event.target.value) })}
                  />
                </TableCell>
                <TableCell className={CELL}>
                  <span className={COMPONENT}>
                    {derived === undefined ? "" : signed(derived.ability_modifier)}
                  </span>
                </TableCell>
                <TableCell className={CELL}>
                  <span className={COMPONENT}>
                    {derived === undefined || derived.armor_check_penalty === 0
                      ? ""
                      : signed(derived.armor_check_penalty)}
                  </span>
                </TableCell>
                <TableCell className={CELL}>
                  <Input
                    type="number"
                    className={`${numberClass} max-w-20`}
                    aria-label={t("skills.aria.misc", { skill: name })}
                    value={row.misc_modifier ?? 0}
                    onChange={(event) =>
                      change(index, { misc_modifier: Number(event.target.value) })
                    }
                  />
                </TableCell>
                <TableCell className={CELL}>
                  <span className={COMPONENT}>{derived?.max_ranks ?? ""}</span>
                </TableCell>
                <TableCell className={CELL}>
                  {/* Gated on `skill_id`, not on the definition being missing: a row pointing at a
                      skill this build has never heard of is still an SRD row, and offering to
                      delete it would turn a stale bundle into lost data. */}
                  {row.skill_id == null && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("skills.aria.remove", { skill: name })}
                      onClick={() => removeRow(index)}
                    >
                      ×
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addCustomRow}>
        {t("skills.addRow")}
      </Button>

      {/* The three markers are elements inside the sentence, so the sentence is interpolated
          rather than cut into fragments — French puts them in different places. */}
      <Note>
        {interpolate(t("skills.note"), {
          acp: <abbr title={t("skills.acp")}>*</abbr>,
          acpDouble: <abbr title={t("skills.acpDouble")}>**</abbr>,
          trained: <abbr title={t("skills.trainedOnly")}>T</abbr>,
        })}
      </Note>
    </Panel>
  );
}
