/**
 * Hit points, armour class and its decomposition, initiative, saving throws, and grapple.
 *
 * The armour and shield bonuses are not editable here: they come from the GEAR slots on page 2,
 * which is where the paper sheet puts them too.
 */
import type { CharacterBody, DerivedSheet, SaveName } from "../api/types";
import { SAVES } from "../api/types";
import { Derived, NumberField, Panel, TextField, signed } from "./fields";

interface Props {
  draft: CharacterBody;
  derived: DerivedSheet;
  update: (changes: Partial<CharacterBody>) => void;
}

const SAVE_LABELS: Record<SaveName, { name: string; ability: string }> = {
  fortitude: { name: "Fortitude", ability: "Constitution" },
  reflex: { name: "Reflex", ability: "Dexterity" },
  will: { name: "Will", ability: "Wisdom" },
};

export function HitPoints({ draft, update }: Props) {
  return (
    <Panel title="Hit points">
      <div className="row">
        <NumberField
          label="Total"
          value={draft.hp_total ?? 0}
          onChange={(hp_total) => update({ hp_total })}
        />
        <NumberField
          label="Current"
          value={draft.hp_current ?? 0}
          onChange={(hp_current) => update({ hp_current })}
        />
        <NumberField
          label="Nonlethal damage"
          value={draft.nonlethal_damage ?? 0}
          onChange={(nonlethal_damage) => update({ nonlethal_damage })}
        />
        <TextField
          label="Damage reduction"
          value={draft.damage_reduction ?? ""}
          onChange={(damage_reduction) => update({ damage_reduction })}
        />
        <TextField
          label="Speed"
          value={draft.speed ?? ""}
          onChange={(speed) => update({ speed })}
        />
        <TextField
          label="Spell resistance"
          value={draft.spell_resistance ?? ""}
          onChange={(spell_resistance) => update({ spell_resistance })}
        />
      </div>
    </Panel>
  );
}

export function ArmorClassBlock({ draft, derived, update }: Props) {
  const ac = derived.armor_class;
  return (
    <Panel title="Armour class">
      <div className="row row--totals">
        <Derived label="Armour class" value={ac.total} emphasis />
        <Derived label="Touch" value={ac.touch} />
        <Derived label="Flat-footed" value={ac.flat_footed} />
      </div>

      <p className="panel__note">
        10 + armour {signed(ac.armor_bonus)} + shield {signed(ac.shield_bonus)} + Dexterity{" "}
        {signed(ac.effective_dex_bonus)} + size {signed(ac.size_modifier)} + natural{" "}
        {signed(ac.natural_armor)} + deflection {signed(ac.deflection)} + misc {signed(ac.misc)}
      </p>

      <div className="row">
        <Derived
          label="Armour bonus"
          value={signed(ac.armor_bonus)}
          title="From the armour slot on page 2"
        />
        <Derived
          label="Shield bonus"
          value={signed(ac.shield_bonus)}
          title="From the shield slot on page 2"
        />
        <Derived
          label="Dexterity bonus applied"
          value={signed(ac.effective_dex_bonus)}
          title="Limited by the armour's maximum Dexterity bonus"
        />
        <NumberField
          label="Natural armour"
          value={draft.ac_natural ?? 0}
          onChange={(ac_natural) => update({ ac_natural })}
          compact
        />
        <NumberField
          label="Deflection"
          value={draft.ac_deflection ?? 0}
          onChange={(ac_deflection) => update({ ac_deflection })}
          compact
        />
        <NumberField
          label="Size modifier"
          value={draft.ac_size ?? 0}
          onChange={(ac_size) => update({ ac_size })}
          compact
        />
        <NumberField
          label="Misc modifier"
          value={draft.ac_misc ?? 0}
          onChange={(ac_misc) => update({ ac_misc })}
          compact
        />
      </div>
    </Panel>
  );
}

export function InitiativeAndGrapple({ draft, derived, update }: Props) {
  return (
    <Panel title="Initiative and grapple">
      <div className="row row--totals">
        <Derived label="Initiative" value={signed(derived.initiative)} emphasis />
        <Derived label="Grapple" value={signed(derived.grapple_modifier)} emphasis />
      </div>
      <div className="row">
        <Derived
          label="Dexterity modifier (uncapped)"
          value={signed(derived.abilities.dexterity.modifier)}
          title="Uncapped: the armour's maximum Dexterity bonus limits AC, not initiative"
        />
        <NumberField
          label="Initiative misc"
          value={draft.initiative_misc ?? 0}
          onChange={(initiative_misc) => update({ initiative_misc })}
          compact
        />
        <NumberField
          label="Base attack bonus"
          value={draft.base_attack_bonus ?? 0}
          onChange={(base_attack_bonus) => update({ base_attack_bonus })}
          compact
        />
        <Derived
          label="Strength modifier (grapple)"
          value={signed(derived.abilities.strength.modifier)}
        />
        <NumberField
          label="Grapple size modifier"
          value={draft.grapple_size_modifier ?? 0}
          onChange={(grapple_size_modifier) => update({ grapple_size_modifier })}
          compact
        />
        <NumberField
          label="Grapple misc"
          value={draft.grapple_misc ?? 0}
          onChange={(grapple_misc) => update({ grapple_misc })}
          compact
        />
      </div>
      <p className="panel__note">
        The grapple size modifier is not the armour-class size modifier. A Small creature has +1 to
        AC but −4 to grapple.
      </p>
      <p className="panel__note">
        Base attack bonus is typed here rather than derived: working it out needs class progression
        tables, which are not part of this phase.
      </p>
    </Panel>
  );
}

export function SavingThrows({ draft, derived, update }: Props) {
  return (
    <Panel title="Saving throws">
      <table className="saves">
        <thead>
          <tr>
            <th scope="col">Save</th>
            <th scope="col">Total</th>
            <th scope="col">Base</th>
            <th scope="col">Ability</th>
            <th scope="col">Magic</th>
            <th scope="col">Misc</th>
            <th scope="col">Temporary</th>
          </tr>
        </thead>
        <tbody>
          {SAVES.map((save) => {
            const row = derived.saves[save];
            const { name, ability } = SAVE_LABELS[save];
            return (
              <tr key={save}>
                <th scope="row">
                  {name}
                  <span className="saves__ability">{ability}</span>
                </th>
                <td>
                  <output aria-label={`${name} total`} className="saves__total">
                    {signed(row.total)}
                  </output>
                </td>
                <td>
                  <input
                    aria-label={`${name} base save`}
                    type="number"
                    value={draft[`base_${save}`] ?? 0}
                    onChange={(event) =>
                      update({ [`base_${save}`]: Number(event.target.value) })
                    }
                  />
                </td>
                <td>
                  <output className="saves__ability-modifier">{signed(row.ability_modifier)}</output>
                </td>
                {(["magic", "misc", "temporary"] as const).map((part) => (
                  <td key={part}>
                    <input
                      aria-label={`${name} ${part}`}
                      type="number"
                      value={draft[`${save}_${part}`] ?? 0}
                      onChange={(event) =>
                        update({ [`${save}_${part}`]: Number(event.target.value) })
                      }
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <TextField
        label="Conditional modifiers"
        value={draft.saves_conditional_modifiers ?? ""}
        onChange={(saves_conditional_modifiers) => update({ saves_conditional_modifiers })}
        wide
      />
      <p className="panel__note">
        Base saves are typed here for the same reason as the base attack bonus.
      </p>
    </Panel>
  );
}
