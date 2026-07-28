/**
 * Every number the engine worked out, in one place that does not scroll away.
 *
 * This is the sheet's answer to the question the whole application exists for: how does a value
 * the application derived look different from a value someone typed? Here the distinction is a
 * **place**, not a colour and not a border. The rail is what the sheet says; the column beside it
 * is what you said. You never have to work out which kind of number you are looking at, because of
 * where it is — and no derived value is written in both regions, so there is exactly one screen
 * element carrying any given fact and exactly one accessible name for it.
 *
 * Consequences worth knowing before moving anything back:
 *
 * - **The panels on the right are input-only now.** `ArmorClassBlock`, `InitiativeAndGrapple` and
 *   `SavingThrows` used to carry their own totals; they do not, because the rail does. Putting one
 *   back gives two elements the same `aria-label`, and every suite in this repository addresses
 *   derived values by accessible name — `getByLabelText("Armour class")` would start throwing.
 * - **The rail is mounted above the `Tabs`, so it is on both pages.** That is the point of it, and
 *   it is also why the ability-modifier strip repeats what `AbilityTable` shows on page one: every
 *   derived number on either page traces back to one of those six, and page two would otherwise
 *   have nothing to trace to. The strip is a `<dl>` with no `aria-label`s for exactly that reason —
 *   `AbilityTable` owns the name "Strength modifier", and a second element answering to it would
 *   make the ambiguity this file is otherwise built to avoid.
 * - **Components are behind a disclosure, never beside their total.** A sheet that prints "22"
 *   next to "armour 8, shield 2, Dex 1" at one weight gets read as a sum still to be finished, and
 *   people add it up again. Open on demand, closed by default.
 * - **Nothing here computes.** Every figure is a field of `DerivedSheet`. `signed()` draws a `+`;
 *   it does not add anything.
 */
import { Fragment, useMemo, type ReactNode } from "react";
import type { CharacterBody, DerivedSheet, SaveName } from "../api/types";
import type { SaveState } from "../hooks/useSheet";
import { ABILITIES, SAVES } from "../api/types";
import { interpolate, useI18n, useT } from "../i18n";
import { Derived, SectionIcon, signed } from "./fields";
import { quietSaveKey } from "./SaveBanner";
import {
  IconAbilities,
  IconArmorClass,
  IconAttacks,
  IconHitPoints,
  IconInitiative,
  IconPossessions,
  IconSaves,
} from "./icons";
import { cn } from "@/lib/utils";

/**
 * The rail carries the *quiet* save states — saved, pending, saving — and only those.
 *
 * A failure stays with `SaveBanner` in the working column, as an `Alert` a reader cannot scroll
 * past. That split is the whole point: news you can ignore belongs in the region you glance at,
 * news you cannot belongs in the region you are typing in. Each sentence is still written in
 * exactly one place, so "All changes saved" has one element and the end-to-end suite's
 * `getByText` stays unambiguous.
 */
interface Props {
  draft: CharacterBody;
  derived: DerivedSheet;
  save: SaveState;
}

/** The rail's short names for the saves. "Fortitude" does not fit a third of 19rem. */
const SAVE_SHORT: Record<SaveName, "rail.save.fortitude" | "rail.save.reflex" | "rail.save.will"> = {
  fortitude: "rail.save.fortitude",
  reflex: "rail.save.reflex",
  will: "rail.save.will",
};

/**
 * A block in the rail: a label and whatever sits under it.
 *
 * The label is a `<p>`, deliberately **not** a heading. The rail restates facts that the panels on
 * the right already name — "Hit points", "Saving throws" — and a heading here would put each of
 * those words into the document outline twice, so a screen-reader user walking the headings would
 * find two "Saving throws" sections when the sheet has one. The `<aside>` carries the accessible
 * name for the whole region instead, which is what a landmark is for. Both suites read panels by
 * `getByRole("heading", { name })`, so a heading here also breaks them outright.
 *
 * The separators are the parent grid's 1px gaps showing through, not a `border-b` here. That is
 * what lets the same sections stack into a column beside the sheet and reflow into a banner above
 * it without any of them knowing which layout they are in, and it costs no `last:border-b-0`.
 *
 * `wide` is for the blocks that cannot be half a phone's width once the rail reflows into a
 * banner: the character's name, the six-cell ability strip, and the warning count. Everything else
 * pairs up, which is most of what keeps the banner from owning the first screen.
 */
