import { ReactNode, CSSProperties } from 'react';
import HudLabel from './HudLabel';

export interface StatChipProps {
  label: string;
  value: ReactNode;
  tone?: 'cyan' | 'orange' | 'gold';
  icon?: ReactNode;
  className?: string;
}

const TONE_COLOR: Record<NonNullable<StatChipProps['tone']>, string> = {
  cyan: 'var(--cyan)',
  orange: 'var(--xp-2)',
  gold: 'var(--gold)',
};

/**
 * Small HUD chip with a monospaced label and a coloured value, framed
 * by the `.hud-glass` surface. Used for compact stat displays
 * such as "XP 1,316", "RANK E", or "STREAK 12".
 */
export default function StatChip({
  label,
  value,
  tone = 'cyan',
  icon,
  className = '',
}: StatChipProps) {
  const valueStyle: CSSProperties = {
    color: TONE_COLOR[tone],
    fontWeight: 700,
  };
  return (
    <div
      className={`hud-glass inline-flex items-center gap-2 px-3 py-1.5 ${className}`.trim()}
      style={{ borderRadius: 'var(--r-2)' }}
    >
      {icon ? (
        <span className="flex items-center" aria-hidden={true}>
          {icon}
        </span>
      ) : null}
      <HudLabel size="sm">{label}</HudLabel>
      <span style={valueStyle} className="tabular-nums">
        {value}
      </span>
    </div>
  );
}
