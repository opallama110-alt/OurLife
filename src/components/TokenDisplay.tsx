import React from 'react';
import { Shield } from 'lucide-react';

interface TokenDisplayProps {
  count: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: 12, gap: 'gap-1', wrapper: 'w-5 h-5' },
  md: { icon: 16, gap: 'gap-1.5', wrapper: 'w-7 h-7' },
  lg: { icon: 22, gap: 'gap-2', wrapper: 'w-10 h-10' },
};

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN DISPLAY — visual counter for Streak Freeze Tokens.
// Filled shields = available tokens; empty slate placeholders = unearned slots.
// Used in Dashboard (sm) and Settings Goals tab (lg).
// ═══════════════════════════════════════════════════════════════════════════
export const TokenDisplay: React.FC<TokenDisplayProps> = ({
  count,
  max = 3,
  size = 'md',
  className = '',
}) => {
  const safeCount = Math.max(0, Math.min(max, count));
  const dims = SIZE_MAP[size];

  return (
    <div className={`flex items-center ${dims.gap} ${className}`} aria-label={`${safeCount} of ${max} streak freeze tokens available`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < safeCount;
        return (
          <div
            key={i}
            className={`${dims.wrapper} rounded-md flex items-center justify-center transition-all ${filled
              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_10px_rgba(6,182,212,0.45)]'
              : 'bg-slate-800 border border-slate-700'
              }`}
          >
            <Shield
              size={dims.icon}
              className={filled ? 'text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]' : 'text-slate-600'}
              strokeWidth={filled ? 2.4 : 1.8}
            />
          </div>
        );
      })}
    </div>
  );
};
