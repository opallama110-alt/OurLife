import { CSSProperties, useRef } from 'react';
import { useInViewPause } from '../../hooks/useInViewPause';

export interface DotPulseProps {
  tone?: 'cyan' | 'red' | 'green' | 'orange';
  className?: string;
}

const TONE_COLOR: Record<NonNullable<DotPulseProps['tone']>, string> = {
  cyan: 'var(--cyan)',
  red: 'var(--red)',
  green: 'var(--green-bright)',
  orange: 'var(--orange)',
};

/**
 * Pulsing dot indicator (REC / LIVE feel). The `.dot-pulse` class uses
 * `currentColor` for fill and glow, so tone is applied via inline
 * `color`. Decorative — `aria-hidden` so screen readers skip it.
 * The infinite pulse pauses while the dot is off screen (e.g. a sheet
 * sliding away) via the shared IntersectionObserver.
 */
export default function DotPulse({ tone = 'cyan', className = '' }: DotPulseProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useInViewPause(ref);
  const style: CSSProperties = { color: TONE_COLOR[tone] };
  return <span ref={ref} className={`dot-pulse ${className}`.trim()} style={style} aria-hidden={true} />;
}
