import { useEffect, useRef, useState } from "react";

/**
 * A value that settles `delay` milliseconds after the last change.
 *
 * The sheet uses two of these at different delays and they must stay separate. Recomputation is
 * 250 ms, because AC, initiative, the Reflex save, and every Dexterity-keyed skill have to move
 * while the user is still looking at the field they changed. Persistence is 2 s, because a write
 * per keystroke is a write per keystroke. Merging them makes one of the two wrong.
 */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

/** The previous render's value, or `undefined` on the first render. */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
