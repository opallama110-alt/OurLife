import { GymProfile, Habit, MuscleGroup, WorkoutLog } from '../types';

// ═══════════════════ RANK SYSTEM (Level-Based, Single Source of Truth) ═══════════════════
interface RankTier {
    minLevel: number;
    maxLevel: number;
    name: string;
    emoji: string;
    color: string; // tailwind color class
}

export const RANK_TIERS: RankTier[] = [
    { minLevel: 1, maxLevel: 5, name: 'E-Rank', emoji: '🥉', color: 'text-slate-400' },
    { minLevel: 6, maxLevel: 10, name: 'D-Rank', emoji: '🥈', color: 'text-emerald-400' },
    { minLevel: 11, maxLevel: 20, name: 'C-Rank', emoji: '⚔️', color: 'text-cyan-400' },
    { minLevel: 21, maxLevel: 35, name: 'B-Rank', emoji: '🛡️', color: 'text-blue-400' },
    { minLevel: 36, maxLevel: 50, name: 'A-Rank', emoji: '🔥', color: 'text-purple-400' },
    { minLevel: 51, maxLevel: 75, name: 'S-Rank', emoji: '👑', color: 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]' },
    { minLevel: 76, maxLevel: Infinity, name: 'National Level Hunter', emoji: '🌟', color: 'text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,1)]' },
];

// ═══════════════════ TITLE SYSTEM (Solo Leveling) ═══════════════════
export interface TitleTier {
    minLevel: number;
    title: string;
    color: string;
}

export const TITLE_TIERS: TitleTier[] = [
    { minLevel: 1,   title: 'Shadow Recruit',         color: 'text-slate-400' },
    { minLevel: 5,   title: 'Iron Shadow Soldier',    color: 'text-slate-300' },
    { minLevel: 10,  title: 'Shadow Knight',          color: 'text-emerald-400' },
    { minLevel: 15,  title: 'Blood Red Commander',    color: 'text-red-400' },
    { minLevel: 20,  title: "Demon King's General",   color: 'text-purple-400' },
    { minLevel: 30,  title: 'Shadow Sovereign',       color: 'text-blue-400' },
    { minLevel: 50,  title: 'Shadow Monarch',         color: 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]' },
    { minLevel: 75,  title: 'Ruler of the Dead',      color: 'text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]' },
    { minLevel: 100, title: 'The Absolute Being',     color: 'text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,1)]' },
];

export const getTitleForLevel = (level: number): TitleTier => {
    const safeLevel = typeof level === 'number' && !isNaN(level) ? level : 1;
    for (let i = TITLE_TIERS.length - 1; i >= 0; i--) {
        if (safeLevel >= TITLE_TIERS[i].minLevel) return TITLE_TIERS[i];
    }
    return TITLE_TIERS[0];
};

// ═══════════════════ STREAK TITLE SYSTEM ═══════════════════
export interface StreakTitleTier {
    minDays: number;
    title: string;
    color: string;
    emoji: string;
    description: string;
    rarity: 'iron' | 'bronze' | 'silver' | 'purple' | 'gold' | 'legendary' | 'mythic';
}

export const STREAK_TITLE_TIERS: StreakTitleTier[] = [
    { minDays: 7,    title: 'Spark Bearer',        emoji: '✨', rarity: 'iron',
      color: 'text-amber-300',
      description: 'One week of unbroken dedication.' },
    { minDays: 30,   title: 'Ember Walker',        emoji: '🔥', rarity: 'bronze',
      color: 'text-orange-400',
      description: 'A full month of consistency — the fire catches.' },
    { minDays: 100,  title: 'Adept of the Flame',  emoji: '🔥', rarity: 'purple',
      color: 'text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]',
      description: 'Hundred-day pilgrim. Few make it this far.' },
    { minDays: 365,  title: 'Blazing Vanguard',    emoji: '☄️', rarity: 'gold',
      color: 'text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]',
      description: 'A year-long streak. Discipline incarnate.' },
    { minDays: 500,  title: 'Lord of the Inferno', emoji: '👑', rarity: 'legendary',
      color: 'text-rose-500 drop-shadow-[0_0_14px_rgba(244,63,94,0.9)]',
      description: 'Five hundred days forged in flame.' },
    { minDays: 1000, title: 'Eternal Phoenix',     emoji: '🦅', rarity: 'mythic',
      color: 'text-yellow-400 drop-shadow-[0_0_18px_rgba(250,204,21,1)]',
      description: 'A thousand suns. Legend beyond extinction.' },
];

