/**
 * Hit points, armour class and its decomposition, initiative, saving throws, and grapple.
 *
 * The armour and shield bonuses are not editable here: they come from the GEAR slots on page 2,
 * which is where the paper sheet puts them too.
 */
import type { CharacterBody, DerivedSheet } from "../api/types";
import { SAVES } from "../api/types";
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
import {
  IconArmorClass,
  IconHitPoints,
  IconInitiative,
  IconSaves,
} from "./icons";
import {
  Derived,
  Note,
  NumberField,
  Panel,
  Row,
  TextField,
  numberClass,
  signed,
} from "./fields";

interface Props {
  draft: CharacterBody;
  derived: DerivedSheet;
  update: (changes: Partial<CharacterBody>) => void;
}

/** Which ability each save keys off. The pairing is a rule; both names are translated. */
const SAVE_ABILITY = {
  fortitude: "ability.constitution",
  reflex: "ability.dexterity",
  will: "ability.wisdom",
} as const;

const HEAD = "h-8 px-1.5 text-[0.68rem] font-medium uppercase tracking-[0.05em] text-muted-foreground";
const CELL = "px-1.5 py-1";

export function HitPoints({ draft, update }: Props) {
  const t = useT();
  return (
    <Panel title={t("panel.hitPoints")} icon={<IconHitPoints />}>
      <Row>
        <NumberField
          label={t("hp.total")}
          value={draft.hp_total ?? 0}
          onChange={(hp_total) => update({ hp_total })}
        />
        <NumberField
          label={t("hp.current")}
          value={draft.hp_current ?? 0}
          onChange={(hp_current) => update({ hp_current })}
        />
        <NumberField
          label={t("hp.nonlethal")}
          value={draft.nonlethal_damage ?? 0}
          onChange={(nonlethal_damage) => update({ nonlethal_damage })}
        />
        <TextField
          label={t("hp.damageReduction")}
          value={draft.damage_reduction ?? ""}
          onChange={(damage_reduction) => update({ damage_reduction })}
        />
        <TextField
          label={t("hp.speed")}
          value={draft.speed ?? ""}
          onChange={(speed) => update({ speed })}
        />
        <TextField
          label={t("hp.spellResistance")}
          value={draft.spell_resistance ?? ""}
          onChange={(spell_resistance) => update({ spell_resistance })}
        />
      </Row>
    </Panel>
  );
}

/**
 * The armour-class panel is where you *type*: natural armour, deflection, size, misc.
 *
 * The three totals it used to open with — armour class, touch, flat-footed — are in `DerivedRail`
 * now, where they stay on screen while you work anywhere on either page. Putting one back here
 * would give two elements the accessible name "Armour class", and the component and end-to-end
 * suites both read that name.
 */
export function ArmorClassBlock({ draft, derived, update }: Props) {
  const t = useT();
  const ac = derived.armor_class;
  return (
    <Panel title={t("panel.armorClass")} icon={<IconArmorClass />}>
      {/* The whole decomposition is one template: the `+` signs are punctuation the translator
          keeps, and every operand is a number the engine already worked out. */}
      <Note>
        {t("ac.formula", {
          armor: signed(ac.armor_bonus),
          shield: signed(ac.shield_bonus),
          dex: signed(ac.effective_dex_bonus),
          size: signed(ac.size_modifier),
          natural: signed(ac.natural_armor),
          deflection: signed(ac.deflection),
          misc: signed(ac.misc),
        })}
      </Note>

      <Row className="mt-3">
        <Derived
          label={t("ac.armorBonus")}
          value={signed(ac.armor_bonus)}
          title={t("ac.armorBonus.title")}
        />
        <Derived
          label={t("ac.shieldBonus")}
          value={signed(ac.shield_bonus)}
          title={t("ac.shieldBonus.title")}
        />
        <Derived
          label={t("ac.dexApplied")}
          value={signed(ac.effective_dex_bonus)}
          title={t("ac.dexApplied.title")}
        />
        <NumberField
          label={t("ac.natural")}
          value={draft.ac_natural ?? 0}
          onChange={(ac_natural) => update({ ac_natural })}
          compact
        />
        <NumberField
          label={t("ac.deflection")}
          value={draft.ac_deflection ?? 0}
          onChange={(ac_deflection) => update({ ac_deflection })}
          compact
        />
        <NumberField
          label={t("ac.size")}
          value={draft.ac_size ?? 0}
          onChange={(ac_size) => update({ ac_size })}
          compact
        />
        <NumberField
          label={t("ac.misc")}
          value={draft.ac_misc ?? 0}
          onChange={(ac_misc) => update({ ac_misc })}
          compact
        />
      </Row>
    </Panel>
  );
}

