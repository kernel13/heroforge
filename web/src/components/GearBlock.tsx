/**
 * Page 2: the GEAR slots, possessions with the derived encumbrance, money, and the attack blocks.
 */
import type { ReactNode } from "react";
import type {
  ArmorRow,
  ArmorSlot,
  AttackRow,
  CharacterBody,
  DerivedSheet,
  PossessionRow,
} from "../api/types";
import { useI18n, useT, type TranslationKey } from "../i18n";
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
import {
  IconArmorSlot,
  IconAttack,
  IconAttacks,
  IconGear,
  IconMoney,
  IconPossessions,
  IconProtectiveItem,
  IconShieldSlot,
} from "./icons";
import {
  Derived,
  Fieldset,
  Note,
  NumberField,
  OptionalNumberField,
  Panel,
  Row,
  TextField,
  TotalsRow,
  WeightField,
  WeightInput,
  controlClass,
  numberClass,
  signed,
} from "./fields";

interface Props {
  draft: CharacterBody;
  derived: DerivedSheet;
  update: (changes: Partial<CharacterBody>) => void;
}

const SLOTS = [
  { slot: "armor", label: "gear.slot.armour", icon: <IconArmorSlot />, full: true },
  { slot: "shield", label: "gear.slot.shield", icon: <IconShieldSlot />, full: true },
  { slot: "protective_1", label: "gear.slot.protective", icon: <IconProtectiveItem />, full: false },
  { slot: "protective_2", label: "gear.slot.protective", icon: <IconProtectiveItem />, full: false },
] as const satisfies readonly {
  slot: ArmorSlot;
  label: TranslationKey;
  icon: ReactNode;
  full: boolean;
}[];

const EMPTY_PIECE = {
  name: "",
  type: "",
  ac_bonus: 0,
  max_dex: null,
  check_penalty: 0,
  spell_failure: 0,
  speed: "",
  weight: "0",
  special_properties: "",
};

const HEAD = "h-8 px-1.5 text-[0.68rem] font-medium uppercase tracking-[0.05em] text-muted-foreground";
const CELL = "px-1.5 py-0.5";

export function GearSlots({ draft, derived, update }: Props) {
  const t = useT();
  const pieces = draft.armor ?? [];
  const find = (slot: ArmorSlot): ArmorRow | undefined => pieces.find((p) => p.slot === slot);

  const change = (slot: ArmorSlot, changes: Partial<ArmorRow>) => {
    const existing = find(slot);
    const next: ArmorRow = existing
      ? { ...existing, ...changes }
      : { ...EMPTY_PIECE, slot, ...changes };
    update({
      armor: existing
        ? pieces.map((piece) => (piece.slot === slot ? next : piece))
        : [...pieces, next],
    });
  };

  const clear = (slot: ArmorSlot) => {
    update({ armor: pieces.filter((piece) => piece.slot !== slot) });
  };

  return (
    <Panel title={t("panel.gear")} icon={<IconGear />}>
      <Note>{t("gear.note", { total: signed(derived.armor_check_penalty) })}</Note>

      <div className="mt-3">
        {SLOTS.map(({ slot, label, icon, full }) => {
          const piece = find(slot);
          return (
            <Fieldset key={slot} legend={t(label)} icon={icon}>
              <Row>
                <TextField
                  label={t("gear.name")}
                  value={piece?.name ?? ""}
                  onChange={(name) => change(slot, { name })}
                />
                {full && (
                  <TextField
                    label={t("gear.type")}
                    value={piece?.type ?? ""}
                    onChange={(type) => change(slot, { type })}
                  />
                )}
                <NumberField
                  label={t("gear.acBonus")}
                  value={piece?.ac_bonus ?? 0}
                  onChange={(ac_bonus) => change(slot, { ac_bonus })}
                  compact
                />
                {full && (
                  <>
                    <OptionalNumberField
                      label={t("gear.maxDex")}
                      value={piece?.max_dex ?? null}
                      onChange={(max_dex) => change(slot, { max_dex })}
                    />
                    <NumberField
                      label={t("gear.checkPenalty")}
                      value={piece?.check_penalty ?? 0}
                      max={0}
                      onChange={(check_penalty) => change(slot, { check_penalty })}
                      compact
                    />
                    <NumberField
                      label={t("gear.spellFailure")}
                      value={piece?.spell_failure ?? 0}
                      onChange={(spell_failure) => change(slot, { spell_failure })}
                      compact
                    />
                    <TextField
                      label={t("gear.speed")}
                      value={piece?.speed ?? ""}
                      onChange={(speed) => change(slot, { speed })}
                    />
                  </>
                )}
                {/* Read in the reader's unit, stored in the engine's. The draft still holds
                    pounds — see `WeightField`. */}
                <WeightField
                  label={t("gear.weight")}
                  value={String(piece?.weight ?? "0")}
                  onChange={(weight) => change(slot, { weight })}
                  compact
                />
                <TextField
                  label={t("gear.special")}
                  value={piece?.special_properties ?? ""}
                  onChange={(special_properties) => change(slot, { special_properties })}
                  wide
                />
                {piece !== undefined && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => clear(slot)}
                  >
                    {t("gear.remove")}
                  </Button>
                )}
              </Row>
            </Fieldset>
          );
        })}
      </div>
    </Panel>
  );
}

