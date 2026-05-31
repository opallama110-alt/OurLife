import React from 'react';

// ═══════════════════════════════════════════════════════════════
// AnatomicalHeart — golden-orange ember heart silhouette with
// per-tier visual evolution (halos, sparks, flames, orbit, crown,
// lightning). Used by IntroSequence Heart Awakening cinematic and
// any other System pronouncement that calls for the awakened heart.
// Ported from prototype components/IntroSequence.jsx::AnatomicalHeart.
// ═══════════════════════════════════════════════════════════════

interface Props {
  size?: number;
  /** 1..5 — visual intensity tier. Defaults to 5 (full crown). */
  tier?: 1 | 2 | 3 | 4 | 5;
}

const TIER_CFG = {
  1: { halo: 0.35, glow: 0.30, beat: '1.8s', sparks: 0,  flames: false, orbit: false, crown: false, lightning: false, scale: 0.78 },
  2: { halo: 0.55, glow: 0.50, beat: '1.6s', sparks: 5,  flames: false, orbit: false, crown: false, lightning: false, scale: 0.92 },
  3: { halo: 0.85, glow: 0.75, beat: '1.4s', sparks: 10, flames: true,  orbit: false, crown: false, lightning: false, scale: 1.04 },
  4: { halo: 0.95, glow: 0.90, beat: '1.3s', sparks: 14, flames: true,  orbit: true,  crown: false, lightning: true,  scale: 1.10 },
  5: { halo: 1.00, glow: 1.00, beat: '1.2s', sparks: 20, flames: true,  orbit: true,  crown: true,  lightning: true,  scale: 1.14 },
} as const;

