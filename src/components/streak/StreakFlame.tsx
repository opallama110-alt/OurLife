import React, { memo, useLayoutEffect, useRef } from 'react';
import { crossedMilestone, flameLevel, LEGEND_STREAK_DAYS } from '../../constants/streak';
import { useInViewPause } from '../../hooks/useInViewPause';
import { prefersReducedMotion } from '../../hooks/usePresence';

// ─────────────────────────────────────────────────────────────────────────
// StreakFlame — the one flame used by every streak surface.
//
// Three stacked mini SVGs (outer / inner / core). Each is its own HTML box,
// so their flicker transforms stay on the compositor (transforms on SVG
// *children* repaint on the main thread). The flame's size, colour, speed
// and embers encode the streak tier (see constants/streak.ts):
//   0 cold ash · 1-2d spark · 3-6d flame · 7-13d blaze · 14-29d inferno ·
//   30d+ System-blue fire · 100d+ Monarch purple/gold.
// `atRisk` (streak alive but today not done yet) dims and slows it;
// `frozen` renders the icy streak-freeze variant.
//
// When `streak` goes UP after mount, a one-shot burst plays (flare + ring +
// sparks, via WAAPI, zero React state per frame); crossing a milestone
// (7/30/100/365) makes it bigger. Reduced motion skips the burst, and the
// flicker pauses while off screen.
// ─────────────────────────────────────────────────────────────────────────

const OUTER = 'M12 1.8c.7 3.2 2.9 5 4.7 7.1 1.7 2 2.9 4 2.9 6.6 0 4-3.3 7-7.6 7S4.4 19.5 4.4 15.6c0-2.5 1.1-4.4 2.7-5.9.2 1.6 1 2.8 2.2 3.4-.4-3.8 1.1-8 2.7-11.3z';
const INNER = 'M12.3 9.2c.4 2.1 1.9 3.2 2.9 4.7.7 1 1.1 2.1 1.1 3.3 0 2.6-2 4.5-4.4 4.5s-4.3-1.8-4.3-4.4c0-1.4.6-2.7 1.6-3.6.2 1 .7 1.7 1.4 2.1-.2-2.4.6-4.6 1.7-6.6z';
const CORE = 'M12.1 14.4c.3 1.2 1.2 1.9 1.8 2.8.3.5.5 1 .5 1.6 0 1.4-1.1 2.4-2.3 2.4S9.8 20.2 9.8 19c0-.9.4-1.7 1.1-2.3.1.5.4.9.8 1.1-.1-1.2.1-2.3.4-3.4z';

export interface StreakFlameProps {
  streak: number;
  /** Rendered box size in px. */
  size?: number;
  /** Streak alive but today's check-in not done yet. */
  atRisk?: boolean;
  /** Icy streak-freeze variant (token used). */
  frozen?: boolean;
  /** Play the burst when the streak increases. Turn off inside overflow-hidden cards. */
  celebrate?: boolean;
  /** Flicker phase offset in ms so sibling flames don't pulse in lockstep. */
  phase?: number;
  className?: string;
}

/** One-shot celebration burst. DOM-only; nodes remove themselves. */
export function playStreakBurst(root: HTMLElement, size: number, milestone: number | null): void {
  if (typeof root.animate !== 'function') return;
  const big = milestone != null && milestone >= 7;
  const spring = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const expo = 'cubic-bezier(0.16, 1, 0.3, 1)';

  root.querySelector<HTMLElement>('.sf-pop')?.animate(
    [
      { transform: 'scale(1)' },
      { transform: `translateY(-12%) scale(${big ? 1.75 : 1.45})`, offset: 0.35 },
      { transform: 'scale(1)' },
    ],
    { duration: big ? 680 : 500, easing: spring },
  );

  const ring = document.createElement('i');
  ring.className = 'sf-ring';
  root.appendChild(ring);
  ring.animate(
    [{ opacity: 0.95, transform: 'scale(0.5)' }, { opacity: 0, transform: `scale(${big ? 3.4 : 2.4})` }],
    { duration: big ? 780 : 540, easing: expo },
  ).onfinish = () => ring.remove();

  const n = big ? 9 : 6;
  for (let i = 0; i < n; i++) {
    // Fan the sparks upward (flames rise), with a little per-spark jitter.
    const angle = -Math.PI / 2 + (i - (n - 1) / 2) * (big ? 0.42 : 0.48);
    const dist = size * (big ? 1.9 : 1.35) * (0.8 + ((i * 37) % 10) / 25);
    const spark = document.createElement('i');
    spark.className = 'sf-spark';
    root.appendChild(spark);
    spark.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${(Math.cos(angle) * dist).toFixed(1)}px, ${(Math.sin(angle) * dist).toFixed(1)}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 480 + ((i * 53) % 220), easing: expo },
    ).onfinish = () => spark.remove();
  }

  try { navigator.vibrate?.(big ? [12, 40, 20] : 8); } catch { /* vibration unsupported */ }
}

export const StreakFlame = memo(function StreakFlame({
  streak,
  size = 14,
  atRisk = false,
  frozen = false,
  celebrate = true,
  phase = 0,
  className = '',
}: StreakFlameProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(streak);
  useInViewPause(ref);

  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = streak;
    if (!celebrate || streak <= from || !ref.current || prefersReducedMotion()) return;
    playStreakBurst(ref.current, size, crossedMilestone(from, streak));
  }, [streak, celebrate, size]);

  const lvl = flameLevel(streak);
  const cls = [
    'sf',
    `sf-l${lvl}`,
    streak >= LEGEND_STREAK_DAYS ? 'sf-legend' : '',
    atRisk && lvl > 0 ? 'is-risk' : '',
    frozen ? 'is-frozen' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span
      ref={ref}
      className={cls}
      aria-hidden="true"
      style={{ '--sf-size': `${size}px`, '--sf-phase': `${-(phase % 1500)}ms` } as React.CSSProperties}
    >
      <span className="sf-glow" />
      <span className="sf-pop">
        <svg className="sf-layer sf-outer" viewBox="0 0 24 24"><path d={OUTER} /></svg>
        <svg className="sf-layer sf-inner" viewBox="0 0 24 24"><path d={INNER} /></svg>
        <svg className="sf-layer sf-core" viewBox="0 0 24 24"><path d={CORE} /></svg>
      </span>
      {lvl >= 3 && <i className="sf-ember e1" />}
      {lvl >= 4 && <i className="sf-ember e2" />}
      {lvl >= 5 && <i className="sf-ember e3" />}
    </span>
  );
});

export default StreakFlame;
