import { GymProfile, MuscleGroup, WorkoutLog } from './types';

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
    const currentStreak = allLogs ? calculateStreak(allLogs) : (rolled.currentStreak || 0) + 1;
    const longestStreak = Math.max(rolled.longestStreak || 0, currentStreak);

    return {
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

// Recalculate entire profile from history (for sync/deletion)
export const recalculateGymProfile = (logs: WorkoutLog[]): GymProfile => {
    const profile: GymProfile = JSON.parse(JSON.stringify(DEFAULT_GYM_PROFILE));
    const thisMonth = getCurrentMonthKey();

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

    // Streak fields
    profile.currentStreak = calculateStreak(logs);
    profile.longestStreak = calculateLongestStreak(logs);
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
 * and tracks the longest run of consecutive days.
 */
export const calculateLongestStreak = (workoutLogs: WorkoutLog[]): number => {
    if (!workoutLogs || workoutLogs.length === 0) return 0;

    const uniqueDates = Array.from(new Set(workoutLogs.map(l => l.date)))
        .filter(Boolean)
        .sort(); // ascending — YYYY-MM-DD sorts lexicographically

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
export const calculateStreak = (workoutLogs: WorkoutLog[]): number => {
    if (!workoutLogs || workoutLogs?.length === 0) return 0;

    const workoutDates = new Set(workoutLogs.map(l => l.date));

    let streak = 0;
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const todayStr = currentDate.toLocaleDateString('en-CA');
    let hasWorkedOutToday = workoutDates.has(todayStr);

    const checkDate = new Date(currentDate);
    if (!hasWorkedOutToday) {
        checkDate.setDate(checkDate.getDate() - 1);
        const yesterdayStr = checkDate.toLocaleDateString('en-CA');
        if (!workoutDates.has(yesterdayStr)) {
            return 0;
        }
    }

    while (true) {
        const dateStr = checkDate.toLocaleDateString('en-CA');
        if (workoutDates.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
};
