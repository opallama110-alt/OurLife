import { ReactNode, CSSProperties } from 'react';

export interface CornerBracketProps {
  children: ReactNode;
  className?: string;
  tone?: 'cyan' | 'orange' | 'red' | 'green';
  size?: number;
  inset?: number;
}

const TONE_COLOR: Record<NonNullable<CornerBracketProps['tone']>, string> = {
  cyan: 'var(--cyan)',
  orange: 'var(--orange)',
  red: 'var(--red)',
  green: 'var(--green-bright)',
};

/** Glow colour for the bars' box-shadow (read by `.brk > .brk-c::before/::after`). */
const TONE_GLOW: Record<NonNullable<CornerBracketProps['tone']>, string> = {
  cyan: 'rgba(34, 211, 238, 0.5)',
  orange: 'rgba(251, 146, 60, 0.5)',
  red: 'rgba(239, 68, 68, 0.5)',
  green: 'rgba(52, 211, 153, 0.5)',
};

type CornerStyle = CSSProperties & { '--brk-glow'?: string };

/**
 * Wraps children with 4 L-shaped HUD corner brackets.
 *
 * Each corner is drawn with two pseudo-element bars + box-shadow glow (see
 * `.brk` in index.css) instead of a border + `filter: drop-shadow`: four
 * filters per card meant four offscreen passes, and a filter on the ancestor
 * chain of a `preserve-3d` element flattens it (§5.3). The corners are
 * siblings of the children, never ancestors, and carry no filter, so the
 * wrapper may frame the body turntable safely.
 */
export default function CornerBracket({
  children,
  className = '',
  tone = 'cyan',
  size,
  inset,
}: CornerBracketProps) {
  const cornerStyle: CornerStyle = {
    color: TONE_COLOR[tone],
    '--brk-glow': TONE_GLOW[tone],
    ...(size !== undefined ? { width: size, height: size } : null),
  };

  const positionStyle = (corner: 'tl' | 'tr' | 'bl' | 'br'): CSSProperties => {
    if (inset === undefined) return {};
    const i = `${inset}px`;
    if (corner === 'tl') return { top: i, left: i };
    if (corner === 'tr') return { top: i, right: i };
    if (corner === 'bl') return { bottom: i, left: i };
    return { bottom: i, right: i };
  };

  return (
    <div className={`brk relative ${className}`.trim()}>
      {children}
      <span
        className="brk-c brk-tl"
        style={{ ...cornerStyle, ...positionStyle('tl') }}
        aria-hidden={true}
      />
      <span
        className="brk-c brk-tr"
        style={{ ...cornerStyle, ...positionStyle('tr') }}
        aria-hidden={true}
      />
      <span
        className="brk-c brk-bl"
        style={{ ...cornerStyle, ...positionStyle('bl') }}
        aria-hidden={true}
      />
      <span
        className="brk-c brk-br"
        style={{ ...cornerStyle, ...positionStyle('br') }}
        aria-hidden={true}
      />
    </div>
  );
}
