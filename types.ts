export type Location = 'Bandung' | 'Bekasi' | 'Tasikmalaya';

export enum View {
  DASHBOARD = 'dashboard',
  GYM = 'gym',
  FINANCE = 'finance',
  HABITS = 'habits',
  CALCULATOR = 'calculator',
  PROFILE = 'profile',
  ADMIN = 'admin',
}

export type MuscleGroup =
  | 'chest' | 'shoulders' | 'triceps'
  | 'biceps' | 'forearms'
  | 'lats' | 'traps' | 'lower_back'
  | 'abs' | 'obliques'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves';

export interface FirestoreExercise {
  id: string;
  name: string;
  bodyPart: string;
  targetMuscle: string;
  equipment: string;
  secondaryMuscles: string[];
  instructions: string[];
  gifUrl: string;
  type: string;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  xpPerSet: number; // difficulty * 10
  defaultSets: number;
  defaultReps: number;
  videoUrl: string; // YouTube link
  tips: string; // Indonesian
}

export interface WorkoutLog {
  id: string;
  date: string;
  timestamp?: string; // ISO 8601 for precise recovery timing
  type: string; // e.g. "Chest, Shoulders" or legacy "Push"
  muscleGroups: MuscleGroup[];
  exercises: { name: string; sets: number; reps: number; weight: number }[];
  coreWork: boolean;
  notes?: string;
  xpEarned: number;
}

export interface GymProfile {
  totalXP: number;           // Lifetime XP — permanent, drives level & rank
  level: number;
  rank: string;
  rankEmoji: string;
  title: string;             // Solo Leveling title, e.g. "Shadow Monarch"
  workoutsCompleted: number; // Lifetime
  totalSetsCompleted: number;
  muscleXP: Record<MuscleGroup, number>;

  // ── Monthly League (resets on the 1st of every month) ──
  monthlyXP?: number;
  monthlyWorkouts?: number;
  currentMonth?: string;     // "YYYY-MM" — the month the monthly counters belong to

  // ── Streak (persisted so leaderboards/profiles don't need full log history) ──
  currentStreak?: number;
  longestStreak?: number;
  lastWorkoutDate?: string;  // "YYYY-MM-DD"

  // ── Streak Protection (Phase 4) ──
  // Token economy: earn by completing all daily habits, max 3.
  // Auto-applied when a missed day would otherwise break the streak.
  streakFreezeTokens?: number;             // 0–3
  lastTokenEarned?: string;                // "YYYY-MM-DD" — caps earning at 1/day
  lastTokenUsed?: string;                  // ISO timestamp — caps protection at 1/day
  tokenProtectedDates?: string[];          // dates a token bridged; treated as filled by streak math
  streakProtectionHistory?: { date: string; streakSaved: number }[];
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: 'Needs' | 'Wants' | 'Future' | 'Salary' | 'Freelance' | 'Gift' | 'Other';
  description: string;
  isMobility: boolean;
  subCategory?: string;
}

export interface Investment {
  id: string;
  ticker: string;
  type: 'Stock' | 'Crypto' | 'Mutual Fund' | 'Gold';
  shares: number;
  avgBuyPrice: number;
  currentPrice: number;
  lastUpdated: string;
}

export interface Habit {
  id: string;
  name: string;
  cue?: string;
  streak: number;
  completedDates: string[];
}

export type ExperienceLevel = 'Pemula' | 'Menengah' | 'Lanjut';
export type IdealDuration = '30 Menit' | '45 Menit' | '>1 Jam';
export type FocusArea = 'Dada & Lengan' | 'Kaki & Bokong' | 'Core' | 'Seluruh Tubuh';
export type Environment = 'Home' | 'Gym';

// Solo Leveling-style 5-stat character signature derived from workout patterns.
// All values clamped to 0–100 in attributeService.
export interface Attributes {
  STR: number; // Strength — heavy compound lifts
  VIT: number; // Vitality — workout volume + streak consistency
  AGI: number; // Agility — cardio/HIIT/bodyweight
  PER: number; // Perception — habit discipline
  INT: number; // Intelligence — exercise/muscle variety
}

export interface UserState {
  name: string;
  isOnboarded: boolean;
  height: number; // cm
  weight: number; // kg
  gender: 'Male' | 'Female';
  dateOfBirth: string; // ISO 8601 YYYY-MM-DD; age is derived via calculateAge()
  fitnessGoal: 'Lose Weight' | 'Build Muscle' | 'Keep Fit';
  activityLevel: 'Sedentary' | 'Light' | 'Moderate' | 'Active';
  dailyBudget: number; // Daily spending limit
  // ── Phase 8: Onboarding enrichments ──
  experienceLevel?: ExperienceLevel;
  idealDuration?: IdealDuration;
  focusArea?: FocusArea;
  // ── Project Chimera Phase 1: Workout context (mirrored to Firestore preferences) ──
  environment?: Environment;
  userEquipment?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface UserProfile {
  role: 'user' | 'admin';
}

export interface GymSchedule {
  [day: string]: string; // e.g. "monday": "Push - Chest, Shoulders"
}

// Recovery hours by muscle group size
// Small muscles: 24-48h (avg 36h)
// Large muscles: 48-72h (avg 60h)
export const MUSCLE_RECOVERY_HOURS: Record<MuscleGroup, number> = {
  chest: 60,
  shoulders: 48,
  triceps: 36,
  biceps: 36,
  forearms: 36,
  lats: 60,
  traps: 48,
  lower_back: 60,
  abs: 36,
  obliques: 36,
  quads: 60,
  hamstrings: 60,
  glutes: 60,
  calves: 36,
};

// ── Phase 9: Gender-based recovery modifier ────────────────────────────
// Sports-science meta-analyses suggest female lifters recover ~15–20%
// faster than males due to lower absolute load + better metabolite
// clearance. We apply 0.82× (≈18% reduction) to the baseline hours.
export const FEMALE_RECOVERY_MULTIPLIER = 0.82;

/**
 * Returns the muscle's recovery threshold in hours, adjusted for gender.
 * Female users recover ~18% faster, so a 48h baseline becomes ~40h.
 */
export const getRecoveryHours = (
  muscle: MuscleGroup,
  gender?: 'Male' | 'Female',
): number => {
  const base = MUSCLE_RECOVERY_HOURS[muscle] || 48;
  return gender === 'Female' ? Math.round(base * FEMALE_RECOVERY_MULTIPLIER) : base;
};