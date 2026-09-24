import React, { memo } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// Heart-Fire — the Gym Analytics workout-streak centrepiece (anatomical
// heart fused with flame, lub-dub beat, ECG behind it).
//
// Performance model: every moving part is its OWN element whose transform /
// opacity animates, so the compositor moves already-rasterised layers:
//   • `.an-hf-core` beats (and carries the per-tier `scale`, which composes
//     with the running beat transform instead of being overridden by it);
//   • the three flames are a sibling <svg> that flickers from its base;
//   • embers are HTML dots, aura tongues are tiny per-tongue SVGs;
//   • the ECG scrolls the <svg> element itself, not a <g> inside it.
// No SVG-internal filter (feGaussianBlur) is left — the static drop-shadows
// on the layer boxes are rasterised once. Animating children *inside* one
// filtered SVG used to repaint the whole stack every frame.
//
// Tiers: 0 PADAM (no streak: grey, still) · 1 EMBER · 2 FLAME · 3 BLAZE ·
// 4 PHOENIX · 5 ETERNAL. The beat quickens as the tier rises (`HF_BEAT`,
// applied on the stage so the ECG shares the same rhythm).
// ─────────────────────────────────────────────────────────────────────────

export type StreakTierId = 0 | 1 | 2 | 3 | 4 | 5;
export interface StreakTier { tier: StreakTierId; name: string; min: number; color: string; sub: string }

export const PADAM_TIER: StreakTier = { tier: 0, name: 'PADAM', min: 0, color: '#64748B', sub: 'Padam' };
export const STREAK_TIERS: StreakTier[] = [
  { tier: 1, name: 'EMBER',   min: 1,   color: '#FB923C', sub: 'Bara' },
  { tier: 2, name: 'FLAME',   min: 7,   color: '#F97316', sub: 'Nyala' },
  { tier: 3, name: 'BLAZE',   min: 30,  color: '#EF4444', sub: 'Membara' },
  { tier: 4, name: 'PHOENIX', min: 180, color: '#A855F7', sub: 'Phoenix' },
  { tier: 5, name: 'ETERNAL', min: 365, color: '#F5C518', sub: 'Abadi' },
];

export const tierFromDays = (days: number): StreakTier => {
  if (!Number.isFinite(days) || days <= 0) return PADAM_TIER;
  let t = STREAK_TIERS[0];
  for (const x of STREAK_TIERS) if (days >= x.min) t = x;
  return t;
};

export const tierById = (id: StreakTierId): StreakTier =>
  id === 0 ? PADAM_TIER : STREAK_TIERS.find(t => t.tier === id) ?? PADAM_TIER;

export const nextTier = (current: StreakTier): StreakTier | null =>
  STREAK_TIERS.find(t => t.tier === current.tier + 1) ?? null;

/** Beat period per tier — shared by heart, halos, flames and the ECG. */
export const HF_BEAT: Record<StreakTierId, string> = {
  0: '2.4s', 1: '1.6s', 2: '1.4s', 3: '1.25s', 4: '1.1s', 5: '1s',
};

// Aura tongues radiate around the heart (tier 3+). Coordinates are in the
// heart's 140×160 viewBox; each tongue is positioned as a % of that box.
const AURA_TONGUES = Array.from({ length: 6 }, (_, i) => {
  const a = ((i * 60 - 90) * Math.PI) / 180;
  return { x: 70 + Math.cos(a) * 64, y: 96 + Math.sin(a) * 64, rot: i * 60, delay: i * 0.18 };
});

const EMBERS: { cx: number; cy: number; d: number; color: string; delay: number; minTier: number }[] = [
  { cx: 50,  cy: 40,  d: 3,   color: '#FBBF24', delay: 0.2, minTier: 1 },
  { cx: 90,  cy: 38,  d: 2.4, color: '#FB923C', delay: 0.9, minTier: 1 },
  { cx: 70,  cy: 30,  d: 3.6, color: '#FFF7ED', delay: 1.5, minTier: 1 },
  { cx: 40,  cy: 60,  d: 2.6, color: '#FBBF24', delay: 0.5, minTier: 3 },
  { cx: 100, cy: 62,  d: 3.2, color: '#FB923C', delay: 1.1, minTier: 3 },
  { cx: 35,  cy: 100, d: 2.8, color: '#C4B5FD', delay: 0.7, minTier: 4 },
  { cx: 105, cy: 105, d: 3,   color: '#A855F7', delay: 1.3, minTier: 4 },
];

