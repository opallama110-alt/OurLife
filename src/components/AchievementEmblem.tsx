import React from 'react';

// ═══════════════════════════════════════════════════════════════
// AchievementEmblem — hex/shield-framed crafted emblem with tier
// evolution (Bronze → Silver → Gold → Platinum → Mythic).
// Ported from prototype components/AchievementEmblem.jsx.
// Animations (halo pulse, ring spin, shimmer) are driven by CSS.
// ═══════════════════════════════════════════════════════════════

export type EmblemTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'mythic';
export type EmblemCategory =
  | 'workout' | 'streak' | 'rank' | 'habit'
  | 'volume' | 'time' | 'body' | 'xp' | 'special' | 'social';

export const TIER_THEMES: Record<EmblemTier, {
  primary: string; secondary: string; glow: string; name: string; xpMult: number;
}> = {
  bronze:   { primary: '#CD7F32', secondary: '#F0A77B', glow: 'rgba(205,127,50,0.55)',  name: 'Bronze',   xpMult: 1 },
  silver:   { primary: '#94A3B8', secondary: '#E2E8F0', glow: 'rgba(226,232,240,0.55)', name: 'Silver',   xpMult: 2 },
  gold:     { primary: '#F5C518', secondary: '#FBBF24', glow: 'rgba(245,197,24,0.6)',   name: 'Gold',     xpMult: 4 },
  platinum: { primary: '#67E8F9', secondary: '#A5F3FC', glow: 'rgba(103,232,249,0.6)',  name: 'Platinum', xpMult: 8 },
  mythic:   { primary: '#A855F7', secondary: '#F0ABFC', glow: 'rgba(168,85,247,0.65)',  name: 'Mythic',   xpMult: 16 },
};

// Catalog category → glyph name lookup. Categories not in the prototype
// (xp, special) fall back to the closest visual analog.
const CATEGORY_GLYPHS: Record<EmblemCategory, string> = {
  workout: 'dumbbell',
  streak:  'flame',
  rank:    'crown',
  habit:   'check',
  volume:  'bolt',
  time:    'clock',
  body:    'body',
  xp:      'bolt',
  special: 'crown',
  social:  'group',
};

