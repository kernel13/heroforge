/**
 * The character sheet: a derived rail beside a working column.
 *
 * The sheet is two regions, and which region a number is in is what says where it came from.
 * `DerivedRail` on the left carries every value the engine worked out — armour class, initiative,
 * grapple, the three saves, the ability modifiers, the load — and it is mounted *outside* the
 * `Tabs`, so it stays on screen through all three pages and through any amount of scrolling. The
 * column on the right carries the fields, and only the fields. Change Dexterity at the bottom of
 * the skills table and armour class moves in the corner of your eye, which is the thing this
 * application exists to do and which previously took a scroll to see.
 *
 * No derived value is written in both regions. That is a design rule first — a total repeated is a
 * total that can disagree with itself while a recompute is in flight — and an addressability rule
 * second: every suite here reads derived values by accessible name, and two elements answering to
 * "Armour class" makes `getByLabelText` throw. The exception is deliberate and narrow: the rail's
 * ability-modifier strip repeats what `AbilityTable` shows, because page two would otherwise have
 * no modifiers to trace its numbers to, and it carries no `aria-label`s so the name stays the
 * table's alone.
 *
 * The pages are genuinely separate views rather than sections of one long form: page one carries
 * identity, abilities, defence, attacks, and skills; page two carries campaign, gear, possessions,
 * money, feats, special abilities, languages, and spells; page three is the spellbook. The
 * inactive pages are unmounted, not hidden, so their two hundred-odd controls stay out of the
 * accessibility tree.
 *
 * The first two pages follow the printed record sheet. The third does not — the paper form has no
 * spellbook page, because a book of scribed spells is a list with no length and paper has to stop
 * somewhere. It is a page rather than a panel on page two for that reason: a wizard past the low
 * levels has more spells written down than every other block on page two put together.
 *
 * Below the `lg` breakpoint the rail stops being sticky and reflows from a column into a banner
 * above the sheet, its sections in two or three columns rather than one. It has to: left as a
 * column the rail is some 690px tall, and on a 390×844 phone that is the whole first screen
 * standing between the reader and the first field they opened the sheet to fill in. Reflowing
 * takes it to about 430px, which puts the identity panel back above the fold. Every derived
 * *total* survives the reflow; what is dropped is the description around them — the identity
 * sentence, the character level, the component disclosures, and the nonlethal/speed line — each of
 * which is restated by a panel a scroll below. The order is deliberate: prose goes first, the
 * numbers go last, and nothing the engine worked out goes at all.
 */
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import type { CharacterRead, DerivedSheet, SkillDefinition } from "../api/types";
import { useSheet } from "../hooks/useSheet";
import { useI18n, type TranslationKey } from "../i18n";
import { RuleWarnings } from "./RuleWarnings";
import { AbilityTable } from "./AbilityTable";
import {
  ArmorClassBlock,
  HitPoints,
  InitiativeAndGrapple,
  SavingThrows,
} from "./DefenseBlock";
import { DerivedRail } from "./DerivedRail";
import { ExportPdfButton } from "./ExportPdfButton";
import { AttacksBlock, GearSlots, MoneyBlock, PossessionsBlock } from "./GearBlock";
import { ClassLevelsBlock, FeatsBlock, LanguagesBlock, SpecialAbilitiesBlock } from "./Lists";
import { PortraitFrame } from "./PortraitFrame";
import { SpellsBlock } from "./Spells";
import { SpellbookPage } from "./Spellbook";
import { SaveBanner } from "./SaveBanner";
import { IconAbilities, IconCampaign, IconCharacter } from "./icons";
import { SkillsTable } from "./SkillsTable";
import { NumberField, Panel, PanelPair, Row, TextField } from "./fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  character: CharacterRead;
  initialDerived: DerivedSheet;
  definitions: SkillDefinition[];
  onBack: () => void;
  /**
   * The portrait's stamp, which travels beside the character rather than on it — see
   * `PortraitFrame`. Optional and null-by-default, so a caller with nothing to say about the
   * portrait draws the empty frame rather than failing to compile.
   */
  portraitUpdatedAt?: string | null;
}

type Page = "1" | "2" | "3";

/**
 * The pages, in order, with the key that names each tab.
 *
 * A list rather than a conditional in the trigger: with two pages a ternary was the whole of the
 * logic, and the third would have made it a nested one that has to be edited again for a fourth.
 */
const PAGES = [
  { value: "1", label: "sheet.page1" },
  { value: "2", label: "sheet.page2" },
  { value: "3", label: "sheet.page3" },
] as const satisfies readonly { value: Page; label: TranslationKey }[];