const HEART_PATH = 'M 70 142 C 30 118, 8 92, 18 64 C 24 48, 38 42, 50 50 C 58 54, 64 60, 70 66 C 76 60, 82 54, 90 50 C 102 42, 116 48, 122 64 C 132 92, 110 118, 70 142 Z';
const pctX = (x: number) => `${(x / 140) * 100}%`;
const pctY = (y: number) => `${(y / 160) * 100}%`;

export const HeartFire = memo(function HeartFire({ tier = 1, size = 150 }: { tier?: StreakTierId; size?: number }) {
  const lit = tier >= 1;
  return (
    <div className={`an-hf-wrap hf-tier-${tier}`} style={{ width: size, height: size * 1.05 }}>
      <div className="an-hf-haze" />
      <div className="an-hf-halo" />
      <div className="an-hf-pulsehalo" />

      {tier >= 4 && (
        <div className="an-hf-layer" aria-hidden="true">
          {/* Tilt + squash live on a static wrapper; only the inner ring
              spins, so the orbit reads as a ring tipped in 3D instead of a
              flat ellipse spinning like a propeller. */}
          <div className="an-hf-orbit" style={{ ['--hf-tilt' as string]: '-12deg' }}>
            <div className="an-hf-orbit-spin">
              <svg viewBox="-100 -100 200 200" width="100%" height="100%">
                <circle r="90" fill="none" stroke="#A855F7" strokeWidth="1.4" strokeDasharray="4 6" opacity="0.65" />
                <circle cx="90" cy="0" r="4" fill="#C4B5FD" />
                <circle cx="-90" cy="0" r="2.6" fill="#A855F7" opacity="0.7" />
              </svg>
            </div>
          </div>
          <div className="an-hf-orbit an-hf-orbit--rev" style={{ ['--hf-tilt' as string]: '28deg' }}>
            <div className="an-hf-orbit-spin">
              <svg viewBox="-100 -100 200 200" width="100%" height="100%">
                <circle r="92" fill="none" stroke="#F5C518" strokeWidth="1.2" strokeDasharray="2 5" opacity="0.55" />
                <circle cx="0" cy="92" r="3.4" fill="#FBBF24" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {tier >= 5 && (
        <div className="an-hf-layer" aria-hidden="true">
          <div className="an-hf-rays">
            <svg viewBox="-100 -100 200 200" width="100%" height="100%">
              {Array.from({ length: 12 }).map((_, i) => {
                const a = ((i * 30 - 90) * Math.PI) / 180;
                const r1 = 70, r2 = i % 2 === 0 ? 96 : 84;
                return (
                  <line key={i}
                    x1={Math.cos(a) * r1} y1={Math.sin(a) * r1}
                    x2={Math.cos(a) * r2} y2={Math.sin(a) * r2}
                    stroke="#F5C518"
                    strokeWidth={i % 2 === 0 ? 2.4 : 1.4}
                    strokeLinecap="round"
                    opacity={i % 2 === 0 ? 0.9 : 0.55} />
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {tier >= 3 && (
        <div className="an-hf-layer" aria-hidden="true">
          <div className="an-hf-flame-aura">
            <svg className="an-hf-defs" width="0" height="0" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="hf-aura-flame" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#EF4444" />
                  <stop offset="50%" stopColor="#FB923C" />
                  <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0.85" />
                </linearGradient>
              </defs>
            </svg>
            <div className="hf-aura-box">
              {AURA_TONGUES.map((t, i) => (
                // Outer span: static rotation about the tongue's anchor point
                // (the old `transform` attribute). Inner svg: the flicker, from
                // its own base — the two no longer overwrite each other.
                <span key={i} className="hf-tongue"
                  style={{ left: pctX(t.x - 6), top: pctY(t.y - 4), transform: `rotate(${t.rot}deg)` }}>
                  <svg className="hf-tongue-flame" viewBox="-6 -4 12 14" style={{ animationDelay: `${t.delay}s` }}>
                    <path d="M -6 10 Q 0 -18 6 10 Q 0 4 -6 10 Z" fill="url(#hf-aura-flame)" opacity="0.8" />
                  </svg>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="an-hf-core">
        {lit && <div className="an-hf-coreglow" />}
        {lit && (
          <svg className="an-hf-flames" viewBox="0 0 140 160" aria-hidden="true">
            <defs>
              <linearGradient id="hf-flame" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#FB923C" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#FBBF24" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <path d="M 40 56 C 28 44, 22 26, 32 12 C 36 22, 42 18, 44 28 C 50 34, 52 46, 50 56 Z" fill="url(#hf-flame)" opacity="0.88" />
            <path d="M 60 50 C 56 32, 60 14, 72 -4 C 80 12, 82 30, 80 48 C 78 54, 74 56, 70 56 C 66 56, 62 54, 60 50 Z" fill="url(#hf-flame)" opacity="0.95" />
            <path d="M 100 56 C 112 44, 118 26, 108 12 C 104 22, 98 18, 96 28 C 90 34, 88 46, 90 56 Z" fill="url(#hf-flame)" opacity="0.88" />
          </svg>
        )}

        <svg className="an-hf-svg" viewBox="0 0 140 160" aria-hidden="true">
          <defs>
            <radialGradient id="hf-heart" cx="50%" cy="80%" r="65%">
              <stop offset="0%"   stopColor="#FBBF24" />
              <stop offset="30%"  stopColor="#FB923C" />
              <stop offset="70%"  stopColor="#DC2626" />
              <stop offset="100%" stopColor="#7F1D1D" />
            </radialGradient>
            <radialGradient id="hf-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#FFF7ED" stopOpacity="0.95" />
              <stop offset="55%"  stopColor="#FBBF24" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hf-rim" cx="50%" cy="40%" r="60%">
              <stop offset="0%"   stopColor="#7F1D1D" stopOpacity="0" />
              <stop offset="80%"  stopColor="#7F1D1D" stopOpacity="0" />
              <stop offset="100%" stopColor="#450A0A" stopOpacity="0.6" />
            </radialGradient>
          </defs>
          <path d={HEART_PATH} fill="url(#hf-heart)" stroke="#7F1D1D" strokeWidth="1.2" />
          <path d={HEART_PATH} fill="url(#hf-rim)" />
          <path d="M 72 60 Q 78 52, 82 48 Q 88 42, 92 50" stroke="#450A0A" strokeWidth="2" fill="none" opacity="0.55" strokeLinecap="round" />
          <path d="M 50 80 Q 56 90, 58 100 M 50 80 Q 44 88, 42 100" stroke="#7F1D1D" strokeWidth="1.2" fill="none" opacity="0.7" strokeLinecap="round" />
          <path d="M 90 82 Q 96 92, 96 102 M 90 82 Q 86 94, 84 105" stroke="#7F1D1D" strokeWidth="1.2" fill="none" opacity="0.6" strokeLinecap="round" />
          <ellipse cx="60" cy="85" rx="14" ry="22" fill="url(#hf-core)" opacity="0.85" />
          <ellipse cx="50" cy="74" rx="7" ry="11" fill="white" opacity="0.32" />
          <ellipse cx="48" cy="70" rx="3" ry="5" fill="white" opacity="0.55" />
        </svg>

        {lit && (
          <div className="hf-embers" aria-hidden="true">
            {EMBERS.filter(e => tier >= e.minTier).map((e, i) => (
              <i key={i} className="hf-ember"
                style={{
                  left: pctX(e.cx), top: pctY(e.cy),
                  width: e.d, height: e.d, marginLeft: -e.d / 2, marginTop: -e.d / 2,
                  background: e.color, color: e.color,
                  animationDelay: `${e.delay}s`,
                }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ── ECG waveform behind the heart ──
// Two identical periods side by side; the SVG ELEMENT scrolls by exactly one
// period (-50% of its 400% width), so the drop-shadow is rasterised once and
// the compositor just slides the layer.
const ecgWave = (offset: number) => `
  M ${offset + 0} 30   L ${offset + 60} 30
  L ${offset + 75} 28  L ${offset + 85} 24
  L ${offset + 95} 28  L ${offset + 110} 30
  L ${offset + 125} 30 L ${offset + 132} 36
  L ${offset + 138} 6  L ${offset + 144} 50
  L ${offset + 150} 30 L ${offset + 170} 30
  L ${offset + 182} 26 L ${offset + 192} 30
  L ${offset + 280} 30
`;
const ECG_PATH = ecgWave(0) + ' ' + ecgWave(280);

export const ECGLine = memo(function ECGLine() {
  return (
    <div className="an-ecg" aria-hidden="true">
      <div className="an-ecg-grid" />
      <svg className="an-ecg-svg" viewBox="0 0 560 60" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ecg-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#22D3EE" stopOpacity="0" />
            <stop offset="20%"  stopColor="#22D3EE" stopOpacity="0.4" />
            <stop offset="80%"  stopColor="#22D3EE" stopOpacity="1" />
            <stop offset="100%" stopColor="#67E8F9" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d={ECG_PATH} fill="none" stroke="url(#ecg-fade)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="an-ecg-dot" />
    </div>
  );
});