export const getStreakTitleForDays = (days: number): StreakTitleTier | null => {
    const safe = typeof days === 'number' && !isNaN(days) ? days : 0;
    for (let i = STREAK_TITLE_TIERS.length - 1; i >= 0; i--) {
        if (safe >= STREAK_TITLE_TIERS[i].minDays) return STREAK_TITLE_TIERS[i];
    }
    return null;
};

// XP needed for each level (cumulative)
export const getXPForLevel = (level: number): number => {
    // Formula: L1=0, L2=200, L3=500... Delta increases by 100 each level
    return 50 * (level - 1) * (level + 2);
};

export const getLevelFromXP = (xp: number): number => {
    const safeXP = typeof xp === 'number' && !isNaN(xp) ? xp : 0;
    let level = 1;
    while (getXPForLevel(level + 1) <= safeXP) {
        level++;
    }
    return level;
};

export const getRankForLevel = (level: number): RankTier => {
    const safeLevel = typeof level === 'number' && !isNaN(level) ? level : 1;
    return RANK_TIERS.find(r => safeLevel >= r.minLevel && safeLevel <= r.maxLevel) || RANK_TIERS[0];
};

export const getXPProgress = (totalXP: number): { current: number; needed: number; percent: number } => {
    const safeXP = typeof totalXP === 'number' && !isNaN(totalXP) ? totalXP : 0;
    const level = getLevelFromXP(safeXP);
    const currentLevelXP = getXPForLevel(level);
    const nextLevelXP = getXPForLevel(level + 1);
    const progress = safeXP - currentLevelXP;
    const needed = nextLevelXP - currentLevelXP;
    return {
        current: progress,
        needed: needed,
        percent: needed > 0 ? Math.min(100, Math.floor((progress / needed) * 100)) : 0,
    };
};

// ═══════════════════ ACHIEVEMENT BADGES (Project Chimera Phase 2) ═══════════════════
// Specific milestone medals on top of TITLE_TIERS. Each achievement is evaluated
// against the user's full WorkoutLog history + GymProfile and either unlocked or
// shown locked in the BadgeGrid. Rarity drives the badge-* CSS class.
export type AchievementRarity = 'iron' | 'bronze' | 'silver' | 'purple' | 'gold' | 'legendary' | 'mythic';
export type AchievementCategory = 'workout' | 'streak' | 'xp' | 'rank' | 'habit' | 'special';

// Tier-driven reward scale. Used as the default when an achievement omits
// xpBonus/tokenReward — keeps reward economy consistent across the catalog.
export const REWARDS_BY_RARITY: Record<AchievementRarity, { xp: number; tokens: number }> = {
    iron:      { xp: 50,    tokens: 0 },
    bronze:    { xp: 100,   tokens: 0 },
    silver:    { xp: 250,   tokens: 0 },
    purple:    { xp: 500,   tokens: 1 },
    gold:      { xp: 1000,  tokens: 1 },
    legendary: { xp: 5000,  tokens: 2 },
    mythic:    { xp: 10000, tokens: 3 },
};

export interface Achievement {
    id: string;
    label: string;
    description: string;
    emoji: string;
    rarity: AchievementRarity;
    /** Returns true when the user has earned this achievement. */
    isUnlocked: (logs: WorkoutLog[], profile: GymProfile, habits?: Habit[]) => boolean;

    // ── Phase 5 additions (all optional; defaults derive from rarity) ──
    category?: AchievementCategory;
    /** Numeric target for the progress bar (e.g. 100 for "complete 100 sets"). */
    requirement?: number;
    /** Current value toward `requirement`. Boolean/multi-condition achievements omit this. */
    getProgress?: (logs: WorkoutLog[], profile: GymProfile, habits?: Habit[]) => number;
    /** Override the rarity-default reward XP. */
    xpBonus?: number;
    /** Override the rarity-default reward tokens. */
    tokenReward?: number;
}

const countWorkoutsHittingMuscles = (logs: WorkoutLog[], muscles: MuscleGroup[]): number =>
    logs.filter(l => (l.muscleGroups || []).some(m => muscles.includes(m))).length;