export const AnatomicalHeart: React.FC<Props> = ({ size = 180, tier = 5 }) => {
  const t = Math.max(1, Math.min(5, tier)) as 1 | 2 | 3 | 4 | 5;
  const cfg = TIER_CFG[t];

  return (
    <div className={`ah-wrap ah-tier-${t}`}
      style={{
        width: size, height: size * 1.05,
        ['--ah-beat' as string]: cfg.beat,
        ['--ah-scale' as string]: String(cfg.scale),
      }}>
      {/* Tier 5: radiant crown rays */}
      {cfg.crown && (
        <div className="ah-crown">
          <svg viewBox="-100 -100 200 200" width="100%" height="100%">
            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i * 22.5 - 90) * Math.PI / 180;
              const r1 = 64;
              const r2 = i % 2 === 0 ? 92 : 78;
              return (
                <line key={i}
                  x1={Math.cos(a) * r1} y1={Math.sin(a) * r1}
                  x2={Math.cos(a) * r2} y2={Math.sin(a) * r2}
                  stroke="#FBBF24" strokeWidth={i % 2 === 0 ? 2.6 : 1.4}
                  strokeLinecap="round" opacity={i % 2 === 0 ? 0.95 : 0.55} />
              );
            })}
          </svg>
        </div>
      )}

      {cfg.orbit && (
        <>
          <div className="ah-orbit ah-orbit-a">
            <svg viewBox="-100 -100 200 200" width="100%" height="100%">
              <ellipse cx="0" cy="0" rx="86" ry="34" fill="none"
                stroke="#FBBF24" strokeWidth="1.4" strokeDasharray="4 6" opacity="0.7" />
              <circle cx="86" cy="0" r="3.5" fill="#FFF7ED" />
              <circle cx="-86" cy="0" r="2.5" fill="#FB923C" opacity="0.7" />
            </svg>
          </div>
          <div className="ah-orbit ah-orbit-b">
            <svg viewBox="-100 -100 200 200" width="100%" height="100%">
              <ellipse cx="0" cy="0" rx="88" ry="32" fill="none"
                stroke="#A78BFA" strokeWidth="1.2" strokeDasharray="2 5" opacity="0.55" />
              <circle cx="0" cy="32" r="2.8" fill="#C4B5FD" />
            </svg>
          </div>
        </>
      )}

      <div className="ah-halo" style={{ opacity: cfg.halo }} />
      <div className="ah-glow" style={{ opacity: cfg.glow }} />
      {t >= 5 && <div className="ah-halo-extra" />}

      {cfg.flames && (
        <svg className="ah-flames" viewBox="0 0 140 160" width="100%" height="100%">
          <defs>
            <linearGradient id={`ahf-grad-${t}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <path className="ah-flame ah-flame-a"
            d="M 22 90 C 8 78, 4 56, 14 38 C 16 50, 22 50, 24 62 C 30 72, 30 86, 24 96 Z"
            fill={`url(#ahf-grad-${t})`} opacity="0.78" />
          <path className="ah-flame ah-flame-b"
            d="M 118 90 C 132 78, 136 56, 126 38 C 124 50, 118 50, 116 62 C 110 72, 110 86, 116 96 Z"
            fill={`url(#ahf-grad-${t})`} opacity="0.78" />
          {t >= 4 && (
            <path className="ah-flame ah-flame-c"
              d="M 60 40 C 56 22, 62 6, 72 -8 C 80 8, 84 26, 78 44 C 74 50, 70 50, 66 48 Z"
              fill={`url(#ahf-grad-${t})`} opacity="0.9" />
          )}
        </svg>
      )}

      {cfg.sparks > 0 && (
        <div className="ah-sparks">
          {Array.from({ length: cfg.sparks }).map((_, i) => {
            const a = (i * (360 / cfg.sparks) - 90) * Math.PI / 180;
            const r = 32 + (i % 5) * 12;
            const x = 50 + Math.cos(a) * r;
            const y = 50 + Math.sin(a) * r * 0.7;
            return (
              <span key={i} className="ah-spark"
                style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.13}s` }} />
            );
          })}
        </div>
      )}

      <svg className="ah-svg" viewBox="0 0 140 160" width={size} height={size * 1.05} aria-hidden="true">
        <defs>
          <radialGradient id={`ah-core-${t}`} cx="40%" cy="40%" r="50%">
            <stop offset="0%"   stopColor="#FFF7ED" stopOpacity={0.85 + t * 0.03} />
            <stop offset="30%"  stopColor="#FBBF24" stopOpacity="0.95" />
            <stop offset="70%"  stopColor="#FB923C" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7C2D12" stopOpacity="1" />
          </radialGradient>
          <radialGradient id={`ah-bloom-${t}`} cx="50%" cy="40%" r="60%">
            <stop offset="0%"  stopColor="#FFF7ED" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FBBF24" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`ah-rim-${t}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#92400E" stopOpacity="0" />
            <stop offset="100%" stopColor="#451A03" stopOpacity="0.55" />
          </linearGradient>
          <filter id={`ah-blur-${t}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id={`ah-glow-${t}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <ellipse cx="70" cy="92" rx={50 + t * 4} ry={54 + t * 4}
          fill={`url(#ah-bloom-${t})`} filter={`url(#ah-blur-${t})`} opacity={0.35 + t * 0.1} />

        <g filter={`url(#ah-glow-${t})`}>
          {t >= 2 && (
            <path
              d="M 60 38 Q 56 24, 64 18 Q 74 10, 78 22 Q 80 32, 76 42 Q 80 36, 86 32 Q 96 30, 96 42 Q 96 50, 88 54 L 86 58"
              fill={`url(#ah-core-${t})`} stroke="#7C2D12" strokeWidth="1" strokeLinejoin="round" />
          )}
          <path
            d="M 70 144 C 30 122, 8 96, 18 66 C 24 50, 38 44, 50 52 C 58 56, 64 62, 70 68 C 76 62, 84 56, 92 52 C 104 44, 118 50, 124 66 C 134 96, 110 122, 70 144 Z"
            fill={`url(#ah-core-${t})`} stroke="#7C2D12" strokeWidth="1.2" />
          {t >= 2 && (
            <g>
              <path d="M 48 82 Q 56 96, 62 110 M 48 82 Q 42 94, 40 108"
                stroke="#451A03" strokeWidth="1.4" fill="none" opacity={0.4 + t * 0.08} strokeLinecap="round" />
              <path d="M 94 84 Q 100 96, 100 110 M 94 84 Q 88 96, 86 110"
                stroke="#451A03" strokeWidth="1.4" fill="none" opacity={0.35 + t * 0.08} strokeLinecap="round" />
            </g>
          )}
          {cfg.lightning && (
            <g className="ah-lightning" stroke="#A5F3FC" strokeWidth="1.2" fill="none" strokeLinecap="round">
              <path d="M 62 70 L 58 82 L 64 86 L 60 102" opacity="0.85" />
              <path d="M 82 78 L 88 90 L 82 96 L 88 110" opacity="0.75" />
            </g>
          )}
          <path
            d="M 70 144 C 30 122, 8 96, 18 66 C 24 50, 38 44, 50 52 C 58 56, 64 62, 70 68 C 76 62, 84 56, 92 52 C 104 44, 118 50, 124 66 C 134 96, 110 122, 70 144 Z"
            fill={`url(#ah-rim-${t})`} />
          <ellipse cx="50" cy="76" rx="9" ry="14" fill="#FFFFFF" opacity={0.20 + t * 0.04} />
          <ellipse cx="48" cy="72" rx="4" ry="6" fill="#FFFFFF" opacity={0.45 + t * 0.04} />
          <ellipse cx="62" cy="92" rx={10 + t} ry={16 + t * 2}
            fill="#FFF7ED" opacity={0.4 + t * 0.10} filter={`url(#ah-glow-${t})`} />
        </g>
      </svg>
    </div>
  );
};
