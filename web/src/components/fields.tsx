/**
 * Input primitives, built on shadcn/ui.
 *
 * `Derived` is the only way a computed number reaches the screen: it takes a value it is handed
 * and renders it. Nothing in this file — or anywhere else in the frontend — does rules
 * arithmetic. Once a formula exists in both Python and TypeScript the two drift, and the result
 * is a sheet that is right on one screen and wrong on another.
 *
 * Every field nests its control inside the shadcn `Label`, so the accessible name comes from the
 * implicit label association rather than from hand-managed `id`/`htmlFor` pairs. A sheet this
 * dense would otherwise need a generated id for each of some two hundred controls.
 */
import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * The sheet is a wrapping flex layout, so a field's width is a flex basis rather than a column.
 * Below the phone breakpoint every field takes the full row.
 */
const field = cva(
  "flex flex-col items-start gap-1 max-[720px]:basis-full max-[720px]:min-w-0",
  {
    variants: {
      width: {
        default: "min-w-36 flex-[1_1_9rem]",
        compact: "min-w-24 flex-[0_1_6rem]",
        wide: "basis-full grow",
      },
    },
    defaultVariants: { width: "default" },
  },
);

/**
 * The panel shell: a ruled edge around a parchment face.
 *
 * It was a hand-inked `border-image` ten pixels thick. The drawing was the loudest thing on a page
 * that has fifteen panels on it, and a wobbling frame around a table of numbers reads as an
 * ornament the reader has to look past rather than as the edge of a region. A hairline and a small
 * radius say the same thing — *this group is one thing* — in a way that stops saying it once you
 * have understood it, which is what a border is supposed to do.
 */
const PANEL = "rounded-[0.45rem] border shadow-[0_2px_10px_rgba(30,16,4,0.28)]";

/** Denser than the shadcn default: a page of `h-9` controls does not fit a character sheet. */
export const controlClass = "h-8 w-full text-sm";
export const numberClass = `${controlClass} text-right`;

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="field-label">{children}</span>;
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
  compact?: boolean;
  /**
   * An accessible name that overrides the visible label.
   *
   * For a field that appears more than once on the page — one per spellcasting class — where the
   * visible label is the same word each time and the accessible name has to say *which* block it
   * belongs to. It contains the visible label's own words, so the two still agree for someone
   * reading the screen and driving it by voice.
   */
  aria?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  wide,
  compact,
  aria,
}: TextFieldProps) {
  return (
    <Label
      className={field({
        width: wide === true ? "wide" : compact === true ? "compact" : "default",
      })}
    >
      <FieldLabel>{label}</FieldLabel>
      <Input
        className={controlClass}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={aria}
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
}

export function NumberField({ label, value, onChange, min, max, compact }: NumberFieldProps) {
  return (
    <Label className={field({ width: compact === true ? "compact" : "default" })}>
      <FieldLabel>{label}</FieldLabel>
      <Input
        className={numberClass}
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
    </Label>
  );
}

interface OptionalNumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
}

/** For the sheet's TEMPORARY SCORE column and armour's MAX DEX: blank is a real value. */
export function OptionalNumberField({
  label,
  value,
  onChange,
  min,
  max,
}: OptionalNumberFieldProps) {
  return (
    <Label className={field({ width: "compact" })}>
      <FieldLabel>{label}</FieldLabel>
      <Input
        className={numberClass}
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
      />
    </Label>
  );
}