/** A control that sits on the page's ground rather than on a panel. */
const ON_GROUND =
  "border border-[rgba(253,247,238,0.3)] bg-[rgba(253,247,238,0.12)] text-[#f5e9d7]" +
  " hover:bg-[rgba(253,247,238,0.22)] hover:text-white";

export function CharacterSheet({
  character,
  initialDerived,
  definitions,
  onBack,
  portraitUpdatedAt = null,
}: Props) {
  const { t } = useI18n();
  const sheet = useSheet(character.id, character, initialDerived);
  const { draft, derived, update } = sheet;
  const blockProps = { draft, derived, update };

  /**
   * Which page is open is view state, not part of the character, so it stays out of the URL —
   * unlike the open character itself, which App.tsx keeps in the path. `key={openId}` there
   * already returns a freshly opened character to page one.
   */
  const [page, setPage] = useState<Page>("1");

  const openPage = (value: string) => {
    setPage(value as Page);
    // Otherwise a user deep in the skills table arrives partway down the possessions list.
    window.scrollTo({ top: 0 });
  };

  return (
    <article className="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
      {/* The rail is a sibling of the `Tabs`, not a child of any `TabsContent`. That placement
          is the feature: unmounting the inactive page must not take the worked-out values with
          it. Vitest pins that it survives a page change. */}
      <DerivedRail draft={draft} derived={derived} save={sheet.save} />

      <div className="min-w-0">
        {/* This row sits on the page's ground, not on a panel, so its controls are drawn for the
            ground: a light translucent pill with a light edge. A shadcn `ghost` here is dark ink on
            dark leather with no border, which is legible only because it happens to be short. */}
        <header className="mb-2.5 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className={ON_GROUND} onClick={onBack}>
            <ArrowLeft />
            {t("sheet.back")}
          </Button>
          {/* The character is named, and its level stated, by the rail — on both pages. Nothing
              about the character belongs in this row any more; what is left is the two controls
              that act on the sheet rather than describe it. */}
          <span className="ml-auto">
            <ExportPdfButton
              character={draft}
              derived={derived}
              definitions={definitions}
              className={ON_GROUND}
            />
          </span>
        </header>

        <SaveBanner state={sheet.save} onRetry={sheet.saveNow} />

        <RuleWarnings warnings={derived.warnings ?? []} definitions={definitions} />

        <Tabs value={page} onValueChange={openPage} className="gap-0">
          {/* Tabs on the ground rather than a full-width parchment strip. The strip was a
              band of panel colour carrying two words, which read as a panel with nothing in it;
              a tab that takes the page's colour when it is open, and the ground's when it is not,
              says which page you are on with the same ink the page is drawn in. */}
          {/* Deliberately *not* `variant="line"`. That variant carries
              `group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent`, which beats
              a plain `data-[state=active]:bg-card` on specificity — the open tab came out
              transparent with dark ink on it, which on this ground is an empty black box. */}
          <TabsList
            aria-label={t("sheet.pages")}
            className="-mb-px h-auto w-full justify-start gap-1 rounded-none bg-transparent p-0"
          >
            {PAGES.map((entry) => (
              <TabsTrigger
                key={entry.value}
                value={entry.value}
                className={cn(
                  "relative z-10 h-auto flex-none rounded-t-md rounded-b-none px-4 py-1.5",
                  "border border-b-0 text-[0.72rem] font-semibold tracking-[0.14em] uppercase",
                  // The primitive draws an underline bar for the active tab; this strip says
                  // which page is open with the page's own colour instead.
                  "after:hidden",
                  "border-[rgba(216,195,168,0.35)] bg-black/20 text-[#e7d3b6] hover:text-white",
                  "data-[state=active]:border-border data-[state=active]:bg-card",
                  "data-[state=active]:text-heading data-[state=active]:shadow-none",
                )}
              >
                {t(entry.label)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="1">
            <Panel title={t("panel.character")} icon={<IconCharacter />}>
              {/* The portrait beside the identity fields, not in a panel of its own: it says the
                  same thing they do — who this is — and a `PanelPair` would set one square against
                  thirteen fields and give each of them half the row.

                  The floor on the field column is what makes the wrap real. `min-w-0 flex-1` would
                  shrink to nothing rather than wrap, leaving a full-height frame beside a single
                  column of fields on a phone; at 18rem the two drop apart instead, and 18rem still
                  fits inside the panel on a 390px screen. */}
              <div className="flex flex-wrap items-start gap-4">
                <Row className="min-w-[18rem] flex-1">
                  <TextField
                    label={t("field.characterName")}
                    value={draft.name ?? ""}
                    onChange={(name) => update({ name })}
                  />
                  <TextField
                    label={t("field.player")}
                    value={draft.player_name ?? ""}
                    onChange={(player_name) => update({ player_name })}
                  />
                  <TextField
                    label={t("field.race")}
                    value={draft.race ?? ""}
                    onChange={(race) => update({ race })}
                  />
                  <TextField
                    label={t("field.alignment")}
                    value={draft.alignment ?? ""}
                    onChange={(alignment) => update({ alignment })}
                  />
                  <TextField
                    label={t("field.deity")}
                    value={draft.deity ?? ""}
                    onChange={(deity) => update({ deity })}
                  />
                  <TextField
                    label={t("field.size")}
                    value={draft.size ?? ""}
                    onChange={(size) => update({ size })}
                  />
                  <TextField
                    label={t("field.age")}
                    value={draft.age ?? ""}
                    onChange={(age) => update({ age })}
                  />
                  <TextField
                    label={t("field.gender")}
                    value={draft.gender ?? ""}
                    onChange={(gender) => update({ gender })}
                  />
                  <TextField
                    label={t("field.height")}
                    value={draft.height ?? ""}
                    onChange={(height) => update({ height })}
                  />
                  <TextField
                    label={t("field.weight")}
                    value={draft.body_weight ?? ""}
                    onChange={(body_weight) => update({ body_weight })}
                  />
                  <TextField
                    label={t("field.eyes")}
                    value={draft.eyes ?? ""}
                    onChange={(eyes) => update({ eyes })}
                  />
                  <TextField
                    label={t("field.hair")}
                    value={draft.hair ?? ""}
                    onChange={(hair) => update({ hair })}
                  />
                  <TextField
                    label={t("field.skin")}
                    value={draft.skin ?? ""}
                    onChange={(skin) => update({ skin })}
                  />
                </Row>

                <PortraitFrame characterId={character.id} updatedAt={portraitUpdatedAt} />
              </div>
            </Panel>

            {/* Abilities before the class levels, and beside them: the scores are what a player
                opens the sheet to change, and the levels are the cap those changes run into. */}
            <PanelPair>
              <Panel title={t("panel.abilities")} icon={<IconAbilities />}>
                <AbilityTable {...blockProps} />
              </Panel>
              <ClassLevelsBlock draft={draft} update={update} />
            </PanelPair>

            <HitPoints {...blockProps} />

            {/* These were a `PanelPair`, on the grounds that both read the same Dexterity. They are
                stacked now — initiative and grapple first, armour class full width under it, at
                every width. The totals they both feed are in the rail, in view from wherever on the
                page you are typing. */}
            <InitiativeAndGrapple {...blockProps} />
            <ArmorClassBlock {...blockProps} />

            <SavingThrows {...blockProps} />
            <AttacksBlock {...blockProps} />

            <SkillsTable
              draft={draft}
              skills={derived.skills}
              totalRanks={derived.total_ranks}
              definitions={definitions}
              update={update}
            />
          </TabsContent>

          <TabsContent value="2">
            <Panel title={t("panel.campaign")} icon={<IconCampaign />}>
              <Row>
                <TextField
                  label={t("field.campaign")}
                  value={draft.campaign ?? ""}
                  onChange={(campaign) => update({ campaign })}
                />
                <NumberField
                  label={t("field.experiencePoints")}
                  value={draft.experience_points ?? 0}
                  onChange={(experience_points) => update({ experience_points })}
                  compact
                />
              </Row>
            </Panel>

            <GearSlots {...blockProps} />
            <PossessionsBlock {...blockProps} />
            <MoneyBlock {...blockProps} />
            <FeatsBlock draft={draft} update={update} />
            <SpecialAbilitiesBlock draft={draft} update={update} />
            <LanguagesBlock draft={draft} update={update} />
            <SpellsBlock draft={draft} update={update} />
          </TabsContent>

          {/* Page three is the spellbook and nothing else. It is a page rather than a panel on
              page two because the book is a list without a length — a wizard past the low levels
              has more spells written down than page two has rows in all its other blocks put
              together, and putting it under the spells grid buries that grid under it. */}
          <TabsContent value="3">
            <SpellbookPage draft={draft} update={update} />
          </TabsContent>
        </Tabs>
      </div>
    </article>
  );
}
