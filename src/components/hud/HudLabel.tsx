import { ReactNode, CSSProperties } from 'react';

export interface HudLabelProps {
  children: ReactNode;
  size?: 'sm' | 'md';
  tone?: 'default' | 'cyan' | 'orange' | 'green';
  className?: string;
}

const TONE_COLOR: Record<NonNullable<HudLabelProps['tone']>, string | undefined> = {
  default: undefined,
  cyan: 'var(--cyan)',
  orange: 'var(--orange)',
  green: 'var(--green-bright)',
};

/**
 * Monospaced uppercase HUD label. Uses `.hud-label` (md, default) or
 * `.hud-label-sm` (sm) from index.css. Tone overrides the class's
 * default text color via inline style; `default` keeps the class color.
 */
export default function HudLabel({
  children,
  size = 'md',
  tone = 'default',
  className = '',
}: HudLabelProps) {
  const baseClass = size === 'sm' ? 'hud-label-sm' : 'hud-label';
  const color = TONE_COLOR[tone];
  const style: CSSProperties | undefined = color ? { color } : undefined;
  return (
    <span className={`${baseClass} ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}
