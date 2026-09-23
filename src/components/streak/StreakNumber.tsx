import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../hooks/usePresence';

// Odometer-style number: when `value` changes the old digits roll out and
// the new ones roll in (up for increases, down for decreases). One state
// update per change — never per frame — so it's safe inside pages that
// re-render every second.
export const StreakNumber = memo(function StreakNumber({ value, className = '' }: { value: number; className?: string }) {
  const prev = useRef(value);
  const key = useRef(0);
  const [ghost, setGhost] = useState<{ from: number; up: boolean } | null>(null);

  useLayoutEffect(() => {
    if (value === prev.current) return;
    const from = prev.current;
    prev.current = value;
    key.current += 1;
    if (!prefersReducedMotion()) setGhost({ from, up: value > from });
  }, [value]);

  // Safety net: animationend never fires if the tab is backgrounded mid-roll
  // or an ancestor disables animations — never leave the old digits stuck.
  useEffect(() => {
    if (!ghost) return;
    const t = window.setTimeout(() => setGhost(null), 700);
    return () => window.clearTimeout(t);
  }, [ghost]);

  return (
    <span className={`sn tnum ${ghost ? (ghost.up ? 'is-up' : 'is-down') : ''} ${className}`.trim()}>
      {ghost && (
        <span className="sn-old" aria-hidden="true" onAnimationEnd={() => setGhost(null)}>{ghost.from}</span>
      )}
      <span key={key.current} className="sn-new">{value}</span>
    </span>
  );
});

export default StreakNumber;
