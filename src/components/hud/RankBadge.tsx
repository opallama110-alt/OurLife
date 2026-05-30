import { CSSProperties } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// RankBadge — hex-framed sci-fi HUD emblem with per-rank color identity,
// inner glyph, and layered idle/current animations. Pure CSS animation,
// SVG-only render (no external icons or images).
// ─────────────────────────────────────────────────────────────────────────

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'National';
export type RankBadgeSize = 'sm' | 'md' | 'lg';
export type RankBadgeVariant = 'compact' | 'full';

export interface RankTheme {
    label: string;
    name: string;
    range: string;
    primary: string;
    secondary: string;
    glow: string;
}

export const RANK_THEMES: Record<Rank, RankTheme> = {
    E:        { label: 'E', name: 'E-Rank',         range: 'Lv.1 — Lv.5',   primary: '#FB923C', secondary: '#FBBF24', glow: 'rgba(251, 146, 60, 0.55)' },
    D:        { label: 'D', name: 'D-Rank',         range: 'Lv.6 — Lv.10',  primary: '#22D3EE', secondary: '#67E8F9', glow: 'rgba(34, 211, 238, 0.50)' },
    C:        { label: 'C', name: 'C-Rank',         range: 'Lv.11 — Lv.20', primary: '#10B981', secondary: '#34D399', glow: 'rgba(16, 185, 129, 0.50)' },
    B:        { label: 'B', name: 'B-Rank',         range: 'Lv.21 — Lv.35', primary: '#3B82F6', secondary: '#60A5FA', glow: 'rgba(59, 130, 246, 0.50)' },
    A:        { label: 'A', name: 'A-Rank',         range: 'Lv.36 — Lv.50', primary: '#A78BFA', secondary: '#C4B5FD', glow: 'rgba(167, 139, 250, 0.50)' },
    S:        { label: 'S', name: 'S-Rank',         range: 'Lv.51 — Lv.75', primary: '#F5C518', secondary: '#FBBF24', glow: 'rgba(245, 197, 24, 0.55)' },
    National: { label: '☀', name: 'National Hunter', range: 'Lv.76 — ∞',    primary: '#EF4444', secondary: '#F5C518', glow: 'rgba(239, 68, 68, 0.55)' },
};

const SIZE_PX: Record<RankBadgeSize, number> = { sm: 32, md: 44, lg: 64 };

// Maps gamificationService RankTier.name → RankBadge.rank prop.
export const rankFromTierName = (name: string): Rank => {
    if (name === 'National Level Hunter') return 'National';
    const first = name.charAt(0) as Rank;
    return (['E', 'D', 'C', 'B', 'A', 'S'] as const).includes(first as Exclude<Rank, 'National'>)
        ? first
        : 'E';
};

// Inner glyph — unique geometric motif per rank, drawn over the hex frame.
function RankInner({ rank, size }: { rank: Rank; size: number }) {
    const cx = size / 2;
    const cy = size / 2;

    if (rank === 'E') {
        return (
            <path
                d={`M${cx - 6} ${cy + 5} L${cx} ${cy - 6} L${cx + 6} ${cy + 5} Z`}
                fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
            />
        );
    }
    if (rank === 'D') {
        return (
            <path
                d={`M${cx} ${cy - 6} L${cx + 5} ${cy} L${cx} ${cy + 6} L${cx - 5} ${cy} Z`}
                fill="none" stroke="currentColor" strokeWidth="1.2"
            />
        );
    }
    if (rank === 'C') {
        return (
            <g>
                <path
                    d={`M${cx - 6} ${cy - 4} L${cx + 6} ${cy - 4} L${cx} ${cy + 6} Z`}
                    fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
                />
                <circle cx={cx} cy={cy + 2} r="1.5" fill="currentColor" />
            </g>
        );
    }
    if (rank === 'B') {
        return (
            <path
                d={`M${cx - 6} ${cy - 4} L${cx} ${cy - 7} L${cx + 6} ${cy - 4} L${cx + 6} ${cy + 4} L${cx} ${cy + 7} L${cx - 6} ${cy + 4} Z`}
                fill="none" stroke="currentColor" strokeWidth="1"
            />
        );
    }
    if (rank === 'A') {
        const r = 7;
        return (
            <g>
                {[0, 72, 144, 216, 288].map((deg, i) => {
                    const rad = (deg - 90) * Math.PI / 180;
                    return (
                        <line
                            key={i}
                            x1={cx} y1={cy}
                            x2={cx + Math.cos(rad) * r}
                            y2={cy + Math.sin(rad) * r}
                            stroke="currentColor" strokeWidth="1"
                        />
                    );
                })}
                <circle cx={cx} cy={cy} r="2.5" fill="currentColor" />
            </g>
        );
    }
    if (rank === 'S') {
        return (
            <path
                d={`M${cx} ${cy - 7} L${cx + 2} ${cy - 2} L${cx + 7} ${cy - 1} L${cx + 3} ${cy + 2} L${cx + 4} ${cy + 7}
                    L${cx} ${cy + 4} L${cx - 4} ${cy + 7} L${cx - 3} ${cy + 2} L${cx - 7} ${cy - 1} L${cx - 2} ${cy - 2} Z`}
                fill="currentColor" opacity="0.85"
            />
        );
    }
    // National — 8-ray sunburst (alternating long/short rays) + center dot.
    return (
        <g>
            {Array.from({ length: 8 }).map((_, i) => {
                const rad = (i * 45 - 90) * Math.PI / 180;
                const r1 = 4.5;
                const r2 = i % 2 === 0 ? 9 : 6;
                return (
                    <line
                        key={i}
                        x1={cx + Math.cos(rad) * r1} y1={cy + Math.sin(rad) * r1}
                        x2={cx + Math.cos(rad) * r2} y2={cy + Math.sin(rad) * r2}
                        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                    />
                );
            })}
            <circle cx={cx} cy={cy} r="3" fill="currentColor" />
        </g>
    );
}

