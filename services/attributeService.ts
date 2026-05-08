import { Attributes, GymProfile, GymSchedule, Habit, MuscleGroup, UserState, WorkoutLog } from '../types';
import { RANK_TIERS } from './gamificationService';
import { storageService } from './storageService';

// ═══════════════════════════════════════════════════════════════════════════
// ATTRIBUTE SERVICE
// Derives the 5-stat Solo Leveling character signature from workout history
// + user profile + habits + schedule, maps rank + top stat to a "job class,"
// and exposes rank-progress data for the Status Window's progress bar.
// Pure when explicit data is supplied; reads from storage as fallback so
// existing callers (StatusCard, Profile, achievementService) keep working
// with their current (profile, workouts) call.
// ═══════════════════════════════════════════════════════════════════════════

// ── Stat-derivation keyword bags ──────────────────────────────────────────
const STR_KEYWORDS = [
  'bench press', 'squat', 'deadlift', 'overhead press',
  'barbell row', 'weighted dip', 'weighted pull',
];
// AGI = explosive / dynamic moves (jumps, plyo). Endurance cardio lives in
// CARDIO_KEYWORDS so the cardio-frequency signal can target steady-state
// activity without diluting the explosive-moves count.
const AGI_KEYWORDS = [
  'burpee', 'jump', 'sprint', 'plyo', 'box jump',
  'mountain climber', 'high knee', 'ladder',
];
const CARDIO_KEYWORDS = [
  'run', 'jog', 'cycle', 'cycling', 'swim', 'swimming',
  'rowing', 'row', 'treadmill', 'elliptical',
];

// Push / pull / legs categorization for the INT balance signal.
type PPL = 'push' | 'pull' | 'legs';
const PPL_MAP: Partial<Record<MuscleGroup, PPL>> = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  lats: 'pull', traps: 'pull', lower_back: 'pull', biceps: 'pull', forearms: 'pull',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
  // abs / obliques intentionally omitted — they're core, not part of the
  // push/pull/legs split that this signal measures.
};

const matchesAny = (name: string, bag: string[]): boolean => {
  const lower = name.toLowerCase();
  return bag.some(k => lower.includes(k));
};

const clamp100 = (n: number): number => Math.max(0, Math.min(100, Math.floor(n)));

// ── Time-window helpers ───────────────────────────────────────────────────
const DAY_MS = 86_400_000;

const workoutTimestamp = (w: WorkoutLog): number => {
  if (w.timestamp) {
    const t = new Date(w.timestamp).getTime();
    if (!isNaN(t)) return t;
  }
  // Fallback: noon of the date string keeps ordering sane across DST shifts.
  return new Date((w.date || '') + 'T12:00:00').getTime();
};

const workoutsInLastDays = (workouts: WorkoutLog[], days: number): WorkoutLog[] => {
  const cutoff = Date.now() - days * DAY_MS;
  return (workouts || []).filter(w => {
    const t = workoutTimestamp(w);
    return !isNaN(t) && t >= cutoff;
  });
};

// ── BMI helper ────────────────────────────────────────────────────────────
// Returns 0 if either dimension is missing/invalid so callers can skip the
// signal without an extra guard.
const computeBMI = (userState?: UserState): number => {
  const w = userState?.weight || 0;
  const hCm = userState?.height || 0;
  if (w <= 0 || hCm <= 0) return 0;
  const hM = hCm / 100;
  return w / (hM * hM);
};

// ── Habit completion rate over the last N days (0–1) ──────────────────────
// "Completion" = ALL active habits done on that day. If there are no habits
// defined, returns 0 (no signal). Days fully in the future or with zero
// habits still count toward the denominator so a one-habit-streak doesn't
// game the rate against a different user with five habits.
const habitCompletionRate = (habits: Habit[] | undefined, days: number): number => {
  if (!habits || habits.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let completedDays = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA');
    const allDone = habits.every(h => (h.completedDates || []).includes(dateStr));
    if (allDone) completedDays++;
  }
  return completedDays / days;
};

