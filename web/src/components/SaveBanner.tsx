/**
 * The autosave indicator.
 *
 * A failure is a **persistent banner**, never a toast. A notice that disappears after four
 * seconds is how a user loses an evening of character building: it goes away while they are
 * looking at the field they were editing, and they carry on typing into a sheet that is no longer
 * being saved.
 */
import type { SaveState } from "../hooks/useSheet";

interface Props {
  state: SaveState;
  onRetry: () => void;
}

export function SaveBanner({ state, onRetry }: Props) {
  if (state.status === "failed") {
    return (
      <div className="banner banner--error" role="alert">
        <strong>Your changes are not saved.</strong>
        <span>{state.message}</span>
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  const text: Record<Exclude<SaveState["status"], "failed">, string> = {
    saved: "All changes saved",
    pending: "Unsaved changes",
    saving: "Saving…",
  };

  return (
    <div className="banner banner--quiet" role="status">
      {text[state.status]}
    </div>
  );
}
