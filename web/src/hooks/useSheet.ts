/**
 * The sheet's editing loop.
 *
 * The draft lives in React state — the one deliberate exception to TanStack Query owning server
 * state, because the user is typing into it many times a second. Two independent debounces hang
 * off it:
 *
 *   250 ms → POST /api/derive   recomputes every derived number, persists nothing
 *     2 s  → PATCH /api/characters/{id}   persists, and bumps `version`
 *
 * A failed save raises a persistent banner and never a toast. A notice that disappears after four
 * seconds is how a user loses an evening of character building.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import type { CharacterBody, CharacterRead, DerivedSheet } from "../api/types";
import { useDebounced } from "./useDebounced";

export const DERIVE_DEBOUNCE_MS = 250;
export const SAVE_DEBOUNCE_MS = 2000;

export type SaveState =
  | { status: "saved" }
  | { status: "pending" }
  | { status: "saving" }
  | { status: "failed"; message: string; conflict: boolean };

/** The stored fields, without the ones the server owns. */
export function draftOf(character: CharacterRead): CharacterBody {
  const { id: _id, version: _version, created_at: _c, updated_at: _u, ...body } = character;
  return body;
}

export interface Sheet {
  draft: CharacterBody;
  derived: DerivedSheet;
  version: number;
  save: SaveState;
  /** Apply a change to the draft. Triggers both debounces. */
  update: (changes: Partial<CharacterBody>) => void;
  /** Save now rather than waiting out the 2 s window. */
  saveNow: () => void;
}

export function useSheet(
  characterId: string,
  initial: CharacterRead,
  initialDerived: DerivedSheet,
): Sheet {
  const [draft, setDraft] = useState<CharacterBody>(() => draftOf(initial));
  const [derived, setDerived] = useState<DerivedSheet>(initialDerived);
  const [version, setVersion] = useState(initial.version);
  const [save, setSave] = useState<SaveState>({ status: "saved" });

  /**
   * Bumped on every edit. Both debounces watch this counter rather than the draft itself.
   *
   * Debouncing the draft object directly does not work: a fresh object is allocated on every
   * render, so its identity always differs, the recompute effect re-fires forever, and each
   * re-render restarts the two-second save timer — which then never completes. A counter is
   * stable between edits, and it still fires when a value is typed back to what it was.
   */
  const [edits, setEdits] = useState(0);

  const deriveTick = useDebounced(edits, DERIVE_DEBOUNCE_MS);
  const saveTick = useDebounced(edits, SAVE_DEBOUNCE_MS);

  // The effects below read the draft through a ref, so they are triggered by the tick alone.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const versionRef = useRef(version);
  versionRef.current = version;

  const update = useCallback((changes: Partial<CharacterBody>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setEdits((n) => n + 1);
    setSave((current) => (current.status === "failed" ? current : { status: "pending" }));
  }, []);

  // Recompute. Stateless, no database on the server side, and the response replaces every
  // derived number on screen at once.
  useEffect(() => {
    if (deriveTick === 0) return;
    let cancelled = false;
    api
      .derive(draftRef.current)
      .then((sheet) => {
        if (!cancelled) setDerived(sheet);
      })
      .catch(() => {
        /* The last good sheet stays on screen; the save banner reports real trouble. */
      });
    return () => {
      cancelled = true;
    };
  }, [deriveTick]);

  const persist = useCallback(
    async (body: CharacterBody) => {
      setSave({ status: "saving" });
      try {
        const result = await api.patchCharacter(characterId, {
          ...body,
          version: versionRef.current,
        });
        setVersion(result.character.version);
        setDerived(result.derived);
        setSave({ status: "saved" });
      } catch (error) {
        const failure = error instanceof ApiError ? error : null;
        setSave({
          status: "failed",
          conflict: failure?.isVersionConflict ?? false,
          message:
            failure?.isVersionConflict === true
              ? "This character was changed in another tab or window. Reload to see the current version before saving again — your edits here are still on screen."
              : (failure?.message ?? "Could not reach the server."),
        });
      }
    },
    [characterId],
  );

  useEffect(() => {
    if (saveTick === 0) return;
    void persist(draftRef.current);
  }, [saveTick, persist]);

  const saveNow = useCallback(() => {
    void persist(draftRef.current);
  }, [persist]);

  return useMemo(
    () => ({ draft, derived, version, save, update, saveNow }),
    [draft, derived, version, save, update, saveNow],
  );
}
