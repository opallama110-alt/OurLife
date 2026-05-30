import React, { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { storageService } from '../services/storageService';
import { achievementService } from '../services/achievementService';
import type { AchievementCategory } from '../services/gamificationService';
import { AchievementCard, GalleryEntry } from './AchievementCard';

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT GALLERY — Profile-page section that surfaces the full catalog.
// Two filter dimensions: category (workout/streak/habit/xp/rank/special) and
// status (all/unlocked/locked/in-progress). Stats header reflects whichever
// slice is currently visible.
// ═══════════════════════════════════════════════════════════════════════════

type StatusFilter = 'all' | 'unlocked' | 'locked' | 'in_progress';
type CategoryTab = 'all' | AchievementCategory;

const CATEGORY_TABS: { key: CategoryTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'workout', label: 'Workout' },
  { key: 'streak', label: 'Streak' },
  { key: 'habit', label: 'Habit' },
  { key: 'xp', label: 'XP' },
  { key: 'rank', label: 'Rank' },
  { key: 'special', label: 'Special' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unlocked', label: 'Unlocked' },
  { key: 'locked', label: 'Locked' },
  { key: 'in_progress', label: 'In Progress' },
];

const isInProgress = (e: GalleryEntry): boolean =>
  !e.unlocked && typeof e.requirement === 'number' && (e.progress || 0) > 0;

export const AchievementGallery: React.FC = () => {
  const [category, setCategory] = useState<CategoryTab>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [tick, setTick] = useState(0);

  // Re-evaluate the catalog whenever storage changes (workout logged, habit
  // toggled, profile synced) so progress bars stay live.
  useEffect(() => {
    const unsub = storageService.subscribe(() => setTick(t => t + 1));
    return unsub;
  }, []);

  const catalog = useMemo<GalleryEntry[]>(() => {
    return achievementService.getCatalog().map(a => ({
      id: a.id,
      label: a.label,
      description: a.description,
      emoji: a.emoji,
      rarity: a.rarity,
      category: a.category,
      unlocked: a.unlocked,
      progress: a.progress,
      requirement: a.requirement,
      xpReward: a.xpReward,
      tokenReward: a.tokenReward,
    }));
    // tick forces recompute on subscribe events
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const filtered = useMemo(() => {
    return catalog
      .filter(a => category === 'all' ? true : a.category === category)
      .filter(a => {
        if (status === 'all') return true;
        if (status === 'unlocked') return a.unlocked;
        if (status === 'locked') return !a.unlocked;
        if (status === 'in_progress') return isInProgress(a);
        return true;
      });
  }, [catalog, category, status]);

  const totalUnlocked = catalog.filter(a => a.unlocked).length;
  const total = catalog.length;
  const earnedXP = catalog.reduce((s, a) => s + (a.unlocked ? a.xpReward : 0), 0);

  return (
    <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono">
            Achievements
          </h3>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono text-slate-400">
            <span className="text-amber-400 font-bold">{totalUnlocked}</span>
            <span className="text-slate-600">/{total}</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            +{earnedXP.toLocaleString()} XP earned
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {CATEGORY_TABS.map(tab => {
          const active = category === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setCategory(tab.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${active
                ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300'
                : 'border border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Status filter */}
      <div className="flex gap-1 -mx-1 px-1">
        {STATUS_FILTERS.map(f => {
          const active = status === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all ${active
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'bg-slate-900/40 text-slate-500 border border-transparent hover:text-slate-300'}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-xs text-slate-500 font-mono">
          No achievements match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(a => (
            <AchievementCard key={a.id} achievement={a} />
          ))}
        </div>
      )}
    </section>
  );
};