const countSets = (logs: WorkoutLog[]): number =>
    logs.reduce((s, l) => s + (l.exercises || []).reduce((ss, e) => ss + (e.sets || 0), 0), 0);

const exerciseNameHas = (logs: WorkoutLog[], pattern: RegExp): number =>
    logs.filter(l => (l.exercises || []).some(e => pattern.test(e.name || ''))).length;

const hasWorkoutAtHour = (logs: WorkoutLog[], predicate: (h: number) => boolean): boolean =>
    logs.some(l => {
        if (!l.timestamp) return false;
        const h = new Date(l.timestamp).getHours();
        return !isNaN(h) && predicate(h);
    });

// ═══════════════════ HABIT HELPERS (Phase 5) ═══════════════════
// Counts the longest run of consecutive days where ALL provided habits were
// completed — used by habit-streak achievements.
const consecutiveAllHabitDays = (habits: Habit[] | undefined): number => {
    if (!habits || habits.length === 0) return 0;
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    let streak = 0;
    while (true) {
        const dateStr = day.toLocaleDateString('en-CA');
        const allDone = habits.every(h => (h.completedDates || []).includes(dateStr));
        if (!allDone) break;
        streak++;
        day.setDate(day.getDate() - 1);
    }
    return streak;
};

const totalHabitCompletions = (habits: Habit[] | undefined): number =>
    (habits || []).reduce((s, h) => s + (h.completedDates?.length || 0), 0);

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first_blood',
        label: 'First Blood',
        description: 'Logged your very first workout.',
        emoji: '🩸',
        rarity: 'iron',
        category: 'workout',
        requirement: 1,
        getProgress: (logs) => logs.length,
        isUnlocked: (logs) => logs.length >= 1,
    },
    {
        id: 'iron_apprentice',
        label: 'Iron Apprentice',
        description: 'Completed 10 lifetime workouts.',
        emoji: '⚒️',
        rarity: 'iron',
        category: 'workout',
        requirement: 10,
        getProgress: (logs) => logs.length,
        isUnlocked: (logs) => logs.length >= 10,
    },
    {
        id: 'squat_king',
        label: 'Squat King',
        description: 'Crushed 10 leg-focused sessions.',
        emoji: '🦵',
        rarity: 'silver',
        category: 'workout',
        requirement: 10,
        getProgress: (logs) => countWorkoutsHittingMuscles(logs, ['quads', 'hamstrings', 'glutes', 'calves']),
        isUnlocked: (logs) =>
            countWorkoutsHittingMuscles(logs, ['quads', 'hamstrings', 'glutes', 'calves']) >= 10,
    },
    {
        id: 'push_phenom',
        label: 'Push Phenom',
        description: '15 sessions hitting chest/shoulders/triceps.',
        emoji: '🤜',
        rarity: 'silver',
        category: 'workout',
        requirement: 15,
        getProgress: (logs) => countWorkoutsHittingMuscles(logs, ['chest', 'shoulders', 'triceps']),
        isUnlocked: (logs) =>
            countWorkoutsHittingMuscles(logs, ['chest', 'shoulders', 'triceps']) >= 15,
    },
    {
        id: 'pull_master',
        label: 'Pull Master',
        description: '15 sessions hitting back & biceps.',
        emoji: '🪝',
        rarity: 'silver',
        category: 'workout',
        requirement: 15,
        getProgress: (logs) => countWorkoutsHittingMuscles(logs, ['lats', 'traps', 'lower_back', 'biceps']),
        isUnlocked: (logs) =>
            countWorkoutsHittingMuscles(logs, ['lats', 'traps', 'lower_back', 'biceps']) >= 15,
    },
    {
        id: 'core_forged',
        label: 'Core Forged',
        description: 'Logged 10 workouts touching abs or obliques.',
        emoji: '🧱',
        rarity: 'bronze',
        category: 'workout',
        requirement: 10,
        getProgress: (logs) => countWorkoutsHittingMuscles(logs, ['abs', 'obliques']),
        isUnlocked: (logs) => countWorkoutsHittingMuscles(logs, ['abs', 'obliques']) >= 10,
    },
    {
        id: 'centurion',
        label: 'Centurion',
        description: 'Completed 100 sets across all sessions.',
        emoji: '💯',
        rarity: 'bronze',
        category: 'workout',
        requirement: 100,
        getProgress: (logs) => countSets(logs),
        isUnlocked: (logs) => countSets(logs) >= 100,
    },
    {
        id: 'volume_vanguard',
        label: 'Volume Vanguard',
        description: 'Accumulated 5,000 lifetime XP.',
        emoji: '📈',
        rarity: 'purple',
        category: 'xp',
        requirement: 5000,
        getProgress: (_logs, p) => p.totalXP || 0,
        isUnlocked: (_logs, p) => (p.totalXP || 0) >= 5000,
    },
    {
        id: 'iron_discipline',
        label: 'Iron Discipline',
        description: 'Held a 7-day workout streak.',
        emoji: '🔗',
        rarity: 'purple',
        category: 'streak',
        requirement: 7,
        getProgress: (_logs, p) => p.longestStreak || 0,
        isUnlocked: (_logs, p) => (p.longestStreak || 0) >= 7,
    },
    {
        id: 'early_bird',
        label: 'Early Bird',
        description: 'Trained before 7 AM at least once.',
        emoji: '🌅',
        rarity: 'bronze',
        category: 'special',
        // Boolean — no progress bar.
        isUnlocked: (logs) => hasWorkoutAtHour(logs, h => h < 7),
    },
    {
        id: 'night_owl',
        label: 'Night Owl',
        description: 'Trained after 10 PM at least once.',
        emoji: '🌙',
        rarity: 'bronze',
        category: 'special',
        isUnlocked: (logs) => hasWorkoutAtHour(logs, h => h >= 22),
    },
    {
        id: 'first_1rm',
        label: 'First 1RM Logged',
        description: 'Logged a heavy single — strength baseline set.',
        emoji: '🏋️',
        rarity: 'silver',
        category: 'workout',
        isUnlocked: (logs) =>
            logs.some(l => (l.exercises || []).some(e => (e.reps || 0) === 1 && (e.weight || 0) > 0)),
    },
    {
        id: 'all_week_warrior',
        label: 'All-Week Warrior',
        description: 'Trained on 5 distinct days within a single week.',
        emoji: '🗓️',
        rarity: 'purple',
        category: 'streak',
        // Multi-condition (sliding window) — skip progress bar.
        isUnlocked: (logs) => {
            // Walk a 7-day sliding window; any window with ≥5 unique dates wins.
            const sortedDates = Array.from(new Set(logs.map(l => l.date))).filter(Boolean).sort();
            const DAY = 86_400_000;
            for (let i = 0; i < sortedDates.length; i++) {
                const anchor = new Date(sortedDates[i] + 'T00:00:00').getTime();
                const window = sortedDates.filter(d => {
                    const t = new Date(d + 'T00:00:00').getTime();
                    return t >= anchor && t < anchor + 7 * DAY;
                });
                if (window.length >= 5) return true;
            }
            return false;
        },
    },
    {
        id: 'compound_kingpin',
        label: 'Compound Kingpin',
        description: 'Logged squat, deadlift, AND bench press.',
        emoji: '👑',
        rarity: 'gold',
        category: 'workout',
        // Three-condition — skip progress bar.
        isUnlocked: (logs) =>
            exerciseNameHas(logs, /\bsquat\b/i) > 0 &&
            exerciseNameHas(logs, /\bdeadlift\b/i) > 0 &&
            exerciseNameHas(logs, /\bbench\s*press\b/i) > 0,
    },
    {
        id: 'hundred_day_hunter',
        label: '100-Day Hunter',
        description: 'Held a 100-day workout streak.',
        emoji: '🛡️',
        rarity: 'gold',
        category: 'streak',
        requirement: 100,
        getProgress: (_logs, p) => p.longestStreak || 0,
        isUnlocked: (_logs, p) => (p.longestStreak || 0) >= 100,
    },
    {
        id: 'monarch_ascended',
        label: 'Monarch Ascended',
        description: 'Reached Level 50 — the Shadow Monarch tier.',
        emoji: '🌑',
        rarity: 'legendary',
        category: 'rank',
        requirement: 50,
        getProgress: (_logs, p) => p.level || 0,
        isUnlocked: (_logs, p) => (p.level || 0) >= 50,
    },
    {
        id: 'absolute_being',
        label: 'Absolute Being',
        description: 'Reached Level 100 — only a few have ever stood here.',
        emoji: '✨',
        rarity: 'mythic',
        category: 'rank',
        requirement: 100,
        getProgress: (_logs, p) => p.level || 0,
        isUnlocked: (_logs, p) => (p.level || 0) >= 100,
    },

    // ═══════════════════ HABIT ACHIEVEMENTS (Phase 5) ═══════════════════
    {
        id: 'habit_starter',
        label: 'Habit Starter',
        description: 'Completed all daily habits 7 days running.',
        emoji: '✅',
        rarity: 'bronze',
        category: 'habit',
        requirement: 7,
        getProgress: (_logs, _p, habits) => consecutiveAllHabitDays(habits),
        isUnlocked: (_logs, _p, habits) => consecutiveAllHabitDays(habits) >= 7,
    },
    {
        id: 'consistency_king',
        label: 'Consistency King',
        description: 'Completed all daily habits 30 days running.',
        emoji: '🏅',
        rarity: 'silver',
        category: 'habit',
        requirement: 30,
        getProgress: (_logs, _p, habits) => consecutiveAllHabitDays(habits),
        isUnlocked: (_logs, _p, habits) => consecutiveAllHabitDays(habits) >= 30,
    },
    {
        id: 'discipline_master',
        label: 'Discipline Master',
        description: 'Completed all daily habits 100 days running.',
        emoji: '🏆',
        rarity: 'gold',
        category: 'habit',
        requirement: 100,
        getProgress: (_logs, _p, habits) => consecutiveAllHabitDays(habits),
        isUnlocked: (_logs, _p, habits) => consecutiveAllHabitDays(habits) >= 100,
    },
    {
        id: 'thousand_acts',
        label: 'Thousand Acts',
        description: 'Logged 1,000 lifetime habit completions.',
        emoji: '🌌',
        rarity: 'purple',
        category: 'habit',
        requirement: 1000,
        getProgress: (_logs, _p, habits) => totalHabitCompletions(habits),
        isUnlocked: (_logs, _p, habits) => totalHabitCompletions(habits) >= 1000,
    },
];

