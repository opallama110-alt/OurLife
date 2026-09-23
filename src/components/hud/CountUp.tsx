import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../hooks/usePresence';

// ─────────────────────────────────────────────────────────────────────────
// CountUp — a number that ticks to its value instead of popping in.
//
// Counts from 0 on first mount (optional) and from the previous value on
// every change. The rAF loop writes `textContent` directly, so a page that
// re-renders every second (Dashboard) never re-renders per frame, and a
// re-render with the same value never restarts the count. Reduced motion
// (or a tiny delta) renders the final value immediately.
// ─────────────────────────────────────────────────────────────────────────

export interface CountUpProps {
  value: number;
  /** ms for a full count; small deltas finish faster. */
  duration?: number;
  /** Count from 0 on first mount. Default true. */
  fromZero?: boolean;
  /** Decimal places to show while counting and at rest. */
  decimals?: number;
  /** Custom formatter (e.g. v => v.toLocaleString('id-ID')). */
  format?: (v: number) => string;
  className?: string;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const CountUp = memo(function CountUp({
  value,
  duration = 900,
  fromZero = true,
  decimals = 0,
  format,
  className = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const shownRef = useRef<number>(fromZero ? 0 : value);
  const rafRef = useRef(0);

  // Held in a ref so an inline `format` arrow (new every render) doesn't
  // restart the count on unrelated re-renders.
  const formatRef = useRef(format);
  formatRef.current = format;
  const fmt = (v: number) => (formatRef.current ? formatRef.current(v) : v.toFixed(decimals));

  // React never owns the text node (it would fight the rAF writes); paint
  // the starting value before first paint instead.
  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = fmt(shownRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(rafRef.current);
    const from = shownRef.current;
    const to = Number.isFinite(value) ? value : 0;
    if (from === to || prefersReducedMotion() || Math.abs(to - from) < Math.pow(10, -decimals)) {
      shownRef.current = to;
      el.textContent = fmt(to);
      return;
    }
    // Scale duration with the size of the jump so +1 doesn't crawl.
    const span = Math.min(1, Math.abs(to - from) / Math.max(1, Math.abs(to)) + 0.35);
    const dur = duration * span;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const v = from + (to - from) * easeOutExpo(t);
      shownRef.current = t >= 1 ? to : v;
      el.textContent = fmt(t >= 1 ? to : Number(v.toFixed(decimals)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // `fmt` reads the latest formatter through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, decimals]);

  return <span ref={ref} className={`tnum ${className}`.trim()} />;
});

export default CountUp;
