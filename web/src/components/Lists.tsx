/**
 * Feats, special abilities, languages, and class levels.
 *
 * All stored, none computed. Feats and special abilities keep the sheet's PG. column beside them.
 * The spell blocks are next door in `Spells.tsx`, which is the same idea at ten times the size.
 */
import type { ReactNode } from "react";
import type { CharacterBody, ClassLevelRow, NamedReference } from "../api/types";
import { useT, type TranslationKey } from "../i18n";
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
import { IconClassLevel, IconFeats, IconLanguages, IconSpecialAbilities } from "./icons";
import { Note, NumberField, Panel, Row, TextField, controlClass, numberClass } from "./fields";

interface Props {
  draft: CharacterBody;
  update: (changes: Partial<CharacterBody>) => void;
}

type ReferenceField = "feats" | "special_abilities";

const HEAD = "h-8 px-1.5 text-[0.68rem] font-medium uppercase tracking-[0.05em] text-muted-foreground";
const CELL = "px-1.5 py-0.5";

/**
 * Feats and special abilities are the same table twice.
 *
 * The list's own name is part of every control's accessible name — "Feats 2 page" — so the
 * component takes the *key* and translates it, rather than taking an already-translated string:
 * the aria templates need the same word the heading uses, in the same language.
 */
function ReferenceList({
  draft,
  update,
  field,
  title,
  icon,
}: Props & { field: ReferenceField; title: TranslationKey; icon: ReactNode }) {
  const t = useT();
  const rows: NamedReference[] = draft[field] ?? [];
  const list = t(title);

  const change = (index: number, changes: Partial<NamedReference>) => {
    update({
      [field]: rows.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    });
  };

  return (
    <Panel title={list} icon={icon}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className={HEAD}>
              {t("lists.head.name")}
            </TableHead>
            <TableHead scope="col" className={HEAD} title={t("lists.head.page.title")}>
              {t("lists.head.page")}
            </TableHead>
            <TableHead scope="col" className={HEAD} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              <TableCell className={CELL}>
                <Input
                  type="text"
                  className={controlClass}
                  aria-label={t("lists.aria.name", { list, n: index + 1 })}
                  value={row.name ?? ""}
                  onChange={(event) => change(index, { name: event.target.value })}
                />
              </TableCell>
              <TableCell className={CELL}>
                <Input
                  type="text"
                  className={`${numberClass} max-w-16`}
                  aria-label={t("lists.aria.page", { list, n: index + 1 })}
                  value={row.page ?? ""}
                  onChange={(event) => change(index, { page: event.target.value })}
                />
              </TableCell>
              <TableCell className={CELL}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("lists.aria.remove", { list: list.toLowerCase(), n: index + 1 })}
                  onClick={() =>
                    update({ [field]: rows.filter((_, position) => position !== index) })
                  }
                >
                  ×
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => update({ [field]: [...rows, { name: "", page: "" }] })}
      >
        {t("lists.add")}
      </Button>
    </Panel>
  );
}

export function FeatsBlock(props: Props) {
  return <ReferenceList {...props} field="feats" title="panel.feats" icon={<IconFeats />} />;
}

export function SpecialAbilitiesBlock(props: Props) {
  return (
    <ReferenceList
      {...props}
      field="special_abilities"
      title="panel.specialAbilities"
      icon={<IconSpecialAbilities />}
    />
  );
}

export function LanguagesBlock({ draft, update }: Props) {
  const t = useT();
  const rows = draft.languages ?? [];
  return (
    <Panel title={t("panel.languages")} icon={<IconLanguages />}>
      <ul className="flex list-none flex-wrap gap-2 p-0">
        {rows.map((language, index) => (
          <li key={index} className="flex items-center gap-1">
            <Input
              type="text"
              className={`${controlClass} w-40`}
              aria-label={t("languages.aria.name", { n: index + 1 })}
              value={language}
              onChange={(event) =>
                update({
                  languages: rows.map((row, position) =>
                    position === index ? event.target.value : row,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("languages.aria.remove", { n: index + 1 })}
              onClick={() =>
                update({ languages: rows.filter((_, position) => position !== index) })
              }
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => update({ languages: [...rows, ""] })}
      >
        {t("languages.add")}
      </Button>
    </Panel>
  );
}

export function ClassLevelsBlock({ draft, update }: Props) {
  const t = useT();
  const rows = draft.class_levels ?? [];

  const change = (index: number, changes: Partial<ClassLevelRow>) => {
    update({
      class_levels: rows.map((row, position) =>
        position === index ? { ...row, ...changes } : row,
      ),
    });
  };

  return (
    <Panel title={t("panel.classLevel")} icon={<IconClassLevel />}>
      {rows.map((row, index) => (
        <Row key={index} className="mb-3">
          <TextField
            label={t("classLevels.class")}
            value={row.class_name ?? ""}
            onChange={(class_name) => change(index, { class_name })}
          />
          <NumberField
            label={t("classLevels.level")}
            value={row.level ?? 1}
            min={1}
            onChange={(level) => change(index, { level })}
            compact
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("classLevels.remove", { n: index + 1 })}
            onClick={() =>
              update({ class_levels: rows.filter((_, position) => position !== index) })
            }
          >
            ×
          </Button>
        </Row>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          update({
            class_levels: [...rows, { ordinal: rows.length, class_name: "", level: 1 }],
          })
        }
      >
        {t("classLevels.add")}
      </Button>
      <Note>{t("classLevels.note")}</Note>
    </Panel>
  );
}