export const evaluateAchievements = (
    logs: WorkoutLog[],
    profile: GymProfile,
    habits?: Habit[],
) =>
    ACHIEVEMENTS.map(a => ({ ...a, unlocked: a.isUnlocked(logs, profile, habits) }));

// ═══════════════════ XP CALCULATION ═══════════════════
export const calculateWorkoutXP = (
    exercises: { name: string; sets: number; reps: number; weight: number }[],
    exerciseXPMap: Record<string, number>, // name → xpPerSet
    muscleGroupCount: number
): number => {
    let totalXP = 0;

    // XP per set completed
    for (const ex of exercises) {
        const xpPerSet = exerciseXPMap[ex.name] || 15; // fallback
        totalXP += xpPerSet * ex.sets;
    }

    // Bonus: +25% if 3+ different muscle groups
    if (muscleGroupCount >= 3) {
        totalXP = Math.floor(totalXP * 1.25);
    }

    // Completion bonus
    totalXP += 50;

    return totalXP;
};

// ═══════════════════ LEADERBOARD ═══════════════════
export interface LeaderboardEntry {
    name: string;
    emoji: string;
    xp: number;
    level: number;
    rank: string;
    rankEmoji: string;
    isPlayer: boolean;
}

export const generateLeaderboard = (playerXP: number, playerName: string = 'User'): LeaderboardEntry[] => {
    const playerLevel = getLevelFromXP(playerXP);
    const playerRank = getRankForLevel(playerLevel);

    return [{
        name: playerName,
        emoji: '🧑',
        xp: playerXP,
        level: playerLevel,
        rank: playerRank.name,
        rankEmoji: playerRank.emoji,
        isPlayer: true,
    }];
};

