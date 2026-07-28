/**
 * The exported sheet's visual design.
 *
 * The same parchment-and-ink palette as `styles.css`, restated here because `@react-pdf/renderer`
 * lays out against its own stylesheet and cannot read CSS custom properties. These are the only
 * colours the document uses; keep them in step with the `:root` block in `styles.css`.
 *
 * What is *not* here is deliberate. The printed record sheet's design — reversed-out small caps on
 * solid black bars, the publisher's wordmark, the original typography — is not reproduced. See the
 * licensing section of CLAUDE.md: the sheet's structure is mechanical and usable, its design is
 * not.
 */
/*
 * Flattened where the screen is translucent: a panel on screen is parchment over the page's
 * leather grain, and a printed page has nothing behind it to show through. These are the
 * composited results, not the rgba values.
 */
export const COLOR = {
  paper: "#fbf4ea",
  card: "#fdf7ee",
  ink: "#2b1f19",
  inkSoft: "#6d5c50",
  accent: "#8a2b1c",
  accentSoft: "#efdbc4",
  rule: "#d8c3a8",
} as const;

/** Helvetica is built into every PDF reader, so the export needs no font fetch to render. */
export const FONT = {
  body: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
} as const;

/** US Letter at 30pt margins, matching the paper form the layout follows. */
export const PAGE = {
  size: "LETTER",
  margin: 30,
} as const;