const EmblemGlyph: React.FC<{ glyph: string; size: number; color: string }> = ({ glyph, size, color }) => {
  const half = size / 2;
  const props = { stroke: color, strokeWidth: 1.6, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (glyph === 'dumbbell') return (
    <g {...props}>
      <path d={`M${half - 7} ${half - 4} V${half + 4} M${half + 7} ${half - 4} V${half + 4} M${half - 5} ${half - 6} V${half + 6} M${half + 5} ${half - 6} V${half + 6} M${half - 5} ${half} H${half + 5}`} />
    </g>
  );
  if (glyph === 'flame') return (
    <g fill={color}>
      <path d={`M${half} ${half - 7} Q${half + 3} ${half - 3} ${half + 3} ${half + 1} Q${half + 5} ${half + 3} ${half + 5} ${half + 5} Q${half + 5} ${half + 8} ${half} ${half + 9} Q${half - 5} ${half + 8} ${half - 5} ${half + 5} Q${half - 5} ${half + 3} ${half - 3} ${half + 1} Q${half - 2} ${half - 3} ${half} ${half - 7} Z`} />
    </g>
  );
  if (glyph === 'crown') return (
    <g fill={color}>
      <path d={`M${half - 7} ${half + 2} L${half - 5} ${half - 5} L${half - 2} ${half} L${half} ${half - 6} L${half + 2} ${half} L${half + 5} ${half - 5} L${half + 7} ${half + 2} L${half + 5} ${half + 5} L${half - 5} ${half + 5} Z`} />
    </g>
  );
  if (glyph === 'check') return (
    <g {...props} strokeWidth="2">
      <path d={`M${half - 5} ${half} L${half - 1} ${half + 4} L${half + 6} ${half - 4}`} />
    </g>
  );
  if (glyph === 'bolt') return (
    <g fill={color}>
      <path d={`M${half + 1} ${half - 7} L${half - 4} ${half + 1} L${half} ${half + 1} L${half - 1} ${half + 7} L${half + 5} ${half - 2} L${half + 1} ${half - 2} Z`} />
    </g>
  );
  if (glyph === 'clock') return (
    <g {...props}>
      <circle cx={half} cy={half} r="6" />
      <path d={`M${half} ${half - 3} L${half} ${half} L${half + 3} ${half + 2}`} />
    </g>
  );
  if (glyph === 'body') return (
    <g {...props}>
      <circle cx={half} cy={half - 4} r="2" />
      <path d={`M${half - 4} ${half} Q${half} ${half - 2} ${half + 4} ${half} L${half + 3} ${half + 6} L${half - 3} ${half + 6} Z`} />
    </g>
  );
  if (glyph === 'group') return (
    <g {...props}>
      <circle cx={half - 3} cy={half - 2} r="2" />
      <circle cx={half + 3} cy={half - 2} r="2" />
      <path d={`M${half - 6} ${half + 4} Q${half - 3} ${half + 2} ${half} ${half + 4} Q${half + 3} ${half + 2} ${half + 6} ${half + 4}`} />
    </g>
  );
  return null;
};

interface Props {
  category?: EmblemCategory;
  tier?: EmblemTier;
  size?: number;
  locked?: boolean;
  /** Index 0..4 of the highest tier reached; -1 means none yet (locked). */
  currentTier?: number;
}

export const AchievementEmblem: React.FC<Props> = ({
  category = 'workout', tier = 'bronze', size = 56, locked = false, currentTier = 0,
}) => {
  const theme = TIER_THEMES[tier];
  const glyph = CATEGORY_GLYPHS[category] || 'dumbbell';
  const half = size / 2;

  const hex: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 - 30) * Math.PI / 180;
    const r = size * 0.42;
    hex.push(`${(half + Math.cos(a) * r).toFixed(2)},${(half + Math.sin(a) * r).toFixed(2)}`);
  }

  const bgId = `ae-bg-${tier}-${category}-${size}`;
  const strokeId = `ae-stroke-${tier}-${category}-${size}`;

  return (
    <div className={`ae-emblem ${locked ? 'is-locked' : ''} tier-${tier}`}
      style={{
        width: size, height: size,
        ['--ae-primary' as string]: theme.primary,
        ['--ae-secondary' as string]: theme.secondary,
        ['--ae-glow' as string]: theme.glow,
      }}>
      <span className="ae-halo" />
      <span className="ae-ring" />
      <svg className="ae-svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <radialGradient id={bgId} cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor={theme.primary} stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0A0E1A" stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id={strokeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.secondary} />
            <stop offset="100%" stopColor={theme.primary} />
          </linearGradient>
        </defs>
        <polygon points={hex.join(' ')}
          fill={`url(#${bgId})`}
          stroke={`url(#${strokeId})`}
          strokeWidth="1.5" />
        <EmblemGlyph glyph={glyph} size={size} color={locked ? '#475569' : theme.secondary} />
        {/* Tier dots */}
        <g transform={`translate(${half - 9}, ${size * 0.86})`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i}
              cx={i * 4.5} cy="0"
              r={i <= currentTier ? 1.6 : 0.8}
              fill={i <= currentTier ? theme.secondary : 'rgba(148, 163, 184, 0.3)'}
              filter={i <= currentTier ? `drop-shadow(0 0 2px ${theme.primary})` : undefined} />
          ))}
        </g>
      </svg>
      <span className="ae-shimmer" />
      {locked && (
        <span className="ae-lock-overlay">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 11 V8 Q8 4 12 4 Q16 4 16 8 V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </div>
  );
};

const RARITY_TO_TIER: Record<string, EmblemTier> = {
  iron: 'bronze',
  bronze: 'bronze',
  silver: 'silver',
  purple: 'platinum',
  gold: 'gold',
  legendary: 'gold',
  mythic: 'mythic',
};

/** Map a gamificationService rarity string to a tier theme. */
export const tierFromRarity = (rarity: string): EmblemTier =>
  RARITY_TO_TIER[rarity] || 'bronze';