function RailSection({
  title,
  icon,
  wide,
  bar,
  children,
  className,
}: {
  title?: string;
  icon?: ReactNode;
  wide?: boolean;
  /**
   * Draw the title as a bar across the section rather than as a line above the content.
   *
   * Only for the two blocks that name a *group* of small readings — the six ability modifiers and
   * the three saves. A block whose content is one figure keeps its label inline beside that figure
   * instead; a bar over a single number reads as a section containing a section.
   */
  bar?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "bg-rail px-3.5 py-2.5",
        wide === true && "col-span-2 sm:col-span-3 lg:col-span-1",
        className,
      )}
    >
      {title !== undefined && (
        <p
          className={cn(
            "rail-label flex items-center gap-1.5",
            bar === true ? "rail-bar" : "mb-1.5",
          )}
        >
          {icon !== undefined && <SectionIcon icon={icon} className="size-3 text-rail-accent" />}
          {title}
        </p>
      )}
      {children}
    </section>
  );
}

/**
 * The addends behind a total, folded away.
 *
 * A `<details>` rather than a hover card: the components are something a player wants to *read*
 * when a number surprises them, on a touch screen as much as a mouse, and a disclosure is the one
 * control that is legible to a keyboard, a screen reader and a finger without any work.
 *
 * Hidden below `lg`, where the rail is a banner and a closed disclosure still costs a line per
 * total. Nothing is lost by it: `ArmorClassBlock` writes the same decomposition out in full, as a
 * sentence, a scroll below.
 */
