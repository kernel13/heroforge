/**
 * The skills table.
 *
 * Every derived column — the ability modifier, the armour check penalty actually applied, the
 * total, and the maximum ranks — comes from the `DerivedSheet` and is matched to its draft row by
 * the row's identifier. Ranks are held as strings because they are half-integers on the wire and
 * a half rank has to survive the round trip exactly.
 */
import type { CharacterBody, DerivedSkill, SkillDefinition, SkillRow } from "../api/types";
import { signed } from "./fields";

interface Props {
  draft: CharacterBody;
  skills: DerivedSkill[];
  definitions: SkillDefinition[];
  update: (changes: Partial<CharacterBody>) => void;
}

function label(row: SkillRow, definition: SkillDefinition | undefined): string {
  const base = definition?.name ?? row.custom_name ?? "";
  return row.specialization != null && row.specialization !== ""
    ? `${base} (${row.specialization})`
    : base;
}

export function SkillsTable({ draft, skills, definitions, update }: Props) {
  const rows = draft.skills ?? [];
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const derivedFor = (index: number): DerivedSkill | undefined => skills[index];

  const change = (index: number, changes: Partial<SkillRow>) => {
    update({
      skills: rows.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    });
  };

  const addCustomRow = () => {
    update({
      skills: [
        ...rows,
        {
          ordinal: rows.length,
          custom_name: "New skill",
          custom_key_ability: "INT",
          ranks: "0",
          misc_modifier: 0,
          is_class_skill: false,
        },
      ],
    });
  };

  return (
    <section className="panel panel--skills">
      <h2 className="panel__title">Skills</h2>
      <div className="panel__body">
        <table className="skills">
          <thead>
            <tr>
              <th scope="col" title="Mark the skills your class treats as class skills">
                Class
              </th>
              <th scope="col">Skill</th>
              <th scope="col">Key ability</th>
              <th scope="col">Total</th>
              <th scope="col">Ranks</th>
              <th scope="col">Ability</th>
              <th scope="col" title="Armour check penalty, doubled for Swim">
                Armour
              </th>
              <th scope="col">Misc</th>
              <th scope="col">Max ranks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const definition = row.skill_id != null ? byId.get(row.skill_id) : undefined;
              const derived = derivedFor(index);
              const name = label(row, definition);
              const untrained = definition?.usable_untrained ?? true;
              const unusable = !untrained && Number(row.ranks ?? "0") < 1;

              return (
                <tr
                  key={row.id ?? `row-${index}`}
                  className={unusable ? "skills__row skills__row--untrained" : "skills__row"}
                >
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${name} is a class skill`}
                      checked={row.is_class_skill ?? false}
                      onChange={(event) => change(index, { is_class_skill: event.target.checked })}
                    />
                  </td>
                  <td className="skills__name">
                    {definition === undefined ? (
                      <input
                        type="text"
                        aria-label="Skill name"
                        value={row.custom_name ?? ""}
                        onChange={(event) => change(index, { custom_name: event.target.value })}
                      />
                    ) : (
                      <>
                        <span>{definition.name}</span>
                        {definition.takes_specialization && (
                          <input
                            type="text"
                            className="skills__specialization"
                            aria-label={`${definition.name} specialisation`}
                            placeholder="specialisation"
                            value={row.specialization ?? ""}
                            onChange={(event) =>
                              change(index, { specialization: event.target.value })
                            }
                          />
                        )}
                        {!definition.usable_untrained && (
                          <abbr className="skills__flag" title="Trained only">
                            T
                          </abbr>
                        )}
                        {definition.armor_check_penalty && (
                          <abbr
                            className="skills__flag"
                            title={
                              definition.acp_double
                                ? "Armour check penalty applies twice"
                                : "Armour check penalty applies"
                            }
                          >
                            {definition.acp_double ? "**" : "*"}
                          </abbr>
                        )}
                      </>
                    )}
                  </td>
                  <td className="skills__key">{derived?.key_ability ?? ""}</td>
                  <td>
                    <output aria-label={`${name} total`} className="skills__total">
                      {derived === undefined ? "" : signed(derived.total)}
                    </output>
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="skills__ranks"
                      aria-label={`${name} ranks`}
                      value={String(row.ranks ?? "0")}
                      onChange={(event) => change(index, { ranks: event.target.value })}
                    />
                  </td>
                  <td className="skills__component">
                    {derived === undefined ? "" : signed(derived.ability_modifier)}
                  </td>
                  <td className="skills__component">
                    {derived === undefined || derived.armor_check_penalty === 0
                      ? ""
                      : signed(derived.armor_check_penalty)}
                  </td>
                  <td>
                    <input
                      type="number"
                      className="skills__misc"
                      aria-label={`${name} misc modifier`}
                      value={row.misc_modifier ?? 0}
                      onChange={(event) =>
                        change(index, { misc_modifier: Number(event.target.value) })
                      }
                    />
                  </td>
                  <td className="skills__component">{derived?.max_ranks ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button type="button" className="button button--quiet" onClick={addCustomRow}>
          Add a skill row
        </button>

        <p className="panel__note">
          A half rank counts toward the maximum but adds nothing to the check — 3½ ranks give +3.
          <abbr title="Armour check penalty applies"> *</abbr> marks a skill the armour check
          penalty applies to;
          <abbr title="Armour check penalty applies twice"> **</abbr> marks Swim, where it applies
          twice. <abbr title="Trained only">T</abbr> marks a skill that cannot be used untrained.
        </p>
      </div>
    </section>
  );
}