interface DecimalFieldProps {
  label: string;
  /** Decimals cross the wire as strings so no precision is lost; the draft holds them verbatim. */
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export function DecimalField({ label, value, onChange, compact }: DecimalFieldProps) {
  return (
    <Label className={field({ width: compact === true ? "compact" : "default" })}>
      <FieldLabel>{label}</FieldLabel>
      <Input
        className={numberClass}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function TextAreaField({ label, value, onChange, rows }: TextAreaFieldProps) {
  return (
    <Label className={field({ width: "wide" })}>
      <FieldLabel>{label}</FieldLabel>
      {/* `field-sizing-fixed` undoes the primitive's `field-sizing-content`, which otherwise wins
          over `rows` and starts the spell notes at three lines instead of ten. */}
      <Textarea
        className="field-sizing-fixed font-mono text-[0.85rem]"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}

/**
 * Where a computed value is being shown, which decides how it is drawn.
 *
 * `tile` is a value sitting among the fields that feed it — a darker tile cut into the parchment.
 * `rail` and `railHeadline` are the two sizes inside `DerivedRail`, which is a different surface
 * and a different claim: nothing in the rail was typed by anybody. `railHeadline` puts the label
 * and the figure on one line so the rail's dozen answers scan as a column of figures.
 */
type DerivedVariant = "tile" | "rail" | "railHeadline";

interface DerivedProps {
  label: string;
  value: ReactNode;
  title?: string;
  emphasis?: boolean;
  variant?: DerivedVariant;
  /**
   * `railHeadline` only: the section's glyph, sat with the label rather than on a row of its own.
   * A rail section whose whole content is one figure has no header bar to hang an icon from, and
   * an icon alone on a line above the figure reads as a separate empty section.
   */
  icon?: ReactNode;
}

/**
 * A computed value. Read-only by construction — there is nowhere to type into it.
 *
 * The label lives in a sibling `<span>`, never merged into the `<output>`: the tests read the
 * output's text content to assert what the engine returned, and a label folded into the same
 * element would make an empty modifier column look non-empty.
 *
 * Every derived number on screen goes through here, the rail's included. A second component that
 * also rendered engine output would be a second place for the "no rules math in the frontend" rule
 * to be forgotten, and a second styling of the same fact.
 */
export function Derived({
  label,
  value,
  title,
  emphasis,
  variant = "tile",
  icon,
}: DerivedProps) {
  if (variant === "railHeadline") {
    return (
      <div className="flex items-baseline gap-3" title={title}>
        <span className="rail-label flex flex-1 items-center gap-1.5">
          {icon !== undefined && (
            <SectionIcon icon={icon} className="size-3 text-rail-accent" />
          )}
          {label}
        </span>
        {/* White, with the warm glow behind it rather than in it. The rail's gold is an accent
            and is spent on the few things that mean something by being gold — a positive ability
            modifier, the marker on the load scale, a link. Lettering every headline total in it
            spends the accent on everything, which is the same as spending it on nothing. */}
        <output
          className={cn(
            "text-[1.9rem] leading-none font-semibold tabular-nums text-white",
            "[text-shadow:0_0_18px_rgba(224,178,115,0.3)]",
          )}
          aria-label={label}
        >
          {value}
        </output>
      </div>
    );
  }

  if (variant === "rail") {
    return (
      <div className="flex min-w-14 flex-col gap-0.5" title={title}>
        <span className="rail-label">{label}</span>
        <output className="font-semibold tabular-nums text-rail-foreground" aria-label={label}>
          {value}
        </output>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-24 flex-col gap-0.5 rounded-md bg-secondary px-2.5 py-1.5",
        "max-[720px]:basis-full",
      )}
      title={title}
    >
      <FieldLabel>{label}</FieldLabel>
      <output
        className={cn(
          "font-semibold tabular-nums",
          emphasis === true && "text-2xl leading-tight",
        )}
        aria-label={label}
      >
        {value}
      </output>
    </div>
  );
}

/** A row of fields. The sheet wraps rather than columnising: field counts differ per panel. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>{children}</div>
  );
}

/** A row of `Derived` totals, set off from the inputs that feed them. */
export function TotalsRow({ children }: { children: ReactNode }) {
  return <Row className="mb-3">{children}</Row>;
}

/** Small print under a panel: what the engine did, or deliberately did not, work out. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-sm text-muted-foreground">{children}</p>;
}

/**
 * A section's icon.
 *
 * `aria-hidden` is applied here, once, rather than at each of the twenty-odd callsites. The
 * icons are Iconify SVGs resolved at build time, and unlike `lucide-react` they do not hide
 * themselves; an icon that reaches the accessibility tree joins its heading's accessible name,
 * and every suite in this repository addresses things by accessible name. The decoration is in
 * the wrapper so that no callsite can forget it.
 *
 * Exported for the nav's SRD mark, which is a game-icons glyph outside the sheet and so needs the
 * same wrapper for the same reason. An icon-*only* control still needs its own `aria-label`.
 */
export function SectionIcon({ icon, className }: { icon: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0 text-muted-foreground [&>svg]:size-full", className)}
    >
      {icon}
    </span>
  );
}

export function Panel({
  title,
  icon,
  meta,
  children,
  className,
}: {
  title: string;
  /**
   * The section's glyph, from `icons.tsx`. Decorative: it never names the panel. Required, so
   * that a section added later cannot quietly be the one without an icon.
   */
  icon: ReactNode;
  /**
   * A derived figure shown beside the title, as the skills panel does with its rank count.
   *
   * A **sibling** of the `<h2>`, never a child of it: folded inside, it would join the heading's
   * accessible name, and both the Vitest and Playwright suites find a section by
   * `getByRole("heading", { name: "Skills" })`. A heading that answers to "Skills 57" is a heading
   * nothing can address.
   */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(PANEL, "mb-4 gap-0 overflow-hidden py-0", className)}>
      {/* `[.border-b]:pb-2` overrides the primitive's `pb-6`, which assumes a header with a
          description under the title; this one is a single line. The primitive is a grid, which
          would stack `meta` under the title, so a header carrying one becomes a flex row —
          `cn` resolves the display conflict in favour of the later class.

          The bar bleeds to the frame because the card's padding box is already inside the 10px
          border, so nothing has to reach back out into it. */}
      <CardHeader
        className={cn(
          "gap-0 border-b bg-secondary px-3.5 py-2 [.border-b]:pb-2",
          meta !== undefined && "flex flex-row flex-wrap items-center gap-x-3",
        )}
      >
        <CardTitle asChild>
          <h2 className="panel-title flex items-center gap-1.5">
            <SectionIcon icon={icon} className="size-3.5 text-primary" />
            {title}
          </h2>
        </CardTitle>
        {meta !== undefined && (
          <span className="ml-auto font-normal text-[0.7rem] tracking-normal text-muted-foreground">
            {meta}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-3.5">{children}</CardContent>
    </Card>
  );
}

/**
 * Two panels sharing a row, each falling to full width when there is not room for both.
 *
 * Paired because they are read together — the ability scores beside the class levels that cap
 * every skill rank, the armour class beside the initiative the same Dexterity feeds. The pairing
 * is `auto-fit`, so it is the panel's own minimum that decides when the row breaks, not a
 * breakpoint that would have to be revisited every time a field is added to either side.
 *
 * `[&>*]:mb-0` cancels the bottom margin each `Panel` carries for the stacked case, rather than
 * threading a `className` through half a dozen block components to say the same thing.
 */
export function PanelPair({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "mb-4 grid items-stretch gap-4 [&>*]:mb-0",
        "[grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]",
      )}
    >
      {children}
    </div>
  );
}

/**
 * A repeated sub-block inside a panel — one armour slot, one attack, one spellcasting class.
 *
 * `legend` is usually the block's name. It takes a node so the spellcasting block can put its
 * rename control in there beside the name — but a **string is rendered exactly as it always was**,
 * with no wrapper of its own: `CharacterSheet.test.tsx` finds a gear slot by `getAllByText(slot)`
 * and then looks for the icon inside what it found, and an extra span would resolve that query to
 * an element the icon is not in.
 */
export function Fieldset({
  legend,
  icon,
  children,
}: {
  legend: ReactNode;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="mb-3 rounded-md border px-3 py-2.5">
      <legend className="field-label flex items-center gap-1.5 px-1">
        <SectionIcon icon={icon} className="size-3.5" />
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}
