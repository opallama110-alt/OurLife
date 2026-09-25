import { useEffect, useState } from 'react';

export type PresenceState = 'enter' | 'exit';

const prefersReducedMotion = (): boolean => {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Keeps an overlay (modal, sheet, toast) mounted long enough to play its exit
 * animation instead of vanishing the instant `open` flips false.
 *
 * Usage:
 *   const { mounted, state } = usePresence(open, 220);
 *   if (!mounted) return null;
 *   return <div className="my-modal" data-state={state}>…</div>;
 *
 * CSS keys the enter/exit keyframes off `[data-state="enter"|"exit"]`.
 * `exitMs` must match (or slightly exceed) the CSS exit duration. Under
 * prefers-reduced-motion the exit is skipped so nothing lingers.
 */
export function usePresence(open: boolean, exitMs = 220): { mounted: boolean; state: PresenceState } {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<PresenceState>('enter');

  useEffect(() => {
    if (open) {
      setMounted(true);
      setState('enter');
      return;
    }
    if (!mounted) return;
    setState('exit');
    const delay = prefersReducedMotion() ? 0 : exitMs;
    const t = window.setTimeout(() => setMounted(false), delay);
    return () => window.clearTimeout(t);
    // `mounted` is intentionally read but not a dependency: re-running when it
    // flips false would be a no-op, and depending on it would restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exitMs]);

  return { mounted, state };
}

export { prefersReducedMotion };
