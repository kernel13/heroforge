/**
 * The character sheet.
 *
 * Laid out as two pages, following the structure of the printed record sheet — which fields
 * exist and how they group. The visual design is this application's own.
 */
import type { CharacterRead, DerivedSheet, SkillDefinition } from "../api/types";
import { useSheet } from "../hooks/useSheet";
import { AbilityTable } from "./AbilityTable";
import {
  ArmorClassBlock,
  HitPoints,
  InitiativeAndGrapple,
  SavingThrows,
} from "./DefenseBlock";
import { AttacksBlock, GearSlots, MoneyBlock, PossessionsBlock } from "./GearBlock";
import {
  ClassLevelsBlock,
  FeatsBlock,
  LanguagesBlock,
  SpecialAbilitiesBlock,
  SpellsBlock,
} from "./Lists";
import { SaveBanner } from "./SaveBanner";
import { SkillsTable } from "./SkillsTable";
import { Panel, TextField } from "./fields";

interface Props {
  character: CharacterRead;
  initialDerived: DerivedSheet;
  definitions: SkillDefinition[];
  onBack: () => void;
}

export function CharacterSheet({ character, initialDerived, definitions, onBack }: Props) {
  const sheet = useSheet(character.id, character, initialDerived);
  const { draft, derived, update } = sheet;
  const blockProps = { draft, derived, update };

  return (
    <article className="sheet">
      <header className="sheet__header">
        <button type="button" className="button button--quiet" onClick={onBack}>
          ← All characters
        </button>
        <h1>{draft.name === "" ? "Unnamed character" : draft.name}</h1>
        <span className="sheet__level">
          Character level {derived.character_level}
          {derived.character_level === 0 && " — add a class below"}
        </span>
      </header>

      <SaveBanner state={sheet.save} onRetry={sheet.saveNow} />

      {(derived.warnings ?? []).length > 0 && (
        <aside className="warnings" role="status">
          <h2>Worth a look</h2>
          <ul>
            {(derived.warnings ?? []).map((warning, index) => (
              <li key={index}>{warning.message}</li>
            ))}
          </ul>
          <p className="warnings__note">
            Reported, not refused — house rules and homebrew are normal play.
          </p>
        </aside>
      )}

      <div className="sheet__page">
        <h2 className="sheet__page-title">Page one</h2>

        <Panel title="Character" className="panel--identity">
          <div className="row">
            <TextField
              label="Character name"
              value={draft.name ?? ""}
              onChange={(name) => update({ name })}
            />
            <TextField
              label="Player"
              value={draft.player_name ?? ""}
              onChange={(player_name) => update({ player_name })}
            />
            <TextField
              label="Race"
              value={draft.race ?? ""}
              onChange={(race) => update({ race })}
            />
            <TextField
              label="Alignment"
              value={draft.alignment ?? ""}
              onChange={(alignment) => update({ alignment })}
            />
            <TextField
              label="Deity"
              value={draft.deity ?? ""}
              onChange={(deity) => update({ deity })}
            />
            <TextField
              label="Size"
              value={draft.size ?? ""}
              onChange={(size) => update({ size })}
            />
            <TextField label="Age" value={draft.age ?? ""} onChange={(age) => update({ age })} />
            <TextField
              label="Gender"
              value={draft.gender ?? ""}
              onChange={(gender) => update({ gender })}
            />
            <TextField
              label="Height"
              value={draft.height ?? ""}
              onChange={(height) => update({ height })}
            />
            <TextField
              label="Weight"
              value={draft.body_weight ?? ""}
              onChange={(body_weight) => update({ body_weight })}
            />
            <TextField
              label="Eyes"
              value={draft.eyes ?? ""}
              onChange={(eyes) => update({ eyes })}
            />
            <TextField
              label="Hair"
              value={draft.hair ?? ""}
              onChange={(hair) => update({ hair })}
            />
            <TextField
              label="Skin"
              value={draft.skin ?? ""}
              onChange={(skin) => update({ skin })}
            />
          </div>
        </Panel>

        <ClassLevelsBlock draft={draft} update={update} />

        <Panel title="Abilities">
          <AbilityTable {...blockProps} />
        </Panel>

        <HitPoints {...blockProps} />
        <ArmorClassBlock {...blockProps} />
        <InitiativeAndGrapple {...blockProps} />
        <SavingThrows {...blockProps} />
        <AttacksBlock {...blockProps} />

        <SkillsTable
          draft={draft}
          skills={derived.skills}
          definitions={definitions}
          update={update}
        />
      </div>

      <div className="sheet__page">
        <h2 className="sheet__page-title">Page two</h2>

        <Panel title="Campaign">
          <div className="row">
            <TextField
              label="Campaign"
              value={draft.campaign ?? ""}
              onChange={(campaign) => update({ campaign })}
            />
            <label className="field field--compact">
              <span className="field__label">Experience points</span>
              <input
                className="field__input field__input--number"
                type="number"
                value={draft.experience_points ?? 0}
                onChange={(event) =>
                  update({ experience_points: Number(event.target.value) })
                }
              />
            </label>
          </div>
        </Panel>

        <GearSlots {...blockProps} />
        <PossessionsBlock {...blockProps} />
        <MoneyBlock {...blockProps} />
        <FeatsBlock draft={draft} update={update} />
        <SpecialAbilitiesBlock draft={draft} update={update} />
        <LanguagesBlock draft={draft} update={update} />
        <SpellsBlock draft={draft} update={update} />
      </div>
    </article>
  );
}