// ═══════════════════ MONTH HELPERS (Monthly League) ═══════════════════
/** Returns the current month key "YYYY-MM" used as the monthly-XP bucket. */
export const getCurrentMonthKey = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Resets monthly counters if the stored `currentMonth` is stale (new month rolled over).
 * Pure function — returns a new profile object; does not mutate input.
 */
export const rolloverMonthlyIfNeeded = (profile: GymProfile): GymProfile => {
    const thisMonth = getCurrentMonthKey();
    if (profile.currentMonth === thisMonth) return profile;
    return {
        ...profile,
        monthlyXP: 0,
        monthlyWorkouts: 0,
        currentMonth: thisMonth,
    };
};

// ═══════════════════ DEFAULT PROFILE ═══════════════════
export const DEFAULT_GYM_PROFILE: GymProfile = {
    totalXP: 0,
    level: 1,
    rank: 'E-Rank',
    rankEmoji: '🥉',
    title: 'Shadow Recruit',
    workoutsCompleted: 0,
    totalSetsCompleted: 0,
    muscleXP: {
        chest: 0, shoulders: 0, triceps: 0,
        biceps: 0, forearms: 0,
        lats: 0, traps: 0, lower_back: 0,
        abs: 0, obliques: 0,
        quads: 0, hamstrings: 0, glutes: 0, calves: 0,
    },
    monthlyXP: 0,
    monthlyWorkouts: 0,
    currentMonth: getCurrentMonthKey(),
    currentStreak: 0,
    longestStreak: 0,
    lastWorkoutDate: undefined,
    streakFreezeTokens: 0,
    tokenProtectedDates: [],
    streakProtectionHistory: [],
    unlockedAchievementIds: [],
};