export interface RankBadgeProps {
    rank: Rank;
    /** Shown only when `variant === 'full'`. Omit to hide. */
    level?: number;
    /** Shown only when `variant === 'full'`. Raw value, formatted with locale separators. */
    xp?: number;
    /** Pixel size preset. Default `'md'` (44px). */
    size?: RankBadgeSize;
    /** `compact` = badge only · `full` = badge + Lv./XP text. Default `'compact'`. */
    variant?: RankBadgeVariant;
    /** Amplified animations for the player's CURRENT rank. */
    isCurrent?: boolean;
    className?: string;
    onClick?: () => void;
}

export default function RankBadge({
    rank,
    level,
    xp,
    size = 'md',
    variant = 'compact',
    isCurrent = false,
    className = '',
    onClick,
}: RankBadgeProps) {
    const theme = RANK_THEMES[rank];
    const px = SIZE_PX[size];
    const half = px / 2;

    // Hex frame coordinates (flat-top hex inscribed at 85% of half).
    const hex: string[] = [];
    for (let i = 0; i < 6; i++) {
        const a = (i * 60 - 30) * Math.PI / 180;
        hex.push(
            `${(half + Math.cos(a) * (half * 0.85)).toFixed(2)},` +
            `${(half + Math.sin(a) * (half * 0.85)).toFixed(2)}`,
        );
    }

    // CSS custom properties — drive per-rank gradient stops in the .rank-badge* selectors.
    const badgeStyle = {
        width: px,
        height: px,
        '--rank-badge-primary': theme.primary,
        '--rank-badge-secondary': theme.secondary,
        '--rank-badge-glow': theme.glow,
    } as CSSProperties;

    const showLetter = rank !== 'S' && rank !== 'National';
    const ariaLabel =
        `${theme.name}${level !== undefined ? `, level ${level}` : ''}${isCurrent ? ' (current)' : ''}`;

    const badge = (
        <span
            className={`rank-badge${isCurrent ? ' is-current' : ''}`}
            style={badgeStyle}
        >
            <span className="rank-badge__halo" aria-hidden="true" />
            <span className="rank-badge__ring" aria-hidden="true" />
            <svg
                className="rank-badge__svg"
                viewBox={`0 0 ${px} ${px}`}
                width={px}
                height={px}
                aria-hidden="true"
            >
                <defs>
                    <radialGradient id={`rank-badge-bg-${rank}`} cx="50%" cy="40%" r="60%">
                        <stop offset="0%" stopColor={theme.primary} stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#0A0E1A" stopOpacity="0.9" />
                    </radialGradient>
                    <linearGradient id={`rank-badge-stroke-${rank}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.secondary} />
                        <stop offset="100%" stopColor={theme.primary} />
                    </linearGradient>
                </defs>
                <polygon
                    points={hex.join(' ')}
                    fill={`url(#rank-badge-bg-${rank})`}
                    stroke={`url(#rank-badge-stroke-${rank})`}
                    strokeWidth="1.4"
                />
                <g style={{ color: theme.secondary }}>
                    <RankInner rank={rank} size={px} />
                </g>
                {showLetter && (
                    <text
                        x={half}
                        y={half + 1.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="800"
                        fontSize={Math.max(11, Math.floor(px * 0.32))}
                        fill={theme.secondary}
                        style={{ paintOrder: 'stroke', stroke: '#0A0E1A', strokeWidth: 2 } as CSSProperties}
                    >
                        {theme.label}
                    </text>
                )}
            </svg>
            <span className="rank-badge__shimmer" aria-hidden="true" />
            {isCurrent && <span className="rank-badge__current-ring" aria-hidden="true" />}
        </span>
    );

    const showText = variant === 'full' && (level !== undefined || xp !== undefined);
    const inner = showText ? (
        <>
            {badge}
            <span className="flex flex-col leading-tight ml-2">
                {level !== undefined && (
                    <span className="text-sm font-bold font-mono text-white">Lv.{level}</span>
                )}
                {xp !== undefined && (
                    <span className="text-[10px] font-mono text-slate-400">
                        {xp.toLocaleString()} XP
                    </span>
                )}
            </span>
        </>
    ) : badge;

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`inline-flex items-center bg-transparent border-0 p-0 cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${className}`.trim()}
                aria-label={ariaLabel}
            >
                {inner}
            </button>
        );
    }

    return (
        <span
            className={`inline-flex items-center ${className}`.trim()}
            role="img"
            aria-label={ariaLabel}
        >
            {inner}
        </span>
    );
}
