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

const TONE_GLOW: Record<NonNullable<CornerBracketProps['tone']>, string> = {
  cyan: 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.5))',
  orange: 'drop-shadow(0 0 4px rgba(251, 146, 60, 0.5))',
  red: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))',
  green: 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.5))',
};

/**
 * Wraps children with 4 L-shaped HUD corner brackets.
 *
 * Per CLAUDE.md §6.8: do NOT apply to elements (or parents) with
 * `transform-style: preserve-3d`. The corner glyph's drop-shadow filter
 * flattens the 3D context — e.g. the Muscle Recovery body flip card.
 */
export default function CornerBracket({
  children,
  className = '',
  tone = 'cyan',
  size,
  inset,
}: CornerBracketProps) {
  const cornerStyle: CSSProperties = {
    borderColor: TONE_COLOR[tone],
    filter: TONE_GLOW[tone],
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
