/**
 * Rendering the sheet to a PDF file and handing it to the browser.
 *
 * `@react-pdf/renderer` and its font machinery are large and nobody needs them until they press
 * the button, so the module is imported dynamically — it stays out of the initial bundle and off
 * the per-keystroke path entirely.
 *
 * The language is passed in rather than read from context: react-pdf renders through its own
 * reconciler, outside the application's provider tree, so nothing under `CharacterSheetDocument`
 * can reach a React context. `ExportPdfButton` reads the translator and hands it down.
 */
import type { CharacterBody, DerivedSheet, SkillDefinition } from "../api/types";
import type { Translator } from "../i18n";

export interface ExportOptions {
  translator: Translator;
  /** For naming the skill rows: a `DerivedSkill` carries the engine's English name only. */
  definitions: SkillDefinition[];
}

/** `Beorn Ironhand — character sheet.pdf`, or a usable fallback for an unnamed character. */
export function pdfFilename(name: string | null | undefined, translator: Translator): string {
  const trimmed = (name ?? "").trim();
  const safe = trimmed.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  return translator.t("pdf.filename", {
    name: safe === "" ? translator.t("pdf.filenameFallback") : safe,
  });
}

/** Render the sheet and return it as a PDF blob. Exported separately so tests can assert on it. */
export async function renderCharacterPdf(
  character: CharacterBody,
  derived: DerivedSheet,
  options: ExportOptions,
): Promise<Blob> {
  const [{ pdf }, { CharacterSheetDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./CharacterSheetDocument"),
  ]);
  return pdf(
    <CharacterSheetDocument
      character={character}
      derived={derived}
      translator={options.translator}
      definitions={options.definitions}
    />,
  ).toBlob();
}

/**
 * Render and download. The object URL is revoked on the next tick rather than immediately —
 * Safari has not started reading the blob by the time `click()` returns.
 */
export async function exportCharacterPdf(
  character: CharacterBody,
  derived: DerivedSheet,
  options: ExportOptions,
): Promise<void> {
  const blob = await renderCharacterPdf(character, derived, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFilename(character.name, options.translator);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
