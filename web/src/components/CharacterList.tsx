/**
 * The character list. TanStack Query owns it; nothing here is mirrored into local state.
 *
 * This is the one region of the application that sits directly on the page's ground rather than on
 * a parchment panel, so everything outside a tile is lettered in `--on-ground` rather than in ink.
 * Ink on the woven stripe is very nearly invisible, which is what the heading used to be.
 *
 * A tile is built out of **both** of the sheet's materials, which is the whole of this design. The
 * sheet spends a rule on telling derived values from typed ones by place — the slate rail beside
 * the parchment column — and this is the first screen anyone sees. So the head band is slate and
 * carries the one figure here the application worked out (the character level, every class level
 * added up), and the body is parchment and carries what the player typed: the classes themselves,
 * the race, the campaign.
 *
 * The signature is the **ledger**: one row per class, its level right-aligned in a column exactly
 * `--fig` wide, and that is the same column the gold total sits in up in the slate. The 4 and the 3
 * line up directly under the 7 — the tile shows its own arithmetic. `--fig` is set once, on the
 * tile, and read by both; splitting it into two measurements is what silently ends this.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../api/client";
import type { CharacterSummary } from "../api/types";
import { useI18n, useT } from "../i18n";
import {
  ACCEPTED_IMAGE_TYPES,
  PortraitError,
  preparePortrait,
} from "../lib/portrait";
import { since } from "../lib/since";
import { SectionIcon, controlClass } from "./fields";
import { IconCharacter } from "./icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onOpen: (id: string) => void;
}

/**
 * A control lettered for slate rather than for parchment.
 *
 * shadcn's focus ring is `--ring`, which is the sheet's vermilion: on `--rail` at #241a13 that is a
 * dark red halo on a dark brown field and cannot be seen at all. This is the head band's answer to
 * the same problem `ON_GROUND` solves in `CharacterSheet.tsx` — a control's chrome belongs to the
 * surface it sits on, not to the palette's default.
 */
const ON_RAIL =
  "focus-visible:border-rail-accent focus-visible:ring-rail-accent/50";

/**
 * The character level: every class level added up.
 *
 * Not rules math — it is the same sum `CharacterSummary` would carry if the list derived anything,
 * and the list deliberately does not call `/api/derive`. Nothing is computed from it here; it is
 * printed, in the band, in gold, over the ledger it is the total of.
 */
function characterLevel(character: CharacterSummary): number {
  return (character.class_levels ?? []).reduce(
    (total, entry) => total + entry.level,
    0,
  );
}

function displayName(character: CharacterSummary, unnamed: string): string {
  return character.name === "" ? unnamed : character.name;
}

/**
 * One tile.
 *
 * The portrait's state lives here rather than in a component of its own so that a notice about it
 * gets the tile's width: a sentence rendered inside the portrait token's 2.75rem column wraps to
 * seven lines and stretches every tile in the row with it.
 *
 * The portrait control is icon-only, so it carries its own `aria-label` — `SectionIcon` hides the
 * glyph from the accessible name, which is what leaves the label as the whole of it. The image is
 * decorative for the same reason: the control already says whose portrait it is, and an `alt`
 * naming the character again would have a screen reader say it twice.
 *
 * The upload is not part of the character's `version`. A portrait changed here must not make a
 * sheet the same user has open in another tab fail its next autosave with a 409.
 */
