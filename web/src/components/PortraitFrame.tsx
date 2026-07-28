/**
 * The character's portrait, framed beside the identity fields on page one.
 *
 * Display only. Uploading, replacing and removing stay on the character list, and deliberately:
 * the portrait is outside the versioned document, and a control here would put an upload on the
 * same screen as the two-second autosave it must never be confused with. The frame reads the
 * stamp `CharacterWithDerived` carries beside the character — not on it, because that object goes
 * straight back out as a `PATCH` body and `CharacterBody` forbids extras.
 *
 * The stamp is also the cache-buster: a portrait replaced from the list is a different URL, so the
 * sheet opened afterwards shows the new image rather than the one the browser cached for a day.
 *
 * With no portrait the frame stays, holding the list's own glyph and a line saying where a picture
 * comes from — a box that appeared only once there was something in it would leave the question
 * unanswered on every sheet that has not been given one. The glyph goes through `SectionIcon`:
 * `unplugin-icons` emits raw SVG and does not hide itself, and a Vitest sweep fails any `<svg>`
 * outside an `aria-hidden` wrapper.
 */
import { api } from "../api/client";
import { useT } from "../i18n";
import { SectionIcon } from "./fields";
import { IconCharacter } from "./icons";

interface Props {
  characterId: string;
  /** `null` where the character has no portrait. */
  updatedAt: string | null;
}

export function PortraitFrame({ characterId, updatedAt }: Props) {
  const t = useT();

  return (
    <div className="w-36 shrink-0">
      {/* A hairline and a small radius, as every panel edge here is: the picture is the thing
          being framed, and a drawn frame around it would be a second one. */}
      <div className="flex size-36 items-center justify-center overflow-hidden rounded-md border bg-secondary">
        {updatedAt === null ? (
          <SectionIcon icon={<IconCharacter />} className="size-16 text-heading/70" />
        ) : (
          /* `object-cover`: the upload is already squared and centred by `lib/portrait.ts`, and
             letterboxing inside a frame reads as a fault in the frame. The alt is the whole of
             the accessible name — nothing else on the page names this image. */
          <img
            src={api.portraitUrl(characterId, updatedAt)}
            alt={t("sheet.portrait")}
            className="size-full object-cover"
          />
        )}
      </div>

      {updatedAt === null && (
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          {t("sheet.portraitEmpty")}
        </p>
      )}
    </div>
  );
}
