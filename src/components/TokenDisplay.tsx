import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Shield } from 'lucide-react';

interface TokenDisplayProps {
  count: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /**
   * Count to animate FROM on mount. TokenUsedModal passes `remaining + 1`
   * so the user actually watches the token that saved their streak get
   * spent. Omit to start at `count` (no mount animation).
   */
  animateFrom?: number;
  /** Delay (ms) before a gain/spend animation plays — lets a modal land first. */
  fxDelay?: number;
}

const ICON_PX = { sm: 12, md: 16, lg: 22 } as const;

type SlotFx = { i: number; kind: 'gain' | 'spend' };

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN DISPLAY — visual counter for Streak Freeze Tokens.
// Filled shields = available tokens; empty slots = unearned.
// Earning a token pops the new shield in; spending one shatters a ghost
// shield out of the vacated slot. Presentation only — the count comes from
// streakProtectionService via the caller.
// Used in Settings Goals tab (lg) and TokenUsedModal (lg).
// ═══════════════════════════════════════════════════════════════════════════
export const TokenDisplay: React.FC<TokenDisplayProps> = ({
  count,
  max = 3,
  size = 'md',
  className = '',
  animateFrom,
  fxDelay = 0,
}) => {
  const safeCount = Math.max(0, Math.min(max, count));
  const prev = useRef(Math.max(0, Math.min(max, animateFrom ?? safeCount)));
  const [fx, setFx] = useState<SlotFx | null>(null);

  // Layout effect: the fx class lands in the same frame as the new count, so
  // there's no one-frame flash of the already-empty slot before the ghost.
  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = safeCount;
    if (safeCount > p) setFx({ i: safeCount - 1, kind: 'gain' });
    else if (safeCount < p) setFx({ i: safeCount, kind: 'spend' });
  }, [safeCount]);

  // Safety net: animationend never fires in a backgrounded tab.
  useEffect(() => {
    if (!fx) return;
    const t = window.setTimeout(() => setFx(null), fxDelay + 1400);
    return () => window.clearTimeout(t);
  }, [fx, fxDelay]);

  const icon = ICON_PX[size];

  return (
    <div
      className={`tok tok--${size} ${className}`.trim()}
      style={{ '--tok-fx-delay': `${fxDelay}ms` } as React.CSSProperties}
      role="img"
      aria-label={`${safeCount} dari ${max} token streak freeze tersedia`}
    >
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < safeCount;
        const slotFx = fx && fx.i === i ? fx.kind : null;
        return (
          <span
            key={i}
            className={`tok-slot ${filled ? 'is-filled' : ''} ${slotFx === 'gain' ? 'is-gain' : ''}`}
            onAnimationEnd={e => { if (e.target === e.currentTarget && slotFx === 'gain') setFx(null); }}
          >
            <Shield size={icon} strokeWidth={filled ? 2.4 : 1.8} aria-hidden="true" />
            {slotFx === 'spend' && (
              <span className="tok-ghost" aria-hidden="true" onAnimationEnd={() => setFx(null)}>
                <Shield size={icon} strokeWidth={2.4} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};