function Parts({ label, rows }: { label: string; rows: { name: string; value: string }[] }) {
  return (
    <details className="group mt-1.5 hidden lg:block">
      <summary
        className={cn(
          "cursor-pointer list-none text-[0.72rem] text-rail-muted",
          "hover:text-rail-accent focus-visible:outline-2 focus-visible:outline-rail-accent",
          "marker:content-none [&::-webkit-details-marker]:hidden",
        )}
      >
        <span aria-hidden="true" className="text-rail-accent">
          {"▸ "}
        </span>
        {label}
      </summary>
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 rounded-sm bg-black/25 px-2 py-1.5 text-[0.72rem]">
        {rows.map((row) => (
          <div key={row.name} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-rail-muted">{row.name}</dt>
            <dd className="m-0 text-right tabular-nums text-rail-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * A *typed* value shown in the rail — hit points, damage reduction, speed.
 *
 * Deliberately not a `Derived`. Two reasons, and both matter. It is not derived: the engine had no
 * hand in it, and `Derived` exists to say that a number came from the engine. And it carries no
 * `aria-label`, because the field it echoes already owns that accessible name over on the sheet —
 * a rail `<output>` labelled "Speed" beside the panel input labelled "Speed" is two elements with
 * one name, which is the ambiguity this whole component is arranged to avoid.
 */
function Reading({
  label,
  value,
  icon,
  headline,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** The same shape `Derived`'s `railHeadline` draws, making no claim to have been derived. */
  headline?: boolean;
}) {
  if (headline === true) {
    return (
      <div className="flex items-baseline gap-3">
        <span className="rail-label flex flex-1 items-center gap-1.5">
          {icon !== undefined && <SectionIcon icon={icon} className="size-3 text-rail-accent" />}
          {label}
        </span>
        <span
          className={cn(
            "text-[1.9rem] leading-none font-semibold tabular-nums text-white",
            "[text-shadow:0_0_18px_rgba(224,178,115,0.3)]",
          )}
        >
          {value}
        </span>
      </div>
    );
  }
  return (
    <div className="flex min-w-14 flex-col gap-0.5">
      <span className="rail-label">{label}</span>
      <span className="font-semibold tabular-nums text-rail-foreground">{value}</span>
    </div>
  );
}

/**
 * The character, as a sentence.
 *
 * Assembled from the parts that have a value rather than from a template with holes in it: a
 * half-filled character is the normal state of a sheet for its first evening, and "A  , " is a
 * worse thing to read than a shorter sentence. Each fragment carries its own joining words so a
 * translator can put them where the language wants them.
 *
 * The character's own words are set apart inside it — `interpolate` rather than `t`, so what is
 * emphasised is the substituted value and not a span of the sentence a translator would have to
 * keep in the right place. It is the sentence's nouns that a reader is scanning for: the race, the
 * classes, the deity. The connecting words are there to be read past.
 */
function useIdentitySentence(draft: CharacterBody): ReactNode {
  const t = useT();
  return useMemo(() => {
    const race = (draft.race ?? "").trim();
    const alignment = (draft.alignment ?? "").trim();
    const deity = (draft.deity ?? "").trim();
    const classes = (draft.class_levels ?? [])
      .filter((row) => (row.class_name ?? "").trim() !== "")
      .map((row) => `${row.class_name} ${row.level}`)
      .join(" / ");

    const said = (text: string) => (
      <b className="font-semibold text-rail-accent">{text}</b>
    );

    const parts: ReactNode[] = [];
    if (race !== "" && alignment !== "")
      parts.push(interpolate(t("rail.who.race"), { race: said(race), alignment: said(alignment) }));
    else if (race !== "")
      parts.push(interpolate(t("rail.who.raceOnly"), { race: said(race) }));
    else if (alignment !== "")
      parts.push(interpolate(t("rail.who.alignmentOnly"), { alignment: said(alignment) }));
    // The class list is already a phrase — "Fighter 4 / Rogue 3" — and needs no sentence
    // around it, so it joins the others as it is rather than through a key whose whole
    // value would be one placeholder.
    if (classes !== "") parts.push(said(classes));
    if (deity !== "") parts.push(interpolate(t("rail.who.deity"), { deity: said(deity) }));

    if (parts.length === 0) return t("rail.who.unnamed");
    return parts.map((part, index) => (
      <Fragment key={index}>
        {index > 0 && ", "}
        {part}
        {index === parts.length - 1 && "."}
      </Fragment>
    ));
  }, [draft.race, draft.alignment, draft.deity, draft.class_levels, t]);
}

export function DerivedRail({ draft, derived, save }: Props) {
  const { t, weight, weightNumber } = useI18n();
  const sentence = useIdentitySentence(draft);
  const ac = derived.armor_class;
  const load = derived.encumbrance;

  const hpTotal = draft.hp_total ?? 0;
  const hpCurrent = draft.hp_current ?? 0;
  // Presentation, not rules: how full a bar is drawn. Nothing downstream reads it and no derived
  // number is produced from it — the two figures beside the bar come from the draft as they are.
  const hpFraction = hpTotal > 0 ? Math.max(0, Math.min(1, hpCurrent / hpTotal)) : 0;

  /*
   * Where to draw the marker on the load scale.
   *
   * Drawing only. The three bands are equal thirds of the bar but not equal ranges of weight — a
   * heavy load runs from the medium limit to the heavy one — so the fraction is worked out band by
   * band, and it is worked out here rather than in the engine because it answers "how far along
   * this bar" and not "what can this character carry". Nothing reads it but a `left:`. Which band
   * the character is *in* is `encumbrance.category`, which the engine decided.
   */
  const carried = Number(load.carried_weight);
  const markerFraction = (() => {
    if (!Number.isFinite(carried) || carried <= 0 || load.heavy_load <= 0) return 0;
    const band = (from: number, to: number, index: number) =>
      (index + (to > from ? (carried - from) / (to - from) : 0)) / 3;
    if (carried <= load.light_load) return band(0, load.light_load, 0);
    if (carried <= load.medium_load) return band(load.light_load, load.medium_load, 1);
    if (carried <= load.heavy_load) return band(load.medium_load, load.heavy_load, 2);
    return 1;
  })();

  const warnings = derived.warnings ?? [];
  const quiet = quietSaveKey(save);

  return (
    <aside
      aria-label={t("rail.title")}
      className={cn(
        "overflow-hidden rounded-lg border border-rail-line text-rail-foreground",
        "bg-rail-line shadow-[0_6px_24px_rgba(0,0,0,0.35)]",
        // Sticky, and scrollable in itself: a rail taller than the viewport that pinned its top
        // would hide its own saves behind the fold on a laptop.
        "lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto",
        /*
         * Beside the sheet it is a column; above the sheet it is a banner.
         *
         * Stacked, the rail is some 690px tall — on a phone that is four-fifths of the viewport
         * standing between the reader and the first field they came to fill in, on both pages,
         * every time they open the sheet. So below `lg` the same sections reflow into two or three
         * columns and the whole thing becomes a band about a third that height. Nothing is dropped
         * on the way: what a small screen has less of is vertical room, not interest in its own
         * armour class.
         *
         * The hairlines are this grid's 1px gaps with the container's colour showing through, so
         * they run the right way in both layouts without a single section knowing which it is in.
         */
        "grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-1",
      )}
    >
      {/* The character names itself here rather than in a page header, because this is the one
          region present on both pages. It is the sheet's `<h1>`. */}
      <div className="col-span-2 bg-rail px-3.5 py-3 sm:col-span-3 lg:col-span-1">
        <h1 className="font-heading text-[1.45rem] leading-tight text-white">
          {(draft.name ?? "").trim() === "" ? t("characters.unnamed") : draft.name}
        </h1>
        {/* Below `lg` the rail is a banner and every line of it costs the reader a field they
            came to fill in. The sentence and the level are description rather than arithmetic,
            and both restate fields that the identity and class panels show a scroll below —
            so they are the first things to go, and the totals are the last. */}
        <p className="mt-0.5 hidden text-[0.8rem] leading-snug text-rail-muted lg:block">
          {sentence}
        </p>
        {/* Level 0 is not a character with no levels so much as a sheet with no class typed in
            yet, and the rank maximum in every skill hangs off it — so the rail says where to go
            and fix it rather than reporting a nought and leaving the reader to wonder. */}
        <p className="mt-1.5 hidden text-[0.72rem] text-rail-muted lg:block">
          {t("sheet.characterLevel", { level: derived.character_level })}
          {derived.character_level === 0 && t("sheet.addClassBelow")}
        </p>
      </div>

      {/* The anchor strip. Six modifiers, present on both pages, because every derived number on
          either page traces back to one of them. No `aria-label`s — see the file comment. */}
      <RailSection title={t("rail.abilityModifiers")} icon={<IconAbilities />} wide bar>
        <dl className="grid grid-cols-6 gap-px overflow-hidden rounded-sm bg-rail-line">
          {ABILITIES.map(({ key, short }) => (
            <div key={key} className="bg-rail px-0.5 py-1 text-center">
              <dt className="rail-label tracking-[0.06em]">{short}</dt>
              <dd
                className={cn(
                  "m-0 mt-0.5 text-[1.05rem] leading-none font-semibold tabular-nums",
                  derived.abilities[key].modifier > 0
                    ? "text-rail-accent"
                    : "text-rail-foreground",
                )}
              >
                {signed(derived.abilities[key].modifier)}
              </dd>
            </div>
          ))}
        </dl>
      </RailSection>

      {/* Reading order from here is what combat asks for, not what the paper sheet prints. */}
      <RailSection>
        <Derived
          variant="railHeadline"
          icon={<IconInitiative />}
          label={t("init.initiative")}
          value={signed(derived.initiative)}
        />
      </RailSection>

      <RailSection>
        <Derived
          variant="railHeadline"
          icon={<IconArmorClass />}
          label={t("ac.total")}
          value={ac.total}
        />
        {/* The three readings a player takes with the armour class rather than after it. Speed
            sits here and not with hit points because it is what the armour costs you, and the
            armour is what the block above is about. A left-aligned row, not a grid: they are read
            left to right as a series, and a grid would put "flat-footed" out at the halfway mark
            with a gap where the eye expects the next reading. */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          <Derived variant="rail" label={t("ac.touch")} value={ac.touch} />
          <Derived variant="rail" label={t("ac.flatFooted")} value={ac.flat_footed} />
          {(draft.speed ?? "").trim() !== "" && (
            <Reading label={t("hp.speed")} value={draft.speed} />
          )}
        </div>
        <Parts
          label={t("rail.parts.show")}
          rows={[
            { name: t("rail.parts.base"), value: "10" },
            { name: t("rail.parts.armour"), value: signed(ac.armor_bonus) },
            { name: t("rail.parts.shield"), value: signed(ac.shield_bonus) },
            {
              name: t("rail.parts.dexApplied"),
              value: signed(ac.effective_dex_bonus),
            },
            { name: t("rail.parts.natural"), value: signed(ac.natural_armor) },
            { name: t("rail.parts.deflection"), value: signed(ac.deflection) },
            { name: t("rail.parts.size"), value: signed(ac.size_modifier) },
            { name: t("rail.parts.misc"), value: signed(ac.misc) },
          ]}
        />
      </RailSection>

      {/* Hit points are the one thing here that is *typed*, not derived — but they are what a
          player looks at most often mid-session, and the rail is where you look. They carry no
          `aria-label`: `HitPoints` on page one owns the names "Total" and "Current". */}
      <RailSection>
        <Reading headline icon={<IconHitPoints />} label={t("rail.hitPoints")} value={hpCurrent} />
        <div
          aria-hidden="true"
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8a2b1c] to-[#c0603f]"
            style={{ width: `${hpFraction * 100}%` }}
          />
        </div>
        {/* The three readings that qualify the number above, laid out the way the armour class's
            are — same shape, same label size, so the rail reads as one instrument and not as a
            stack of separately designed blocks. */}
        <div className="mt-1.5 hidden flex-wrap gap-x-4 gap-y-1.5 lg:flex">
          <Reading label={t("rail.hitPoints.ofTotal")} value={hpTotal} />
          <Reading label={t("rail.hitPoints.nonlethal")} value={draft.nonlethal_damage ?? 0} />
          <Reading
            label={t("rail.hitPoints.damageReduction")}
            value={(draft.damage_reduction ?? "").trim() === "" ? "—" : draft.damage_reduction}
          />
        </div>
      </RailSection>

      <RailSection>
        <Derived
          variant="railHeadline"
          icon={<IconAttacks />}
          label={t("init.grapple")}
          value={signed(derived.grapple_modifier)}
        />
        <Parts
          label={t("rail.parts.show")}
          rows={[
            { name: t("rail.parts.baseAttack"), value: signed(draft.base_attack_bonus ?? 0) },
            {
              name: t("rail.parts.strength"),
              value: signed(derived.abilities.strength.modifier),
            },
            { name: t("rail.parts.size"), value: signed(draft.grapple_size_modifier ?? 0) },
            { name: t("rail.parts.misc"), value: signed(draft.grapple_misc ?? 0) },
          ]}
        />
      </RailSection>

      <RailSection title={t("rail.saves")} icon={<IconSaves />} bar>
        <div className="grid grid-cols-3 gap-1">
          {SAVES.map((save_) => (
            <div key={save_} className="rounded-sm bg-black/20 px-1 py-1 text-center">
              {/* The accessible name is the full "Fortitude total" the rest of the suite reads;
                  the three letters on screen are what fits a third of the rail. */}
              <span className="rail-label block">{t(SAVE_SHORT[save_])}</span>
              <output
                aria-label={t("saves.aria.total", { save: t(`save.${save_}`) })}
                className="mt-0.5 block text-[1.15rem] leading-none font-semibold tabular-nums text-white"
              >
                {signed(derived.saves[save_].total)}
              </output>
            </div>
          ))}
        </div>
      </RailSection>

      {/* A bare "148 lb." says nothing without the table it has to be compared against, so the
          three limits are drawn as the bands they are. The marker is placed by proportion — a
          drawing instruction, not a rule; `category` is what says which band it is actually in,
          and that comes from the engine. */}
      <RailSection title={t("rail.load")} icon={<IconPossessions />}>
        <div
          className="relative flex h-3 rounded-sm border border-rail-line"
          role="img"
          aria-label={t("rail.load.aria")}
        >
          <span className="flex-1 rounded-l-[1px] bg-[#3d5c40]" />
          <span className="flex-1 bg-[#7a6a2a]" />
          <span className="flex-1 rounded-r-[1px] bg-[#6b2f22]" />
          {/* Without this the three bands say nothing the sentence below does not say better —
              they are a scale, and a scale with nothing marked on it is decoration. The position
              is a drawing instruction and not a rule: which band the character is actually in is
              `category`, which the engine decided, and that is what the sentence reports. */}
          <span
            className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-rail-accent"
            style={{ left: `calc(${markerFraction * 100}% - 1px)` }}
          />
        </div>
        {/* The three limits, under the band each one ends. Without them the bar is a colour ramp
            and the sentence below is doing all the work; with them a player can see that they are
            twenty pounds from a heavy load without doing the subtraction. */}
        <div
          aria-hidden="true"
          className="mt-1 flex justify-between text-[0.6rem] tabular-nums text-rail-muted"
        >
          {/* Bare figures, but converted alongside the sentence below them: these three are read
              against the weight it reports, and a scale in pounds under a total in kilograms is a
              character who looks four times as burdened as they are. */}
          <span className="capitalize">{`${t("load.light")} ${weightNumber(load.light_load)}`}</span>
          <span className="capitalize">{`${t("load.medium")} ${weightNumber(load.medium_load)}`}</span>
          <span className="capitalize">{`${t("load.heavy")} ${weightNumber(load.heavy_load)}`}</span>
        </div>
        <p className="mt-1 text-[0.72rem] leading-snug text-rail-muted">
          {t("rail.load.carrying", {
            weight: weight(load.carried_weight),
            category: t(`load.${load.category}`),
          })}
        </p>
      </RailSection>

      {/* The foot of the rail: whether the sheet is saved, and whether there is anything to read.
          A count rather than the warnings themselves — those are written out in full above both
          pages, and this is here so a player working on page two knows to go back and look. */}
      {(quiet !== null || warnings.length > 0) && (
        <RailSection wide className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {quiet !== null && (
            <p role="status" className="flex items-center gap-1.5 text-[0.72rem] text-rail-muted">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  save.status === "saved" ? "bg-ok" : "bg-rail-accent",
                )}
              />
              {t(quiet)}
            </p>
          )}
          {warnings.length > 0 && (
            <p className="text-[0.72rem] text-rail-accent">
              {t("rail.warnings", { count: String(warnings.length) })}
            </p>
          )}
        </RailSection>
      )}
    </aside>
  );
}