// Update profile after workout
// `allLogs` (optional) — the full updated log list *including* the newly-added workout;
// when provided we recompute currentStreak/longestStreak so persistent profile stays accurate.
export const updateProfileAfterWorkout = (
    profile: GymProfile,
    xpEarned: number,
    musclesWorked: MuscleGroup[],
    totalSets: number,
    allLogs?: WorkoutLog[],
): GymProfile => {
    // Ensure monthly counters reflect the current month before we add to them.
    const rolled = rolloverMonthlyIfNeeded(profile);

    const newTotalXP = (rolled.totalXP || 0) + xpEarned;
    const newLevel = getLevelFromXP(newTotalXP);
    const newRank = getRankForLevel(newLevel);
    const newTitle = getTitleForLevel(newLevel);

    const newMuscleXP = { ...rolled.muscleXP };
    const xpPerMuscle = Math.floor(xpEarned / Math.max(musclesWorked?.length, 1));
    for (const muscle of musclesWorked) {
        newMuscleXP[muscle] = (newMuscleXP[muscle] || 0) + xpPerMuscle;
    }

    const today = new Date().toLocaleDateString('en-CA');
    // Pass through any Streak Freeze Token-protected dates so the streak math
    // continues to honor them after a workout log.
    const protectedDates = rolled.tokenProtectedDates || [];
    const currentStreak = allLogs
        ? calculateStreak(allLogs, protectedDates)
        : (rolled.currentStreak || 0) + 1;
    const longestStreak = Math.max(rolled.longestStreak || 0, currentStreak);

    return {
        ...rolled, // preserve token fields and any future GymProfile additions
        totalXP: newTotalXP,
        level: newLevel,
        rank: newRank.name,
        rankEmoji: newRank.emoji,
        title: newTitle.title,
        workoutsCompleted: (rolled.workoutsCompleted || 0) + 1,
        totalSetsCompleted: (rolled.totalSetsCompleted || 0) + totalSets,
        muscleXP: newMuscleXP,
        monthlyXP: (rolled.monthlyXP || 0) + xpEarned,
        monthlyWorkouts: (rolled.monthlyWorkouts || 0) + 1,
        currentMonth: rolled.currentMonth,
        currentStreak,
        longestStreak,
        lastWorkoutDate: today,
    };
};

