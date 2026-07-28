/**
 * The export control.
 *
 * Rendering runs in this tab and the document is not small, so the button reports its own state
 * rather than appearing to do nothing for a second. A failure is announced in place, next to the
 * control that caused it — the same reason autosave failure is a banner and not a toast: a notice
 * that vanishes is a notice the user never saw.
 */
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import type { CharacterBody, DerivedSheet, SkillDefinition } from "../api/types";
import { useI18n } from "../i18n";
import { exportCharacterPdf } from "../pdf/exportCharacterPdf";
import { Button } from "@/components/ui/button";

interface Props {
  character: CharacterBody;
  derived: DerivedSheet;
  /**
   * The skill list, for naming the exported rows.
   *
   * A `DerivedSkill` carries the English name the engine was handed, not a translation, so the
   * document is given the definitions and looks each row up by identifier — the same list the
   * on-screen table is labelled from.
   */
  definitions: SkillDefinition[];
  /**
   * How the button is drawn where it is used.
   *
   * The sheet header sits on the page's ground rather than on a panel, and a control there has to
   * be lettered for the ground. The failure notice beside it is left alone — it is `destructive`
   * text, and it is the one thing here that must not be restyled to blend in.
   */
  className?: string;
}

export function ExportPdfButton({ character, derived, definitions, className }: Props) {
  /**
   * The document is rendered by react-pdf's own reconciler, outside this provider tree, so it
   * cannot call `useI18n` for itself. The translator is read here — inside the tree — and passed
   * down as an ordinary prop.
   */
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await exportCharacterPdf(character, derived, { translator: i18n, definitions });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
        {busy ? i18n.t("export.busy") : i18n.t("export.button")}
      </Button>
      {failed && (
        <span role="alert" className="text-[0.78rem] text-destructive">
          {i18n.t("export.failed")}
        </span>
      )}
    </span>
  );
}