export function PossessionsBlock({ draft, derived, update }: Props) {
  // Every figure in the totals below is a weight the engine returned, written in the unit the
  // reader reads in — pounds in English, kilograms in French. The rows above them are what the
  // player typed and stay in the engine's pounds, which is why the column says so.
  const { t, weight } = useI18n();
  const rows = draft.possessions ?? [];
  const load = derived.encumbrance;

  const change = (index: number, changes: Partial<PossessionRow>) => {
    update({
      possessions: rows.map((row, position) =>
        position === index ? { ...row, ...changes } : row,
      ),
    });
  };

  return (
    <Panel title={t("panel.possessions")} icon={<IconPossessions />}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className={HEAD}>
              {t("possessions.head.item")}
            </TableHead>
            <TableHead scope="col" className={HEAD} title={t("possessions.head.page.title")}>
              {t("possessions.head.page")}
            </TableHead>
            <TableHead scope="col" className={HEAD}>
              {t("possessions.head.weight")}
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
                  aria-label={t("possessions.aria.item", { n: index + 1 })}
                  value={row.item ?? ""}
                  onChange={(event) => change(index, { item: event.target.value })}
                />
              </TableCell>
              <TableCell className={CELL}>
                <Input
                  type="text"
                  className={`${numberClass} max-w-16`}
                  aria-label={t("possessions.aria.page", { n: index + 1 })}
                  value={row.page ?? ""}
                  onChange={(event) => change(index, { page: event.target.value })}
                />
              </TableCell>
              <TableCell className={CELL}>
                <WeightInput
                  className="max-w-20"
                  label={t("possessions.aria.weight", { n: index + 1 })}
                  value={String(row.weight ?? "0")}
                  onChange={(weight) => change(index, { weight })}
                />
              </TableCell>
              <TableCell className={CELL}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("possessions.aria.remove", { n: index + 1 })}
                  onClick={() =>
                    update({ possessions: rows.filter((_, position) => position !== index) })
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
        className="my-3"
        onClick={() => update({ possessions: [...rows, { item: "", page: "", weight: "0" }] })}
      >
        {t("possessions.add")}
      </Button>

      <TotalsRow>
        <Derived
          label={t("possessions.totalWeight")}
          value={weight(load.carried_weight)}
          emphasis
        />
        {/* `category` is one of four values the engine decided; the word for it is translated,
            the decision is not re-made here. */}
        <Derived label={t("possessions.load")} value={t(`load.${load.category}`)} emphasis />
      </TotalsRow>
      <Row>
        <Derived label={t("possessions.lightLoad")} value={weight(load.light_load)} />
        <Derived label={t("possessions.mediumLoad")} value={weight(load.medium_load)} />
        <Derived label={t("possessions.heavyLoad")} value={weight(load.heavy_load)} />
        <Derived label={t("possessions.liftOverHead")} value={weight(load.lift_over_head)} />
        <Derived label={t("possessions.liftOffGround")} value={weight(load.lift_off_ground)} />
        <Derived label={t("possessions.pushOrDrag")} value={weight(load.push_or_drag)} />
      </Row>
      <Note>{t("possessions.note")}</Note>
    </Panel>
  );
}