function CharacterCard({
  character,
  onOpen,
  onDelete,
}: {
  character: CharacterSummary;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const named = character.name !== "";
  const name = displayName(character, t("characters.unnamed"));
  const level = characterLevel(character);
  const classes = character.class_levels ?? [];
  const stamp = character.portrait_updated_at ?? null;

  /**
   * The list *and* this character's own query.
   *
   * The tile reads the stamp from the summary, but the sheet reads it from `GET
   * /api/characters/{id}` — so a sheet opened straight after an upload would draw the empty frame
   * from the cached body and only swap the picture in when a background refetch happened to land.
   */
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["characters"] }),
      queryClient.invalidateQueries({ queryKey: ["character", character.id] }),
    ]);

  const upload = useMutation({
    mutationFn: async (file: File) =>
      api.uploadPortrait(character.id, await preparePortrait(file)),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
    onError: (failure: unknown) =>
      setError(
        failure instanceof PortraitError
          ? t(`characters.${failure.key}`)
          : t("characters.portraitFailed"),
      ),
  });

  const remove = useMutation({
    mutationFn: () => api.deletePortrait(character.id),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
    onError: () => setError(t("characters.portraitFailed")),
  });

  const busy = upload.isPending || remove.isPending;

  return (
    /* `--fig` once, here, because two elements in two different surfaces share it — see the file
       header. The tile overrides `Card`'s own `gap-6 py-6 rounded-xl`: the band, the ledger and the
       foot each carry their own padding and must meet edge to edge, and `overflow-hidden` is what
       keeps the slate from squaring off the top corners the border rounds. */
    <Card className="h-full w-full gap-0 overflow-hidden rounded-md p-0 shadow-none transition-[box-shadow,border-color] duration-150 ease-[ease] [--fig:2.75rem] hover:border-heading hover:shadow-[0_6px_20px_rgba(0,0,0,0.25)] focus-within:border-heading focus-within:shadow-[0_6px_20px_rgba(0,0,0,0.25)]">
      {/* The slate band: what the application worked out.

          The gradient is written out rather than built from `bg-gradient-to-b`, which interpolates
          in oklab: over two colours this close that is a different pair of midtones for no reason,
          and the rail it is quoting is a flat sRGB surface. */}
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_var(--fig)] items-center gap-[0.65rem] border-b border-rail-line bg-[linear-gradient(180deg,var(--rail-2),var(--rail))] px-[0.8rem] py-[0.7rem] text-rail-foreground">
        <div className="relative size-11 shrink-0">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            aria-label={t(
              stamp === null
                ? "characters.portraitAdd"
                : "characters.portraitChange",
              { name },
            )}
            className={`size-11 overflow-hidden rounded-[calc(var(--radius)-1px)] border-rail-line bg-rail-well p-0 shadow-none hover:border-rail-accent hover:bg-rail-well dark:border-rail-line dark:bg-rail-well dark:hover:bg-rail-well ${ON_RAIL}`}
            onClick={() => picker.current?.click()}
          >
            {stamp === null ? (
              <SectionIcon
                icon={<IconCharacter />}
                className="size-[1.3rem] text-rail-muted"
              />
            ) : (
              <img
                src={api.portraitUrl(character.id, stamp)}
                alt=""
                className="size-full object-cover"
              />
            )}
          </Button>

          {/* Only offered where there is something to remove. A bare multiplication sign rather
              than an icon: `icons.tsx` is the sheet's *section* vocabulary and a `game-icons`
              glyph added for this would mean an ICONS.txt edit to draw a cross. It is lettered for
              the band it now sits in — a parchment badge on slate is a bright dot in the darkest
              corner of the tile. */}
          {stamp !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={t("characters.portraitRemove", { name })}
              /* `size-4`, not the `size-5` this was on the old 64px portrait: the token is 44px
                 now, and the same badge that covered a tenth of the picture covers a fifth of it
                 — a control large enough to be the first thing read in the tile's darkest corner. */
              className={`absolute -top-1 -right-1 size-4 rounded-full border-rail-line bg-rail-2 p-0 text-[0.625rem] leading-none text-rail-foreground shadow-none hover:border-rail-accent hover:bg-rail-2 hover:text-rail-accent dark:border-rail-line dark:bg-rail-2 dark:hover:bg-rail-2 ${ON_RAIL}`}
              onClick={() => remove.mutate()}
            >
              <span aria-hidden="true">×</span>
            </Button>
          )}

          {/* Left in the tree rather than swapped in, so the picker keeps its identity across a
              re-render and a chosen file is not dropped mid-upload. */}
          <input
            ref={picker}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so choosing the same file twice in a row still fires a change.
              event.target.value = "";
              if (file !== undefined) upload.mutate(file);
            }}
          />
        </div>

        {/* The name and the race under it are one control: they are what the reader is aiming at,
            and two separate targets for the same destination is two ways to miss. It is labelled
            rather than left to name itself from its contents — an accessible name assembled from
            both lines reads "Bramwell Human", which is a sentence nobody wrote.

            The name is *lettered*, not set. `font-heading` is kept in this application for the one
            thing that is a name rather than a category, and on this screen every tile is exactly
            that. An unnamed character is the exception: "Unnamed character" is a description, so it
            is set in the body face, in italic, and stays quiet. */}
        <Button
          type="button"
          variant="ghost"
          aria-label={t("characters.open", { name })}
          className={`group/open block h-auto w-full min-w-0 p-0 text-left whitespace-normal hover:bg-transparent dark:hover:bg-transparent ${ON_RAIL}`}
          onClick={onOpen}
        >
          <span
            className={
              named
                ? "block truncate font-heading text-[1.15rem] leading-[1.2] font-normal text-rail-foreground group-hover/open:text-rail-accent"
                : "block truncate text-[0.95rem] leading-[1.2] font-normal text-rail-muted italic group-hover/open:text-rail-accent"
            }
          >
            {name}
          </span>
          <span
            /* `leading-[1.45]` is the body's own line height, restated because the control around
               it is a `Button` and `text-sm` sets one the two lines would otherwise inherit. */
            className={`block truncate text-[0.72rem] leading-[1.45] font-normal text-rail-muted ${character.race === "" ? "italic" : ""}`}
          >
            {character.race === "" ? t("characters.raceUnset") : character.race}
          </span>
        </Button>

        {/* Gold, because the rail spends its accent on the few things that mean something by being
            gold — and on this screen exactly one figure was worked out rather than typed.

            The caption is a sibling of the figure, which is how every derived value on this
            application is written; the `<output>` carries the whole reading as its accessible name,
            so "Level 7" is one string to a screen reader and to a test. With no classes typed there
            is no level to name — "Level 0" would be a false statement — so the figure goes to a
            dash and loses the label with it. */}
        <p className="m-0 text-right">
          <span className="block text-[0.55rem] font-semibold tracking-[0.13em] text-rail-muted uppercase">
            {t("characters.levelCap")}
          </span>
          {level > 0 ? (
            <output
              aria-label={t("characters.level", { level })}
              className="block text-[1.6rem] leading-[1.05] font-semibold text-rail-accent lining-nums tabular-nums"
            >
              {level}
            </output>
          ) : (
            <output className="block text-[1.2rem] leading-[1.05] font-normal text-rail-muted lining-nums tabular-nums">
              {t("characters.levelUnset")}
            </output>
          )}
        </p>
      </div>

      {/* The parchment ledger: what the player typed. One row per class, so "druide 4 / mage 2 /
          Arcane Hiérophante 1" — one string that wraps into soup at any tile width — becomes three
          rows that never wrap and are each readable on their own. */}
      {classes.length > 0 ? (
        <ul className="m-0 list-none px-[0.8rem] pt-[0.5rem] pb-[0.55rem]">
          {classes.map((entry, index) => (
            <li
              // Position, not name: two rows may legitimately carry the same class name, and the
              // list is not reordered here.
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_var(--fig)] items-baseline gap-[0.65rem] py-[0.16rem]"
            >
              <span className="truncate text-[0.9rem]">{entry.class_name}</span>
              {/* The `--fig` column. Same width as the total above it, with the same padding on the
                  container, so this figure sits directly under the gold one it is part of. */}
              <span className="text-right text-[0.9rem] font-semibold text-heading lining-nums tabular-nums">
                {entry.level}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 px-[0.8rem] pt-[0.7rem] pb-[0.55rem] text-[0.85rem] text-muted-foreground">
          <b className="block text-[0.9rem] font-semibold text-foreground">
            {t("characters.noClass")}
          </b>
          {t("characters.noClassHint")}
        </p>
      )}

      {/* The portrait's own news. Between the ledger and the foot, where it gets the tile's full
          width and pushes nothing out of the band. */}
      {busy && (
        <p className="px-[0.8rem] pb-1 text-xs text-muted-foreground">
          {t("characters.portraitSaving")}
        </p>
      )}
      {error !== null && !busy && (
        <p className="px-[0.8rem] pb-1 text-xs leading-snug text-destructive">
          {error}
        </p>
      )}

      {/* Where it is played and when it was last touched, on one muted line. `mt-auto` is what keeps
          the feet of a ragged row of tiles level with each other. */}
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-[0.4rem] pr-[0.5rem] pb-[0.45rem] pl-[0.8rem]">
        <span
          className={`min-w-0 truncate text-[0.75rem] lining-nums tabular-nums ${character.campaign === "" ? "text-ink-faint italic" : "text-muted-foreground"}`}
        >
          {[
            character.campaign === ""
              ? t("characters.campaignUnset")
              : character.campaign,
            since(character.updated_at, locale, t("characters.justNow")),
          ]
            .filter((part) => part !== "")
            .join(" · ")}
        </span>
        {/* Delete, demoted: quiet text at the end of the foot that colours only on hover and focus,
            rather than an outline button sitting at the same weight as the thing the reader came
            for. Exactly as reachable and a great deal less loud.

            `name`, not `character.name`: an unnamed character would otherwise leave two buttons
            both accessibly named "Delete", which is ambiguous to a screen reader and to a test. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("characters.deleteNamed", { name })}
          className="ml-auto h-auto rounded-[3px] px-[0.35rem] py-[0.15rem] text-[0.75rem] font-normal text-ink-faint hover:bg-danger-soft hover:text-destructive focus-visible:bg-danger-soft focus-visible:text-destructive dark:hover:bg-danger-soft"
          onClick={onDelete}
        >
          {t("characters.delete")}
        </Button>
      </div>
    </Card>
  );
}

export function CharacterList({ onOpen }: Props) {
  const t = useT();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const characters = useQuery({
    queryKey: ["characters"],
    queryFn: api.listCharacters,
  });

  const create = useMutation({
    mutationFn: (value: string) => api.createCharacter(value),
    onSuccess: async (result) => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["characters"] });
      onOpen(result.character.id);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCharacter(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["characters"] }),
  });

  return (
    <section>
      {/* Set in the body face, not `font-heading`: MedievalSharp is kept for the one thing on this
          application that is a name rather than a category, which is the character — lettered in
          the rail on the sheet, and in each tile's band here. */}
      <h1 className="text-xl font-semibold tracking-tight text-on-ground">
        {t("characters.title")}
      </h1>

      <form
        className="mt-4 mb-6 flex items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(name.trim() === "" ? t("characters.new") : name.trim());
        }}
      >
        {/* `ground-label`, not `FieldLabel`: that one colours the span itself, so a colour on this
            `Label` would be inherited by nothing and the caption would stay ink on the stripe. */}
        <Label className="flex max-w-64 flex-1 flex-col items-start gap-1">
          <span className="ground-label">{t("characters.new")}</span>
          <Input
            type="text"
            className={`${controlClass} bg-field text-foreground`}
            value={name}
            placeholder={t("characters.namePlaceholder")}
            onChange={(event) => setName(event.target.value)}
          />
        </Label>
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? t("characters.creating") : t("characters.create")}
        </Button>
      </form>

      {characters.isLoading && (
        <p className="text-on-ground-muted">{t("characters.loading")}</p>
      )}
      {characters.isError && (
        <p className="text-on-ground">{t("characters.loadFailed")}</p>
      )}

      {characters.data?.length === 0 && (
        <p className="max-w-prose text-on-ground-muted">
          {t("characters.empty")}
        </p>
      )}

      {/* `auto-fill` with the tile's own minimum, not a column count per breakpoint: it is the tile
          that knows how narrow it can be read at, which is `PanelPair`'s reasoning exactly. The
          `<li>` is a flex box and the tile fills it, so a tile with three classes stretches its
          one-class neighbour and the two feet stay level instead of laddering. */}
      <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] gap-[1.15rem] p-0">
        {characters.data?.map((character) => (
          <li key={character.id} className="flex">
            <CharacterCard
              character={character}
              onOpen={() => onOpen(character.id)}
              onDelete={() => remove.mutate(character.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
