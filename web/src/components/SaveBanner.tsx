/**
 * The autosave indicator.
 *
 * A failure is a **persistent banner**, never a toast. A notice that disappears after four
 * seconds is how a user loses an evening of character building: it goes away while they are
 * looking at the field they were editing, and they carry on typing into a sheet that is no longer
 * being saved. That is why this is a shadcn `Alert` and not `sonner`.
 *
 * The quiet state overrides the `Alert` primitive's built-in `role="alert"` with `role="status"`:
 * "Saving…" is not an interruption, and a live region that assertive would talk over the user
 * every two seconds while they type.
 */
import type { SaveState } from "../hooks/useSheet";
import { useT, type TranslationKey } from "../i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Props {
  state: SaveState;
  onRetry: () => void;
}

/** What a failed save means, said in terms the user can act on rather than in a status code. */
function reasonKey(state: Extract<SaveState, { status: "failed" }>): TranslationKey {
  if (state.conflict) return "save.conflict";
  if (state.httpStatus === null) return "error.unreachable";
  return state.httpStatus >= 500 ? "error.server" : "error.generic";
}

const QUIET: Record<Exclude<SaveState["status"], "failed">, TranslationKey> = {
  saved: "save.saved",
  pending: "save.pending",
  saving: "save.saving",
};

export function SaveBanner({ state, onRetry }: Props) {
  const t = useT();

  if (state.status === "failed") {
    return (
      <Alert variant="destructive" className="mb-3 border-destructive bg-danger-soft">
        <AlertTitle>{t("save.failed")}</AlertTitle>
        <AlertDescription>
          {t(reasonKey(state))}
          <Button type="button" size="sm" className="mt-1" onClick={onRetry}>
            {t("save.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  /*
   * The quiet states are drawn by `DerivedRail`, not here.
   *
   * "All changes saved" as a full-width `Alert` was a band of panel colour across the top of the
   * sheet saying that nothing had happened — a row of the reader's screen spent on the absence of
   * news, above the fields they came for. In the rail it is one line at the foot of a region they
   * are already watching. A **failure** stays here and stays an `Alert`, because that is the one
   * save state a user must not be able to scroll past.
   */
  return null;
}

/** The quiet states, for the rail. Failures are `SaveBanner`'s and are not returned here. */
export function quietSaveKey(state: SaveState): TranslationKey | null {
  return state.status === "failed" ? null : QUIET[state.status];
}
