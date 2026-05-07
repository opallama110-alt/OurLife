import { Attributes, GymProfile, WorkoutLog } from '../types';
import { RANK_TIERS } from './gamificationService';

// ═══════════════════════════════════════════════════════════════════════════
// ATTRIBUTE SERVICE
// Derives the 5-stat Solo Leveling character signature from workout history,
// maps rank + top stat to a "job class," and exposes rank-progress data
// for the Status Window's progress bar. Pure functions — no side effects.
// ═══════════════════════════════════════════════════════════════════════════

// ── Stat-derivation keyword bags ──────────────────────────────────────────
const STR_KEYWORDS = [
  'bench press', 'squat', 'deadlift', 'overhead press',
  'barbell row', 'weighted dip', 'weighted pull',
];
const AGI_KEYWORDS = [
  'burpee', 'jump', 'sprint', 'plyo', 'box jump',
  'mountain climber', 'high knee', 'ladder',
];

const matchesAny = (name: string, bag: string[]): boolean => {
  const lower = name.toLowerCase();
  return bag.some(k => lower.includes(k));
};

const clamp100 = (n: number): number => Math.max(0, Math.min(100, Math.floor(n)));

/**
 * Compute STR / VIT / AGI / PER / INT from gym profile + workout history.
 * Each stat caps at 100 — these are character-progression stats, not raw counters.
 *
 * Tunings are intentionally conservative so a brand-new account reads as low
 * across the board and stats grow visibly with every session.
 */
export const calculateAttributes = (
  profile: GymProfile,
  workouts: WorkoutLog[],
): Attributes => {
  // STR — count workouts that include a heavy compound lift,
  // augmented by total set volume so high-volume programs reward the lifter.
  const strWorkouts = workouts.filter(w =>
    (w.exercises || []).some(e => matchesAny(e.name, STR_KEYWORDS)),
  ).length;
  const STR = clamp100(strWorkouts * 5 + (profile.totalSetsCompleted || 0) * 0.1);

  // VIT — endurance/consistency: total workouts × 2, current streak × 5,
  // longest streak × 2. Streaks are weighted heaviest because vitality is
  // about showing up.
  const VIT = clamp100(
    (profile.workoutsCompleted || 0) * 2 +
    (profile.currentStreak || 0) * 5 +
    (profile.longestStreak || 0) * 2,
  );

  // AGI — explosive/dynamic movement frequency, with a small workout-count
  // floor so non-explicit cardio days still drip into the stat.
  const agiWorkouts = workouts.filter(w =>
    (w.exercises || []).some(e => matchesAny(e.name, AGI_KEYWORDS)),
  ).length;
  const AGI = clamp100(agiWorkouts * 4 + (profile.workoutsCompleted || 0) * 0.5);

  // PER — discipline/awareness: heavily weighted on streaks (rewarding
  // habituation) plus a level multiplier so seasoned users have a baseline.
  const PER = clamp100(
    (profile.longestStreak || 0) * 3 +
    (profile.currentStreak || 0) * 2 +
    (profile.level || 1) * 2,
  );

  // INT — strategic variety: unique exercises × 2 + muscle-group diversity × 5
  // + a level baseline. Rewards programs that hit the whole body across time.
  const uniqueExercises = new Set<string>();
  const muscleDiversity = new Set<string>();
  for (const w of workouts) {
    for (const e of (w.exercises || [])) uniqueExercises.add(e.name.toLowerCase());
    for (const m of (w.muscleGroups || [])) muscleDiversity.add(m);
  }
  const INT = clamp100(
    uniqueExercises.size * 2 +
    muscleDiversity.size * 5 +
    (profile.level || 1) * 1.5,
  );

  return { STR, VIT, AGI, PER, INT };
};

// ── Job class derivation ──────────────────────────────────────────────────
// Existing RANK_TIERS in gamificationService are the source of truth. We map
// each rank name to a base class, and each stat to a specialization. S-Rank+
// gets the "Shadow" prefix to mirror Solo Leveling endgame flavor.

const RANK_TO_BASE: Record<string, string> = {
  'E-Rank': 'Recruit',
  'D-Rank': 'Vanguard',
  'C-Rank': 'Knight',
  'B-Rank': 'Elite',
  'A-Rank': 'Master',
  'S-Rank': 'Monarch',
  'National Level Hunter': 'Sovereign',
};

const STAT_TO_SPEC: Record<keyof Attributes, string> = {
  STR: 'Berserker',
  VIT: 'Tank',
  AGI: 'Assassin',
  PER: 'Ranger',
  INT: 'Strategist',
};

const SHADOW_RANKS = new Set(['S-Rank', 'National Level Hunter']);

export const getJobClass = (rank: string, attributes: Attributes): string => {
  const entries = Object.entries(attributes) as [keyof Attributes, number][];
  // Stable tie-break: highest value, then declaration order via reverse-sort.
  entries.sort((a, b) => b[1] - a[1]);
  const [topStat] = entries[0];

  const base = RANK_TO_BASE[rank] || 'Recruit';
  const spec = STAT_TO_SPEC[topStat];

  if (SHADOW_RANKS.has(rank)) return `Shadow ${spec}`;
  return `${base} ${spec}`;
};

// ── Rank progress (for the Rank Progress bar) ─────────────────────────────
export interface RankProgress {
  current: string;
  next: string;
  levelsToNext: number;
  progressPercent: number; // 0–100 within the current rank tier
}

export const getRankProgress = (level: number): RankProgress => {
  const safeLevel = Math.max(1, level || 1);
  const idx = RANK_TIERS.findIndex(t => safeLevel >= t.minLevel && safeLevel <= t.maxLevel);
  const current = idx >= 0 ? RANK_TIERS[idx] : RANK_TIERS[0];
  const next = idx >= 0 && idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;

  if (!next) {
    return { current: current.name, next: 'MAX', levelsToNext: 0, progressPercent: 100 };
  }

  const span = next.minLevel - current.minLevel;
  const progressed = safeLevel - current.minLevel;
  const progressPercent = span > 0 ? Math.min(100, Math.max(0, (progressed / span) * 100)) : 0;

  return {
    current: current.name,
    next: next.name,
    levelsToNext: Math.max(0, next.minLevel - safeLevel),
    progressPercent,
  };
};
