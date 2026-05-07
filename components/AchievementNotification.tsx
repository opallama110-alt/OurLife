import React, { useEffect } from 'react';
import { Sparkles, X, Zap, Shield } from 'lucide-react';
import type { AchievementUnlock } from '../services/achievementService';
import type { AchievementRarity } from '../services/gamificationService';

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT NOTIFICATION — single auto-dismissing toast for one unlock.
// Multiple unlocks render as a stack (parent maps the queue, each toast
// owns its own 5s timer + dismiss handler).
// ═══════════════════════════════════════════════════════════════════════════

const RARITY_GRADIENT: Record<AchievementRarity, string> = {
  iron:      'from-slate-700 via-slate-800 to-slate-950',
  bronze:    'from-amber-800 via-slate-900 to-slate-950',
  silver:    'from-slate-500 via-slate-800 to-slate-950',
  purple:    'from-purple-700 via-slate-900 to-slate-950',
  gold:      'from-yellow-600 via-slate-900 to-slate-950',
  legendary: 'from-orange-600 via-red-900 to-slate-950',
  mythic:    'from-cyan-600 via-blue-900 to-slate-950',
};

const RARITY_RING: Record<AchievementRarity, string> = {
  iron:      'border-slate-500/40 shadow-slate-500/40',
  bronze:    'border-amber-700/50 shadow-amber-700/40',
  silver:    'border-slate-300/50 shadow-slate-300/40',
  purple:    'border-purple-500/60 shadow-purple-500/50',
  gold:      'border-yellow-400/60 shadow-yellow-400/50',
  legendary: 'border-orange-500/70 shadow-orange-500/60',
  mythic:    'border-cyan-400/70 shadow-cyan-400/60',
};

interface Props {
  unlock: AchievementUnlock;
  onDismiss: () => void;
  /** Display offset for stacked toasts (px). Parent computes this. */
  offsetY?: number;
}

export const AchievementNotification: React.FC<Props> = ({ unlock, onDismiss, offsetY = 0 }) => {
  const a = unlock.achievement;
  const gradient = RARITY_GRADIENT[a.rarity];
  const ring = RARITY_RING[a.rarity];

  useEffect(() => {
    const t = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[85] w-[calc(100%-2rem)] max-w-sm"
      style={{ top: `${16 + offsetY}px` }}
      role="status"
      aria-live="polite"
    >
      <div className={`relative rounded-2xl border bg-gradient-to-br ${gradient} ${ring} shadow-[0_0_40px_var(--tw-shadow-color)] overflow-hidden animate-slide-up`}>
        {/* Ambient sparkle */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 z-10 p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>

        <div className="relative z-[1] p-4 flex items-start gap-3">
          <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-slate-950/60 border ${ring} shadow-lg`}>
            {a.emoji}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-white/80 mb-0.5">
              <Sparkles size={10} />
              <span>Achievement Unlocked</span>
              <span className="text-white/50">· {a.rarity}</span>
            </div>
            <h3 className="text-sm font-bold text-white leading-tight">{a.label}</h3>
            <p className="text-[11px] text-white/70 leading-snug mt-0.5">{a.description}</p>

            <div className="flex items-center gap-3 mt-2 text-[10px] font-mono">
              {unlock.xpAwarded > 0 && (
                <span className="flex items-center gap-1 text-cyan-300">
                  <Zap size={10} />+{unlock.xpAwarded.toLocaleString()} XP
                </span>
              )}
              {unlock.tokensAwarded > 0 && (
                <span className="flex items-center gap-1 text-cyan-300">
                  <Shield size={10} />+{unlock.tokensAwarded} Token{unlock.tokensAwarded > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stack renderer — parent passes the queue; this lays them out top-down.
export const AchievementNotificationStack: React.FC<{
  queue: AchievementUnlock[];
  onDismiss: (id: string) => void;
}> = ({ queue, onDismiss }) => (
  <>
    {queue.map((u, i) => (
      <AchievementNotification
        key={u.achievement.id}
        unlock={u}
        offsetY={i * 110}
        onDismiss={() => onDismiss(u.achievement.id)}
      />
    ))}
  </>
);