/** Initiative and grapple themselves are in the rail; what is left here is what feeds them. */
export function InitiativeAndGrapple({ draft, derived, update }: Props) {
  const t = useT();
  return (
    <Panel title={t("panel.initiativeGrapple")} icon={<IconInitiative />}>
      <Row>
        <Derived
          label={t("init.dexUncapped")}
          value={signed(derived.abilities.dexterity.modifier)}
          title={t("init.dexUncapped.title")}
        />
        <NumberField
          label={t("init.initiativeMisc")}
          value={draft.initiative_misc ?? 0}
          onChange={(initiative_misc) => update({ initiative_misc })}
          compact
        />
        <NumberField
          label={t("init.baseAttackBonus")}
          value={draft.base_attack_bonus ?? 0}
          onChange={(base_attack_bonus) => update({ base_attack_bonus })}
          compact
        />
        <Derived
          label={t("init.strengthGrapple")}
          value={signed(derived.abilities.strength.modifier)}
        />
        <NumberField
          label={t("init.grappleSize")}
          value={draft.grapple_size_modifier ?? 0}
          onChange={(grapple_size_modifier) => update({ grapple_size_modifier })}
          compact
        />
        <NumberField
          label={t("init.grappleMisc")}
          value={draft.grapple_misc ?? 0}
          onChange={(grapple_misc) => update({ grapple_misc })}
          compact
        />
      </Row>
      <Note>{t("init.note.size")}</Note>
      <Note>{t("init.note.bab")}</Note>
    </Panel>
  );
}

/** No `total` column: the three save totals are in the rail, on both pages. */
const SAVE_HEADINGS = [
  "saves.head.save",
  "saves.head.base",
  "saves.head.ability",
  "saves.head.magic",
  "saves.head.misc",
  "saves.head.temporary",
] as const;

/** The three editable component columns, and the aria-label each one is addressed by. */
const SAVE_PARTS = [
  { part: "magic", key: "saves.aria.magic" },
  { part: "misc", key: "saves.aria.misc" },
  { part: "temporary", key: "saves.aria.temporary" },
] as const;

export function SavingThrows({ draft, derived, update }: Props) {
  const t = useT();
  return (
    <Panel title={t("panel.savingThrows")} icon={<IconSaves />}>
      <Table>
        <TableHeader>
          <TableRow>
            {SAVE_HEADINGS.map((heading) => (
              <TableHead key={heading} scope="col" className={HEAD}>
                {t(heading)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {SAVES.map((save) => {
            const row = derived.saves[save];
            const name = t(`save.${save}`);
            const ability = t(SAVE_ABILITY[save]);
            return (
              <TableRow key={save}>
                <TableHead scope="row" className={CELL}>
                  {name}
                  <span className="block text-[0.68rem] font-normal text-muted-foreground">
                    {ability}
                  </span>
                </TableHead>
                <TableCell className={CELL}>
                  <Input
                    aria-label={t("saves.aria.base", { save: name })}
                    className={numberClass}
                    type="number"
                    value={draft[`base_${save}`] ?? 0}
                    onChange={(event) =>
                      update({ [`base_${save}`]: Number(event.target.value) })
                    }
                  />
                </TableCell>
                <TableCell className={CELL}>
                  <output className="block text-right text-muted-foreground">
                    {signed(row.ability_modifier)}
                  </output>
                </TableCell>
                {SAVE_PARTS.map(({ part, key }) => (
                  <TableCell key={part} className={CELL}>
                    <Input
                      aria-label={t(key, { save: name })}
                      className={numberClass}
                      type="number"
                      value={draft[`${save}_${part}`] ?? 0}
                      onChange={(event) =>
                        update({ [`${save}_${part}`]: Number(event.target.value) })
                      }
                    />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Row className="mt-3">
        <TextField
          label={t("saves.conditional")}
          value={draft.saves_conditional_modifiers ?? ""}
          onChange={(saves_conditional_modifiers) => update({ saves_conditional_modifiers })}
          wide
        />
      </Row>
      <Note>{t("saves.note")}</Note>
    </Panel>
  );
}