// ── Schedule adherence over the last N days ───────────────────────────────
// Counts days where the schedule had a non-empty, non-"rest" entry AND the
// user logged at least one workout that day. Free-text schedule values are
// not parsed for muscle-group match — too brittle.
const scheduleAdherenceCount = (
  workouts: WorkoutLog[] | undefined,
  schedule: GymSchedule | undefined,
  days: number,
): number => {
  if (!schedule || !workouts || workouts.length === 0) return 0;
  const workoutDates = new Set((workouts || []).map(w => w.date).filter(Boolean));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let hits = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayKey = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const scheduled = (schedule[dayKey] || '').trim();
    if (!scheduled) continue;
    if (/^rest$|^off$|^istirahat$/i.test(scheduled)) continue;
    const dateStr = d.toLocaleDateString('en-CA');
    if (workoutDates.has(dateStr)) hits++;
  }
  return hits;
};

/**
 * Compute STR / VIT / AGI / PER / INT from gym profile + workout history,
 * augmented (when supplied) with userState for BMI signals, habits for
 * discipline signals, and gymSchedule for adherence signals.
 *
 * Each stat caps at 100. Tunings are intentionally conservative so a brand-
 * new account reads near 0 and stats grow visibly with every signal that
 * comes online (first workout, first habit, profile filled out, etc.).
 *
 * Existing floors (keyword frequency, workout count, streak, variety) are
 * preserved as base contributions; new signals are additive on top.
 *
 * Optional args fall back to storage so existing 2-arg callers keep working.
 */