export function MoneyBlock({ draft, update }: Props) {
  const t = useT();
  return (
    <Panel title={t("panel.money")} icon={<IconMoney />}>
      <Row>
        {(
          [
            ["money_pp", "money.platinum"],
            ["money_gp", "money.gold"],
            ["money_sp", "money.silver"],
            ["money_cp", "money.copper"],
          ] as const
        ).map(([field, label]) => (
          <NumberField
            key={field}
            label={t(label)}
            value={draft[field] ?? 0}
            onChange={(value) => update({ [field]: value })}
            compact
          />
        ))}
      </Row>
    </Panel>
  );
}

/**
 * A new block, every field written out rather than left off.
 *
 * `AttackRow` comes from the OpenAPI schema, where a field with a server-side default is still a
 * required key — and every one of these is a *string*, which is what a blank box is on this form.
 * An added block whose fields were `undefined` would make each control uncontrolled until it was
 * first typed into.
 */
function blankAttack(ordinal: number): AttackRow {
  return {
    ordinal,
    name: "",
    attack_bonus: "",
    damage: "",
    critical: "",
    range: "",
    damage_type: "",
    ammunition: "",
    notes: "",
  };
}

/**
 * The ATTACK blocks — as many as the character has, not as many as paper prints.
 *
 * The form prints five because a printed sheet cannot grow one; this one adds and removes them,
 * so a new character starts with two and the panel stays the size of what is in it. The blocks
 * are real rows in the draft, added and removed there rather than a count of how many of five to
 * show: a rendered list that disagrees with `draft.attacks` is how a keystroke lands in the wrong
 * block, and the export already drops the blank ones.
 */
export function AttacksBlock({ draft, update }: Props) {
  const t = useT();
  const rows = draft.attacks ?? [];

  const change = (index: number, changes: Partial<AttackRow>) => {
    update({
      attacks: rows.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    });
  };

  return (
    <Panel title={t("panel.attacks")} icon={<IconAttacks />}>
      <Note>{t("attacks.note")}</Note>
      <div className="mt-3">
        {rows.map((row, index) => (
          <Fieldset
            key={row.id ?? index}
            legend={t("attacks.legend", { n: index + 1 })}
            icon={<IconAttack />}
          >
            <Row>
              <TextField
                label={t("attacks.name")}
                value={row.name ?? ""}
                onChange={(name) => change(index, { name })}
              />
              <TextField
                label={t("attacks.attackBonus")}
                value={row.attack_bonus ?? ""}
                onChange={(attack_bonus) => change(index, { attack_bonus })}
              />
              <TextField
                label={t("attacks.damage")}
                value={row.damage ?? ""}
                onChange={(damage) => change(index, { damage })}
              />
              <TextField
                label={t("attacks.critical")}
                value={row.critical ?? ""}
                onChange={(critical) => change(index, { critical })}
              />
              <TextField
                label={t("attacks.range")}
                value={row.range ?? ""}
                onChange={(range) => change(index, { range })}
              />
              <TextField
                label={t("attacks.type")}
                value={row.damage_type ?? ""}
                onChange={(damage_type) => change(index, { damage_type })}
              />
              <TextField
                label={t("attacks.ammunition")}
                value={row.ammunition ?? ""}
                onChange={(ammunition) => change(index, { ammunition })}
              />
              {/* Before the notes field, not after it. The row is `flex-wrap` and `notes` is
                  `wide`, so a button trailing it lands alone on a line of its own — which is not
                  where `ClassLevelsBlock` puts it, and reads as a control belonging to the block
                  below. The block's own number is the whole of this button's name, as it is for
                  the class-level and possession rows: it is unlabelled in the row and names the
                  thing it removes instead. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("attacks.remove", { n: index + 1 })}
                onClick={() =>
                  update({ attacks: rows.filter((_, position) => position !== index) })
                }
              >
                ×
              </Button>
              <TextField
                label={t("attacks.notes")}
                value={row.notes ?? ""}
                onChange={(notes) => change(index, { notes })}
                wide
              />
            </Row>
          </Fieldset>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => update({ attacks: [...rows, blankAttack(rows.length)] })}
      >
        {t("attacks.add")}
      </Button>
    </Panel>
  );
}
