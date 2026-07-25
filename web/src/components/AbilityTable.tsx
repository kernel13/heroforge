/**
 * The ability block: score, modifier, temporary score, temporary modifier.
 *
 * Both modifier columns are derived. A temporary score wins over the base score where present,
 * which is why the temporary modifier is not simply blank when there is no temporary score.
 */
import type { CharacterBody, DerivedSheet } from "../api/types";
import { ABILITIES } from "../api/types";
import { signed } from "./fields";

interface Props {
  draft: CharacterBody;
  derived: DerivedSheet;
  update: (changes: Partial<CharacterBody>) => void;
}

type ScoreField = "str_score" | "dex_score" | "con_score" | "int_score" | "wis_score" | "cha_score";
type TempField = "str_temp" | "dex_temp" | "con_temp" | "int_temp" | "wis_temp" | "cha_temp";

export function AbilityTable({ draft, derived, update }: Props) {
  return (
    <table className="abilities">
      <thead>
        <tr>
          <th scope="col">Ability</th>
          <th scope="col">Score</th>
          <th scope="col">Modifier</th>
          <th scope="col">Temp. score</th>
          <th scope="col">Temp. modifier</th>
        </tr>
      </thead>
      <tbody>
        {ABILITIES.map(({ key, label, short }) => {
          const score = `${short.toLowerCase()}_score` as ScoreField;
          const temp = `${short.toLowerCase()}_temp` as TempField;
          const block = derived.abilities[key];
          return (
            <tr key={key}>
              <th scope="row" className="abilities__name">
                <abbr title={label}>{short}</abbr>
              </th>
              <td>
                <input
                  aria-label={`${label} score`}
                  type="number"
                  min={1}
                  max={99}
                  value={draft[score] ?? 10}
                  onChange={(event) => update({ [score]: Number(event.target.value) })}
                />
              </td>
              <td>
                <output aria-label={`${label} modifier`} className="abilities__modifier">
                  {block.is_temporary ? "" : signed(block.modifier)}
                </output>
              </td>
              <td>
                <input
                  aria-label={`${label} temporary score`}
                  type="number"
                  min={1}
                  max={99}
                  value={draft[temp] ?? ""}
                  onChange={(event) =>
                    update({ [temp]: event.target.value === "" ? null : Number(event.target.value) })
                  }
                />
              </td>
              <td>
                <output
                  aria-label={`${label} temporary modifier`}
                  className="abilities__modifier"
                >
                  {block.is_temporary ? signed(block.modifier) : ""}
                </output>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