export const calculateAttributes = (
  profile: GymProfile,
  workouts: WorkoutLog[],
  userState?: UserState,
  habits?: Habit[],
  gymSchedule?: GymSchedule,
): Attributes => {
  // Resolve fallbacks once. Cheap reads — storage is a localCache lookup.
  const u = userState ?? storageService.getUserState();
  const h = habits ?? storageService.getHabits();
  const sched = gymSchedule ?? storageService.getGymSchedule();

  // Pre-compute window slices used by multiple stats.
  const last14d = workoutsInLastDays(workouts, 14);
  const last4w = workoutsInLastDays(workouts, 28);
  const habitRate7d = habitCompletionRate(h, 7);
  const bmi = computeBMI(u);

  // ── STR ────────────────────────────────────────────────────────────────
  // Floor: STR-keyword session count + small set-volume drip.
  // New: bodyweight-relative max compound load proxy + heavy-program bonus
  // (when at least 50% of recent sessions hit a STR keyword, with a sample-
  // size guard so a single recent workout doesn't trip the threshold).
  const strWorkouts = workouts.filter(w =>
    (w.exercises || []).some(e => matchesAny(e.name, STR_KEYWORDS)),
  ).length;
  let strBase = strWorkouts * 5 + (profile.totalSetsCompleted || 0) * 0.1;

  // Bodyweight-relative max load (capped). weight on WorkoutLog is per-
  // exercise, not per-set — we treat it as the working weight for that
  // exercise. Iterating all logs is fine at app scale (< low thousands).
  if (u?.weight && u.weight > 0) {
    let maxStrLoad = 0;
    for (const w of workouts) {
      for (const e of (w.exercises || [])) {
        if (matchesAny(e.name, STR_KEYWORDS) && (e.weight || 0) > maxStrLoad) {
          maxStrLoad = e.weight;
        }
      }
    }
    if (maxStrLoad > 0) {
      strBase += Math.min(20, (maxStrLoad / u.weight) * 10);
    }
  }

  // Heavy-program specialization. Need at least 3 workouts in the window
  // before evaluating — 1-of-1 = 100% would otherwise hand out the bonus.
  if (last14d.length >= 3) {
    const strHits = last14d.filter(w =>
      (w.exercises || []).some(e => matchesAny(e.name, STR_KEYWORDS)),
    ).length;
    if (strHits / last14d.length > 0.5) strBase += 6;
  }
  const STR = clamp100(strBase);

  // ── VIT ────────────────────────────────────────────────────────────────
  // Floor: workouts × 2 + streaks. New: healthy-BMI baseline (no penalty
  // outside range — silent), 7-day habit completion ≥ 80%.
  let vitBase =
    (profile.workoutsCompleted || 0) * 2 +
    (profile.currentStreak || 0) * 5 +
    (profile.longestStreak || 0) * 2;
  if (bmi >= 18.5 && bmi < 25) vitBase += 6;
  if (habitRate7d >= 0.8) vitBase += 5;
  const VIT = clamp100(vitBase);

  // ── AGI ────────────────────────────────────────────────────────────────
  // Floor: explosive-keyword count + workout drip. New: cardio frequency
  // over last 4 weeks (parallel CARDIO_KEYWORDS bag), mild low-BMI factor.
  const agiWorkouts = workouts.filter(w =>
    (w.exercises || []).some(e => matchesAny(e.name, AGI_KEYWORDS)),
  ).length;
  let agiBase = agiWorkouts * 4 + (profile.workoutsCompleted || 0) * 0.5;

  const cardioWorkouts4w = last4w.filter(w =>
    (w.exercises || []).some(e => matchesAny(e.name, CARDIO_KEYWORDS)),
  ).length;
  if (cardioWorkouts4w / 4 > 1) agiBase += 6;

  if (bmi > 0 && bmi < 24) agiBase += 3;
  const AGI = clamp100(agiBase);

  // ── PER ────────────────────────────────────────────────────────────────
  // Floor: streaks + level multiplier. New: 7-day habit completion × 30 (a
  // perfectly compliant week is worth +30 — PER is discipline), schedule
  // adherence (any non-rest scheduled day with a logged workout = +1, cap
  // at 5 over 14 days).
  let perBase =
    (profile.longestStreak || 0) * 3 +
    (profile.currentStreak || 0) * 2 +
    (profile.level || 1) * 2;
  perBase += habitRate7d * 30;
  perBase += Math.min(5, scheduleAdherenceCount(workouts, sched, 14));
  const PER = clamp100(perBase);

  // ── INT ────────────────────────────────────────────────────────────────
  // Floor: unique exercise + muscle-group diversity + level baseline.
  // New: muscle variance over the last 8 workouts (distinct muscles minus
  // 4, capped at +6 — rewards rotation), and push/pull/legs balance over
  // last 14 days (all three categories above 25% share = +5).
  const uniqueExercises = new Set<string>();
  const muscleDiversity = new Set<string>();
  for (const w of workouts) {
    for (const e of (w.exercises || [])) uniqueExercises.add(e.name.toLowerCase());
    for (const m of (w.muscleGroups || [])) muscleDiversity.add(m);
  }
  let intBase =
    uniqueExercises.size * 2 +
    muscleDiversity.size * 5 +
    (profile.level || 1) * 1.5;

  // Variance proxy: distinct muscles touched in last 8 workouts, beyond a
  // baseline of 4 (so a single workout doesn't trip it).
  const last8 = (workouts || []).slice(0, 8);
  const recentMuscles = new Set<string>();
  for (const w of last8) for (const m of (w.muscleGroups || [])) recentMuscles.add(m);
  intBase += Math.min(6, Math.max(0, recentMuscles.size - 4));

  // Push/pull/legs balance over 14d.
  if (last14d.length > 0) {
    let push = 0, pull = 0, legs = 0;
    for (const w of last14d) {
      const cats = new Set<PPL>();
      for (const m of (w.muscleGroups || [])) {
        const cat = PPL_MAP[m];
        if (cat) cats.add(cat);
      }
      if (cats.has('push')) push++;
      if (cats.has('pull')) pull++;
      if (cats.has('legs')) legs++;
    }
    const total = last14d.length;
    if (push / total > 0.25 && pull / total > 0.25 && legs / total > 0.25) {
      intBase += 5;
    }
  }
  const INT = clamp100(intBase);

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
