import { CSSProperties } from 'react';

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
 */
export default function DotPulse({ tone = 'cyan', className = '' }: DotPulseProps) {
  const style: CSSProperties = { color: TONE_COLOR[tone] };
  return <span className={`dot-pulse ${className}`.trim()} style={style} aria-hidden={true} />;
}
