import React from 'react';
import { Lock, Shield, Zap } from 'lucide-react';
import type { AchievementCategory, AchievementRarity } from '../services/gamificationService';

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT CARD — single tile in the gallery grid.
// Locked entries render with a lock icon and dimmed text. Unlocked entries
// glow with their rarity color. Numeric progress bar appears whenever the
// achievement defines a `requirement` (boolean / multi-condition entries
// just show locked/unlocked).
// ═══════════════════════════════════════════════════════════════════════════

export type GalleryEntry = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  rarity: AchievementRarity;
  category?: AchievementCategory;
  unlocked: boolean;
  progress: number;
  requirement?: number;
  xpReward: number;
  tokenReward: number;
};

interface RarityStyle {
  glow: string;
  border: string;
  text: string;
  bar: string; // tailwind gradient classes for the progress fill
}

const RARITY_STYLE: Record<AchievementRarity, RarityStyle> = {
  iron:      { glow: 'shadow-slate-500/30',   border: 'border-slate-500/40',  text: 'text-slate-300',  bar: 'from-slate-400 to-slate-500' },
  bronze:    { glow: 'shadow-amber-700/30',   border: 'border-amber-700/40',  text: 'text-amber-300',  bar: 'from-amber-600 to-amber-800' },
  silver:    { glow: 'shadow-slate-300/40',   border: 'border-slate-300/50',  text: 'text-slate-100',  bar: 'from-slate-300 to-slate-500' },
  purple:    { glow: 'shadow-purple-500/40',  border: 'border-purple-500/50', text: 'text-purple-200', bar: 'from-purple-400 to-purple-600' },
  gold:      { glow: 'shadow-yellow-400/50',  border: 'border-yellow-400/60', text: 'text-yellow-100', bar: 'from-yellow-400 to-amber-500' },
  legendary: { glow: 'shadow-orange-500/60',  border: 'border-orange-500/70', text: 'text-orange-100', bar: 'from-orange-500 to-red-600' },
  mythic:    { glow: 'shadow-cyan-400/60',    border: 'border-cyan-400/70',   text: 'text-cyan-100',   bar: 'from-cyan-400 via-blue-500 to-purple-500' },
};

interface Props {
  achievement: GalleryEntry;
  onClick?: () => void;
}

export const AchievementCard: React.FC<Props> = ({ achievement: a, onClick }) => {
  const style = RARITY_STYLE[a.rarity];
  const hasProgress = typeof a.requirement === 'number' && a.requirement > 0;
  const pct = hasProgress
    ? Math.min(100, Math.round(((a.progress || 0) / (a.requirement as number)) * 100))
    : (a.unlocked ? 100 : 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full text-left bg-slate-950/70 border rounded-2xl p-4 transition-all ${a.unlocked
        ? `${style.border} shadow-lg ${style.glow} hover:shadow-xl`
        : 'border-slate-800 opacity-70 hover:opacity-100'}`}
    >
      {/* Rarity ribbon */}
      <div className="absolute top-2 right-2 text-[8px] font-mono uppercase tracking-widest text-slate-500">
        {a.rarity}
      </div>

      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl border ${a.unlocked
            ? `${style.border} bg-gradient-to-br from-slate-900 to-slate-950 ${style.glow} shadow-lg`
            : 'border-slate-800 bg-slate-900'}`}
        >
          {a.unlocked ? a.emoji : <Lock size={18} className="text-slate-600" />}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className={`font-bold text-sm leading-tight ${a.unlocked ? style.text : 'text-slate-400'}`}>
            {a.label}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{a.description}</p>

          {hasProgress && !a.unlocked && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mb-1">
                <span>{(a.progress || 0).toLocaleString()} / {(a.requirement as number).toLocaleString()}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${style.bar} transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2.5 text-[10px] font-mono">
            <span className="flex items-center gap-1 text-cyan-400">
              <Zap size={10} />+{a.xpReward.toLocaleString()} XP
            </span>
            {a.tokenReward > 0 && (
              <span className="flex items-center gap-1 text-cyan-400">
                <Shield size={10} />+{a.tokenReward}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};
