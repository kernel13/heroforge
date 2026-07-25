/**
 * Page 2: the GEAR slots, possessions with the derived encumbrance, money, and the attack blocks.
 */
import type {
  ArmorRow,
  ArmorSlot,
  AttackRow,
  CharacterBody,
  DerivedSheet,
  PossessionRow,
} from "../api/types";
import { Derived, NumberField, Panel, TextField, signed } from "./fields";

interface Props {
  draft: CharacterBody;
  derived: DerivedSheet;
  update: (changes: Partial<CharacterBody>) => void;
}

const SLOTS: { slot: ArmorSlot; label: string; full: boolean }[] = [
  { slot: "armor", label: "Armour", full: true },
  { slot: "shield", label: "Shield", full: true },
  { slot: "protective_1", label: "Protective item", full: false },
  { slot: "protective_2", label: "Protective item", full: false },
];

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

export function GearSlots({ draft, derived, update }: Props) {
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
    <Panel title="Gear">
      <p className="panel__note">
        Check penalties are written as they appear on the armour table — full plate is −6, not 6.
        Total applied: {signed(derived.armor_check_penalty)}.
      </p>

      {SLOTS.map(({ slot, label, full }) => {
        const piece = find(slot);
        return (
          <fieldset key={slot} className="gear-slot">
            <legend>{label}</legend>
            <div className="row">
              <TextField
                label="Name"
                value={piece?.name ?? ""}
                onChange={(name) => change(slot, { name })}
              />
              {full && (
                <TextField
                  label="Type"
                  value={piece?.type ?? ""}
                  onChange={(type) => change(slot, { type })}
                />
              )}
              <NumberField
                label="AC bonus"
                value={piece?.ac_bonus ?? 0}
                onChange={(ac_bonus) => change(slot, { ac_bonus })}
                compact
              />
              {full && (
                <>
                  <label className="field field--compact">
                    <span className="field__label">Max Dex</span>
                    <input
                      className="field__input field__input--number"
                      type="number"
                      value={piece?.max_dex ?? ""}
                      onChange={(event) =>
                        change(slot, {
                          max_dex: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <NumberField
                    label="Check penalty"
                    value={piece?.check_penalty ?? 0}
                    max={0}
                    onChange={(check_penalty) => change(slot, { check_penalty })}
                    compact
                  />
                  <NumberField
                    label="Spell failure %"
                    value={piece?.spell_failure ?? 0}
                    onChange={(spell_failure) => change(slot, { spell_failure })}
                    compact
                  />
                  <TextField
                    label="Speed"
                    value={piece?.speed ?? ""}
                    onChange={(speed) => change(slot, { speed })}
                  />
                </>
              )}
              <label className="field field--compact">
                <span className="field__label">Weight</span>
                <input
                  className="field__input field__input--number"
                  type="text"
                  inputMode="decimal"
                  value={String(piece?.weight ?? "0")}
                  onChange={(event) => change(slot, { weight: event.target.value })}
                />
              </label>
              <TextField
                label="Special properties"
                value={piece?.special_properties ?? ""}
                onChange={(special_properties) => change(slot, { special_properties })}
                wide
              />
              {piece !== undefined && (
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => clear(slot)}
                >
                  Remove
                </button>
              )}
            </div>
          </fieldset>
        );
      })}
    </Panel>
  );
}

export function PossessionsBlock({ draft, derived, update }: Props) {
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
    <Panel title="Possessions">
      <table className="possessions">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" title="Rulebook page reference">
              Pg.
            </th>
            <th scope="col">Weight</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                <input
                  type="text"
                  aria-label={`Possession ${index + 1} item`}
                  value={row.item ?? ""}
                  onChange={(event) => change(index, { item: event.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="possessions__page"
                  aria-label={`Possession ${index + 1} page`}
                  value={row.page ?? ""}
                  onChange={(event) => change(index, { page: event.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  inputMode="decimal"
                  className="possessions__weight"
                  aria-label={`Possession ${index + 1} weight`}
                  value={String(row.weight ?? "0")}
                  onChange={(event) => change(index, { weight: event.target.value })}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="button button--quiet"
                  aria-label={`Remove possession ${index + 1}`}
                  onClick={() =>
                    update({ possessions: rows.filter((_, position) => position !== index) })
                  }
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        className="button button--quiet"
        onClick={() => update({ possessions: [...rows, { item: "", page: "", weight: "0" }] })}
      >
        Add an item
      </button>

      <div className="row row--totals">
        <Derived label="Total weight carried" value={`${load.carried_weight} lb.`} emphasis />
        <Derived label="Load" value={load.category} emphasis />
      </div>
      <div className="row">
        <Derived label="Light load" value={`${load.light_load} lb.`} />
        <Derived label="Medium load" value={`${load.medium_load} lb.`} />
        <Derived label="Heavy load" value={`${load.heavy_load} lb.`} />
        <Derived label="Lift over head" value={`${load.lift_over_head} lb.`} />
        <Derived label="Lift off ground" value={`${load.lift_off_ground} lb.`} />
        <Derived label="Push or drag" value={`${load.push_or_drag} lb.`} />
      </div>
      <p className="panel__note">
        The weight on the identity line is the character&rsquo;s own weight and plays no part in
        this.
      </p>
    </Panel>
  );
}

export function MoneyBlock({ draft, update }: Props) {
  return (
    <Panel title="Money">
      <div className="row">
        {(
          [
            ["money_pp", "Platinum"],
            ["money_gp", "Gold"],
            ["money_sp", "Silver"],
            ["money_cp", "Copper"],
          ] as const
        ).map(([field, label]) => (
          <NumberField
            key={field}
            label={label}
            value={draft[field] ?? 0}
            onChange={(value) => update({ [field]: value })}
            compact
          />
        ))}
      </div>
    </Panel>
  );
}

export function AttacksBlock({ draft, update }: Props) {
  const rows = draft.attacks ?? [];

  const change = (index: number, changes: Partial<AttackRow>) => {
    update({
      attacks: rows.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    });
  };

  return (
    <Panel title="Attacks">
      <p className="panel__note">
        The attack bonus and damage are written here rather than worked out: deriving them needs
        weapon data, size modifiers, and iterative attacks from the base attack bonus.
      </p>
      {rows.map((row, index) => (
        <fieldset key={row.id ?? index} className="attack">
          <legend>Attack {index + 1}</legend>
          <div className="row">
            <TextField
              label="Name"
              value={row.name ?? ""}
              onChange={(name) => change(index, { name })}
            />
            <TextField
              label="Attack bonus"
              value={row.attack_bonus ?? ""}
              onChange={(attack_bonus) => change(index, { attack_bonus })}
            />
            <TextField
              label="Damage"
              value={row.damage ?? ""}
              onChange={(damage) => change(index, { damage })}
            />
            <TextField
              label="Critical"
              value={row.critical ?? ""}
              onChange={(critical) => change(index, { critical })}
            />
            <TextField
              label="Range"
              value={row.range ?? ""}
              onChange={(range) => change(index, { range })}
            />
            <TextField
              label="Type"
              value={row.damage_type ?? ""}
              onChange={(damage_type) => change(index, { damage_type })}
            />
            <TextField
              label="Ammunition"
              value={row.ammunition ?? ""}
              onChange={(ammunition) => change(index, { ammunition })}
            />
            <TextField
              label="Notes"
              value={row.notes ?? ""}
              onChange={(notes) => change(index, { notes })}
              wide
            />
          </div>
        </fieldset>
      ))}
    </Panel>
  );
}
