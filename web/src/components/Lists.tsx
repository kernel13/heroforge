/**
 * Feats, special abilities, languages, class levels, and the spell notes.
 *
 * All stored, none computed. Feats and special abilities keep the sheet's PG. column beside them;
 * spell notes are held verbatim so page-2 data is not lost while spellcasting waits for a later
 * phase.
 */
import type { CharacterBody, ClassLevelRow, NamedReference } from "../api/types";
import { NumberField, Panel, TextField } from "./fields";

interface Props {
  draft: CharacterBody;
  update: (changes: Partial<CharacterBody>) => void;
}

type ReferenceField = "feats" | "special_abilities";

function ReferenceList({
  draft,
  update,
  field,
  title,
}: Props & { field: ReferenceField; title: string }) {
  const rows: NamedReference[] = draft[field] ?? [];

  const change = (index: number, changes: Partial<NamedReference>) => {
    update({
      [field]: rows.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    });
  };

  return (
    <Panel title={title}>
      <table className="references">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col" title="Rulebook page reference">
              Pg.
            </th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                <input
                  type="text"
                  aria-label={`${title} ${index + 1} name`}
                  value={row.name ?? ""}
                  onChange={(event) => change(index, { name: event.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="references__page"
                  aria-label={`${title} ${index + 1} page`}
                  value={row.page ?? ""}
                  onChange={(event) => change(index, { page: event.target.value })}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="button button--quiet"
                  aria-label={`Remove ${title.toLowerCase()} ${index + 1}`}
                  onClick={() =>
                    update({ [field]: rows.filter((_, position) => position !== index) })
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
        onClick={() => update({ [field]: [...rows, { name: "", page: "" }] })}
      >
        Add
      </button>
    </Panel>
  );
}

export function FeatsBlock(props: Props) {
  return <ReferenceList {...props} field="feats" title="Feats" />;
}

export function SpecialAbilitiesBlock(props: Props) {
  return <ReferenceList {...props} field="special_abilities" title="Special abilities" />;
}

export function LanguagesBlock({ draft, update }: Props) {
  const rows = draft.languages ?? [];
  return (
    <Panel title="Languages">
      <ul className="languages">
        {rows.map((language, index) => (
          <li key={index}>
            <input
              type="text"
              aria-label={`Language ${index + 1}`}
              value={language}
              onChange={(event) =>
                update({
                  languages: rows.map((row, position) =>
                    position === index ? event.target.value : row,
                  ),
                })
              }
            />
            <button
              type="button"
              className="button button--quiet"
              aria-label={`Remove language ${index + 1}`}
              onClick={() =>
                update({ languages: rows.filter((_, position) => position !== index) })
              }
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="button button--quiet"
        onClick={() => update({ languages: [...rows, ""] })}
      >
        Add a language
      </button>
    </Panel>
  );
}

export function ClassLevelsBlock({ draft, update }: Props) {
  const rows = draft.class_levels ?? [];

  const change = (index: number, changes: Partial<ClassLevelRow>) => {
    update({
      class_levels: rows.map((row, position) =>
        position === index ? { ...row, ...changes } : row,
      ),
    });
  };

  return (
    <Panel title="Class and level">
      {rows.map((row, index) => (
        <div key={index} className="row">
          <TextField
            label="Class"
            value={row.class_name ?? ""}
            onChange={(class_name) => change(index, { class_name })}
          />
          <NumberField
            label="Level"
            value={row.level ?? 1}
            min={1}
            onChange={(level) => change(index, { level })}
            compact
          />
          <button
            type="button"
            className="button button--quiet"
            aria-label={`Remove class ${index + 1}`}
            onClick={() =>
              update({ class_levels: rows.filter((_, position) => position !== index) })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button button--quiet"
        onClick={() =>
          update({
            class_levels: [...rows, { ordinal: rows.length, class_name: "", level: 1 }],
          })
        }
      >
        Add a class
      </button>
      <p className="panel__note">
        The sum of these levels is the character level that sets the maximum ranks in every skill.
      </p>
    </Panel>
  );
}

export function SpellsBlock({ draft, update }: Props) {
  const spells = (draft.spells_raw ?? {}) as Record<string, unknown>;
  const notes = typeof spells.notes === "string" ? spells.notes : "";

  return (
    <Panel title="Spells">
      <label className="field field--wide">
        <span className="field__label">Spells, domains, and specialty school</span>
        <textarea
          className="field__input field__input--area"
          rows={10}
          value={notes}
          onChange={(event) => update({ spells_raw: { ...spells, notes: event.target.value } })}
        />
      </label>
      <p className="panel__note">
        Stored as written. Spells per day, bonus spells, save DCs, and arcane spell failure are not
        worked out in this phase, so nothing typed here is lost while that waits.
      </p>
    </Panel>
  );
}