// Recalculate entire profile from history (for sync/deletion).
// `existing` (optional) is the current profile — passed in so we don't lose
// the token economy state (streakFreezeTokens, tokenProtectedDates, history)
// when the caller does a "rebuild from logs" sync.
export const recalculateGymProfile = (
    logs: WorkoutLog[],
    existing?: GymProfile,
): GymProfile => {
    const profile: GymProfile = JSON.parse(JSON.stringify(DEFAULT_GYM_PROFILE));
    const thisMonth = getCurrentMonthKey();

    // Preserve the token economy + achievement record across recalculation.
    if (existing) {
        profile.streakFreezeTokens = existing.streakFreezeTokens || 0;
        profile.lastTokenEarned = existing.lastTokenEarned;
        profile.lastTokenUsed = existing.lastTokenUsed;
        profile.tokenProtectedDates = existing.tokenProtectedDates || [];
        profile.streakProtectionHistory = existing.streakProtectionHistory || [];
        profile.unlockedAchievementIds = existing.unlockedAchievementIds || [];
    }

    logs.forEach(log => {
        const xp = log.xpEarned || 0;
        const sets = log.exercises.reduce((s, e) => s + e.sets, 0);
        const muscles = log.muscleGroups || [];

        profile.totalXP += xp;
        profile.workoutsCompleted += 1;
        profile.totalSetsCompleted += sets;

        // Monthly bucket — only count workouts from the current month
        if (log.date && log.date.startsWith(thisMonth)) {
            profile.monthlyXP = (profile.monthlyXP || 0) + xp;
            profile.monthlyWorkouts = (profile.monthlyWorkouts || 0) + 1;
        }

        if (muscles?.length > 0) {
            const xpPerMuscle = Math.floor(xp / muscles?.length);
            muscles.forEach(m => {
                profile.muscleXP[m] = (profile.muscleXP[m] || 0) + xpPerMuscle;
            });
        }
    });

    // Streak fields — honor token-protected dates so a recalc doesn't undo
    // a freeze the user already burned.
    profile.currentStreak = calculateStreak(logs, profile.tokenProtectedDates || []);
    profile.longestStreak = calculateLongestStreak(logs, profile.tokenProtectedDates || []);
    profile.lastWorkoutDate = logs.length > 0
        ? logs.map(l => l.date).sort().slice(-1)[0]
        : undefined;
    profile.currentMonth = thisMonth;

    // Recalculate Level/Rank/Title
    profile.level = getLevelFromXP(profile.totalXP);
    const rank = getRankForLevel(profile.level);
    profile.rank = rank.name;
    profile.rankEmoji = rank.emoji;
    const title = getTitleForLevel(profile.level);
    profile.title = title.title;

    return profile;
};

/**
 * Longest historical streak — scans unique workout dates chronologically
 * and tracks the longest run of consecutive days. Optional `protectedDates`
 * (Phase 4: Streak Protection) are merged into the date set so a token-bridged
 * gap doesn't reset the streak.
 */
export const calculateLongestStreak = (
    workoutLogs: WorkoutLog[],
    protectedDates: string[] = [],
): number => {
    const hasWorkouts = workoutLogs && workoutLogs.length > 0;
    const hasProtected = protectedDates.length > 0;
    if (!hasWorkouts && !hasProtected) return 0;

    const dates = new Set<string>();
    for (const l of workoutLogs || []) if (l.date) dates.add(l.date);
    for (const d of protectedDates) if (d) dates.add(d);

    const uniqueDates = Array.from(dates).sort(); // ascending — YYYY-MM-DD sorts lexicographically

    let longest = 1;
    let current = 1;
    const DAY_MS = 86_400_000;

    for (let i = 1; i < uniqueDates.length; i++) {
        const prev = new Date(uniqueDates[i - 1] + 'T00:00:00').getTime();
        const curr = new Date(uniqueDates[i] + 'T00:00:00').getTime();
        const diffDays = Math.round((curr - prev) / DAY_MS);

        if (diffDays === 1) {
            current++;
            if (current > longest) longest = current;
        } else {
            current = 1;
        }
    }

    return longest;
};

// ═══════════════════ STREAK CALCULATION ═══════════════════
// Optional `protectedDates` (Phase 4) are dates a Streak Freeze Token bridged.
// They count as filled days alongside actual workouts so the chain survives.
export const calculateStreak = (
    workoutLogs: WorkoutLog[],
    protectedDates: string[] = [],
): number => {
    const hasWorkouts = workoutLogs && workoutLogs.length > 0;
    const hasProtected = protectedDates.length > 0;
    if (!hasWorkouts && !hasProtected) return 0;

    const filledDates = new Set<string>();
    for (const l of workoutLogs || []) if (l.date) filledDates.add(l.date);
    for (const d of protectedDates) if (d) filledDates.add(d);

    let streak = 0;
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const todayStr = currentDate.toLocaleDateString('en-CA');
    let hasFilledToday = filledDates.has(todayStr);

    const checkDate = new Date(currentDate);
    if (!hasFilledToday) {
        checkDate.setDate(checkDate.getDate() - 1);
        const yesterdayStr = checkDate.toLocaleDateString('en-CA');
        if (!filledDates.has(yesterdayStr)) {
            return 0;
        }
    }

    while (true) {
        const dateStr = checkDate.toLocaleDateString('en-CA');
        if (filledDates.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
};
