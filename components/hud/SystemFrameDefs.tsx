import React from 'react';

// ─────────────────────────────────────────────────────────────────────────
// SystemFrameDefs — invisible SVG <defs> ported verbatim from the
// canonical .design-reference/system-notification-frame.html. Renders a
// 0×0 absolutely-positioned <svg> containing the corner filigree symbol
// (#sys-filigree) and its gradient (#sys-orn-grad). Every .sys-frame
// instance references the symbol via <use href="#sys-filigree" />, so
// this defs block must be mounted exactly ONCE per document — we mount
// it inside <Layout> so it's available on every authenticated route.
//
// Renamed IDs vs reference HTML to avoid collision with anything else
// the SPA might define: `filigree` → `sys-filigree`, `orn-grad` →
// `sys-orn-grad`.
// ─────────────────────────────────────────────────────────────────────────

export const SystemFrameDefs: React.FC = () => (
  <svg
    width="0"
    height="0"
    style={{ position: 'absolute' }}
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient
        id="sys-orn-grad"
        x1="0" y1="0" x2="56" y2="56"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%"   stopColor="#A5EAF8" />
        <stop offset="55%"  stopColor="#7DD9F5" />
        <stop offset="100%" stopColor="#5DC8E8" />
      </linearGradient>

      <symbol id="sys-filigree" viewBox="0 0 56 56">
        <g
          fill="none"
          stroke="url(#sys-orn-grad)"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Primary L-bracket (structural skeleton) */}
          <path d="M3 28 L3 3 L28 3" strokeWidth="2" />

          {/* Inner echo bracket (double-stroke look) */}
          <path d="M8 28 L8 8 L28 8" strokeWidth="0.9" opacity="0.55" />

          {/* Outer top sweeping flourish */}
          <path d="M11 3 Q11 12 18 14 Q24 16 26 22" strokeWidth="1.1" />
          {/* Outer left sweeping flourish (mirror) */}
          <path d="M3 11 Q12 11 14 18 Q16 24 22 26" strokeWidth="1.1" />

          {/* Curled tendrils at the outer extremes */}
          <path d="M3 22 Q9 22 11 28" strokeWidth="0.9" opacity="0.85" />
          <path d="M22 3 Q22 9 28 11" strokeWidth="0.9" opacity="0.85" />

          {/* Tiny inner curls toward the center diamond */}
          <path d="M18 18 Q23 17 25 22" strokeWidth="0.85" opacity="0.9" />
          <path d="M18 18 Q17 23 22 25" strokeWidth="0.85" opacity="0.9" />

          {/* Decorative dots along the flourishes */}
          <circle cx="14" cy="6"  r="0.9" fill="#A5EAF8" stroke="none" />
          <circle cx="6"  cy="14" r="0.9" fill="#A5EAF8" stroke="none" />
          <circle cx="26" cy="22" r="0.7" fill="#7DD9F5" stroke="none" />
          <circle cx="22" cy="26" r="0.7" fill="#7DD9F5" stroke="none" />

          {/* Hairlines beyond the L (give it an "outside" feeling) */}
          <path d="M3 34 Q3 38 6 40" strokeWidth="0.7" opacity="0.7" />
          <path d="M34 3 Q38 3 40 6" strokeWidth="0.7" opacity="0.7" />
        </g>

        {/* Central diamond gem at the corner inner tip */}
        <g transform="translate(26 26)">
          <path
            d="M0 -5 L5 0 L0 5 L-5 0 Z"
            fill="url(#sys-orn-grad)"
            stroke="#FFFFFF"
            strokeWidth="0.5"
            opacity="0.95"
          />
          <path
            d="M0 -2.5 L2.5 0 L0 2.5 L-2.5 0 Z"
            fill="#FFFFFF"
            opacity="0.55"
          />
        </g>
      </symbol>
    </defs>
  </svg>
);

export default SystemFrameDefs;
