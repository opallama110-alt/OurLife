import { Transaction, Habit, WorkoutLog, UserState, GymProfile, GymSchedule, UserProfile, ExerciseDefinition, MuscleGroup } from '../types';
import { INITIAL_HABITS } from '../config/constants';
import {
  DEFAULT_GYM_PROFILE,
  rolloverMonthlyIfNeeded,
  getCurrentMonthKey,
  getLevelFromXP,
  getRankForLevel,
  getTitleForLevel,
} from './gamificationService';
import { calculateAge, getLocalDateString } from '../utils/dateUtils';
import { rtdb, auth, db } from '../../firebase-config';
import { ref, get, set, update, onValue, off } from 'firebase/database';
import { collection, query as firestoreQuery, orderBy, limit, getDocs, onSnapshot, doc, setDoc } from 'firebase/firestore';

// ═══════════ LOCAL IN-MEMORY CACHE ═══════════
// Ensures immediate synchronous reads for the React UI while RTDB syncs in the background.
type StoreCache = {
  workouts: WorkoutLog[];
  transactions: Transaction[];
  habits: Habit[];
  userState: UserState;
  gymProfile: GymProfile;
  gymSchedule: GymSchedule;
  profile: UserProfile;
};

export interface LeaderboardUser {
  id: string;
  name: string;
  photoURL: string;
  xp: number;
  level: number;
  rank: string;
  rankEmoji: string;
  title: string;
  monthlyXP: number;
  monthlyWorkouts: number;
  currentMonth: string;
  currentStreak: number;
  longestStreak: number;
}

interface PrivateUserDirectoryEntry {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  budget: number;
  weight: number;
  height: number;
  age: number;
  dateOfBirth: string;
  photoURL: string;
}

const LEADERBOARD_COLLECTION = 'leaderboard';

const _safeParse = (key: string, fallback: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch { return fallback; }
};

const localCache: StoreCache = {
  workouts: _safeParse('jarvis_workouts', []),
  transactions: _safeParse('jarvis_transactions', []),
  habits: _safeParse('jarvis_habits', INITIAL_HABITS),
  userState: _safeParse('jarvis_user_state', {
    name: 'Naufal', isOnboarded: false, height: 170, weight: 60, gender: 'Male',
    dateOfBirth: '', fitnessGoal: 'Build Muscle', activityLevel: 'Moderate', dailyBudget: 150000
  }),
  gymProfile: _safeParse('jarvis_gym_profile', DEFAULT_GYM_PROFILE),
  gymSchedule: _safeParse('jarvis_gym_schedule', {
    monday: 'Push — Chest, Shoulders, Triceps',
    tuesday: 'Pull — Back, Biceps',
    wednesday: 'Legs — Quads, Hamstrings, Glutes',
    thursday: 'Push — Chest, Shoulders, Triceps',
    friday: 'Pull — Back, Biceps',
    saturday: 'Legs & Core',
    sunday: 'Rest Day 🧘',
  }),
  profile: _safeParse('jarvis_user_profile', { role: 'user' })
};

const normalizeCounter = (value: number | undefined, minimum = 0): number => {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.round(value as number));
};

const normalizePublicText = (value: string | null | undefined, fallback: string, maxLength: number): string => {
  const normalized = value?.trim().slice(0, maxLength);
  return normalized || fallback;
};

const buildLeaderboardDocument = (
  profile: GymProfile,
  identity?: { name?: string; photoURL?: string },
): Omit<LeaderboardUser, 'id'> => ({
  name: normalizePublicText(
    identity?.name ?? localCache.userState?.name ?? auth.currentUser?.displayName,
    'Anonymous',
    80,
  ),
  photoURL: normalizePublicText(
    identity?.photoURL ?? auth.currentUser?.photoURL,
    '',
    2048,
  ),
  xp: normalizeCounter(profile.totalXP),
  level: normalizeCounter(profile.level, 1),
  rank: normalizePublicText(profile.rank, 'E-Rank', 40),
  rankEmoji: normalizePublicText(profile.rankEmoji, '', 16),
  title: normalizePublicText(profile.title, 'Shadow Recruit', 80),
  monthlyXP: normalizeCounter(profile.monthlyXP),
  monthlyWorkouts: normalizeCounter(profile.monthlyWorkouts),
  currentMonth: profile.currentMonth || getCurrentMonthKey(),
  currentStreak: normalizeCounter(profile.currentStreak),
  longestStreak: normalizeCounter(profile.longestStreak),
});

// Simple event emitter for data changes
const listeners: (() => void)[] = [];
export const notifyCtx = () => listeners.forEach(l => l());

let activeSubscriptions: (() => void)[] = [];

// ═══════════ CROSS-PAGE WORKOUT LAUNCH STATE ═══════════
// Used by Dashboard "Today's Plan" / "Repeat Last" cards to hand a pre-built
// session to GymTracker, bypassing the muscle/exercise pickers entirely.
// Ephemeral — lives only in memory, not persisted.
export type PendingWorkout =
  | { kind: 'repeat'; exercises: ExerciseDefinition[]; type: string }
  | { kind: 'schedule'; muscles: MuscleGroup[]; label: string }
  | { kind: 'package'; muscles: MuscleGroup[]; label: string }
  | null;

let pendingWorkout: PendingWorkout = null;

// ═══════════ SYSTEM CHAT STATE ═══════════
// Last message returned by aiService.chat — surfaced as a Dashboard "System Briefing" card.

// One-time migration: the verdict persona/context was reshaped in commit 3d2fb15
// (finance pillar dropped + tone tightened). A verdict cached before that fix still
// renders the stale "Keuangan: ..."/"Maaf..." format until a fresh one is generated,
// so clear it once. Version-gated: fires only when the stored schema is older than
// VERDICT_SCHEMA_VERSION, then bumps the flag — never re-fires, never clears a valid
// post-fix verdict. Synchronous so it runs before the cache hydrates just below.
const VERDICT_SCHEMA_VERSION = 2;
(() => {
  try {
    const stored = parseInt(localStorage.getItem('ourlife_verdict_schema_v') || '0', 10) || 0;
    if (stored < VERDICT_SCHEMA_VERSION) {
      localStorage.removeItem('ourlife_last_system_message');
      localStorage.setItem('ourlife_verdict_schema_v', String(VERDICT_SCHEMA_VERSION));
    }
  } catch { /* localStorage unavailable — nothing to migrate */ }
})();

let lastSystemMessage: string = (() => {
  try { return localStorage.getItem('ourlife_last_system_message') || ''; } catch { return ''; }
})();

export const storageService = {
  subscribe: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
    }
  },

  // ═══════════ MODULAR FIREBASE RTDB OPERATIONS ═══════════

  saveData: async (path: string, data: any) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await set(ref(rtdb, `users/${user.uid}/${path}`), data);
    } catch (e) {
      console.error(`Error saving data to ${path}:`, e);
    }
  },

  loadData: async (path: string): Promise<any> => {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      const snapshot = await get(ref(rtdb, `users/${user.uid}/${path}`));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (e) {
      console.error(`Error loading data from ${path}:`, e);
      return null;
    }
  },

  listenToData: (path: string, callback: (data: any) => void) => {
    const user = auth.currentUser;
    if (!user) return () => { };
    const dbRef = ref(rtdb, `users/${user.uid}/${path}`);
    const listener = onValue(dbRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : null);
    }, (error) => {
      console.error(`Error listening to ${path}:`, error);
    });

    const unsubscribe = () => off(dbRef, 'value', listener);
    activeSubscriptions.push(unsubscribe);
    return unsubscribe;
  },

  // ═══════════ SYNC INITIALIZATION ═══════════

  syncUser: (user: any) => {
    // Clear old subscriptions
    activeSubscriptions.forEach(unsub => unsub());
    activeSubscriptions = [];

    if (!user) return;
    console.log("Syncing RTDB data for:", user.uid);

    // Listen to the entire user node to instantly hydrate localCache across devices
    storageService.listenToData('', (data) => {
      if (data) {
        if (data.workouts) localCache.workouts = data.workouts;
        if (data.transactions) localCache.transactions = data.transactions;
        if (data.habits) localCache.habits = data.habits;
        if (data.userState) localCache.userState = data.userState;
        if (data.gymProfile) localCache.gymProfile = data.gymProfile;
        if (data.gymSchedule) localCache.gymSchedule = data.gymSchedule;
        if (data.profile) localCache.profile = data.profile;

        // ── Monthly League rollover — if currentMonth is stale, zero monthly counters
        //    and persist back so every device sees fresh values on the 1st of the month.
        const thisMonth = getCurrentMonthKey();
        if (localCache.gymProfile && localCache.gymProfile.currentMonth !== thisMonth) {
          localCache.gymProfile = rolloverMonthlyIfNeeded(localCache.gymProfile);
          storageService.saveData('gymProfile', localCache.gymProfile);
          storageService.saveData('monthlyXP', 0);
          storageService.saveData('monthlyWorkouts', 0);
          storageService.saveData('currentMonth', thisMonth);
          // Keep Firestore mirror in lockstep for the Leaderboard / Compare UI
          const fsUser = auth.currentUser;
          if (fsUser) {
            setDoc(
              doc(db, LEADERBOARD_COLLECTION, fsUser.uid),
              buildLeaderboardDocument(localCache.gymProfile),
            ).catch(e => console.error('[syncUser] monthly rollover Firestore sync:', e));
          }
        }

        // Persist local cache for seamless reload
        localStorage.setItem('jarvis_workouts', JSON.stringify(localCache.workouts));
        localStorage.setItem('jarvis_transactions', JSON.stringify(localCache.transactions));
        localStorage.setItem('jarvis_habits', JSON.stringify(localCache.habits));
        localStorage.setItem('jarvis_user_state', JSON.stringify(localCache.userState));
        localStorage.setItem('jarvis_gym_profile', JSON.stringify(localCache.gymProfile));
        localStorage.setItem('jarvis_gym_schedule', JSON.stringify(localCache.gymSchedule));
        localStorage.setItem('jarvis_user_profile', JSON.stringify(localCache.profile));

        // Auto-fix onboard if it was corrupt
        if (localCache.userState && !localCache.userState.isOnboarded && localCache.userState.weight > 0) {
          localCache.userState.isOnboarded = true;
          storageService.saveData('userState', localCache.userState);
        }

        notifyCtx();
      } else {
        // First time user, sync defaults
        storageService.syncToRemote();
      }
    });
  },

  syncToRemote: async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Enforce Admin Role
    if (user.email === 'opallama110@gmail.com' && localCache.profile.role !== 'admin') {
      localCache.profile.role = 'admin';
    }

    const gp = localCache.gymProfile;
    const payload = {
      workouts: localCache.workouts,
      transactions: localCache.transactions,
      habits: localCache.habits,
      userState: localCache.userState,
      gymProfile: gp,
      gymSchedule: localCache.gymSchedule,
      profile: localCache.profile,

      role: localCache.profile.role,
      xp: gp.totalXP,
      name: localCache.userState.name,
      level: gp.level,
      rank: gp.rank,
      rankEmoji: gp.rankEmoji,
      title: gp.title || 'Shadow Recruit',

      // Monthly League + streak — flattened for cross-device reads
      monthlyXP: gp.monthlyXP ?? 0,
      monthlyWorkouts: gp.monthlyWorkouts ?? 0,
      currentMonth: gp.currentMonth ?? '',
      currentStreak: gp.currentStreak ?? 0,
      longestStreak: gp.longestStreak ?? 0,
    };

    try {
      const privateProfile = {
        name: payload.name,
        email: user.email || '',
        photoURL: user.photoURL || '',
        role: payload.role || 'user',
        budget: localCache.userState?.dailyBudget || 0,
        weight: localCache.userState?.weight || 0,
        height: localCache.userState?.height || 0,
        age: calculateAge(localCache.userState?.dateOfBirth || ''),
        dateOfBirth: localCache.userState?.dateOfBirth || '',
      };

      // Private account/profile data and public ranking data intentionally live
      // in separate documents so Leaderboard reads never expose PII.
      await Promise.all([
        update(ref(rtdb, `users/${user.uid}`), payload),
        setDoc(doc(db, 'users', user.uid), privateProfile, { merge: true }),
        setDoc(
          doc(db, LEADERBOARD_COLLECTION, user.uid),
          buildLeaderboardDocument(gp, { name: payload.name, photoURL: user.photoURL || '' }),
        ),
      ]);
    } catch (e) {
      console.error("Optimistic RTDB/Firestore sync failed", e);
    }
  },

  reSyncAllUserStats: async () => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Recalculate Profile locally based on workouts
    const { recalculateGymProfile } = require('./gamificationService');
    // Pass in current profile so token economy survives the rebuild.
    const newProfile = recalculateGymProfile(localCache.workouts, localCache.gymProfile);

    // 2. Save directly to cache
    localCache.gymProfile = newProfile;

    // 3. Force Push to RTDB and Firestore
    try {
      await update(ref(rtdb, `users/${user.uid}`), {
        gymProfile: newProfile,
        xp: newProfile.totalXP,
        level: newProfile.level,
        rank: newProfile.rank,
        rankEmoji: newProfile.rankEmoji,
        title: newProfile.title || 'Shadow Recruit',
      });

      await setDoc(
        doc(db, LEADERBOARD_COLLECTION, user.uid),
        buildLeaderboardDocument(newProfile),
      );
      
      alert("Sync Complete: Your stats now match your history exactly.");
      notifyCtx();
    } catch (e) {
      console.error("Deep Sync Failed", e);
    }
  },

  // ═══════════ SYNCHRONOUS GETTERS & SETTERS ═══════════
  // These read from `localCache` directly ensuring React doesn't freeze or wait.

  getWorkouts: (): WorkoutLog[] => localCache.workouts || [],
  saveWorkouts: (logs: WorkoutLog[]) => {
    localCache.workouts = logs;
    localStorage.setItem('jarvis_workouts', JSON.stringify(logs));
    storageService.saveData('workouts', logs);
    notifyCtx();
  },

  /**
   * Persists a completed workout as one acknowledged operation from the UI's
   * perspective. Firestore is written first because it only mirrors aggregate
   * leaderboard fields; RTDB remains the source of truth for the full workout.
   * Callers must await this method before closing the active workout screen.
   */
  saveCompletedWorkout: async (logs: WorkoutLog[], profile: GymProfile): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('auth/not-authenticated');

    const mirror = buildLeaderboardDocument(profile);

    // A failed aggregate mirror leaves no workout behind, so retrying remains
    // safe. The following RTDB update stores the complete workout + profile.
    await setDoc(doc(db, LEADERBOARD_COLLECTION, user.uid), mirror);
    await update(ref(rtdb, `users/${user.uid}`), {
      workouts: logs,
      gymProfile: profile,
      ...mirror,
    });

    localCache.workouts = logs;
    localCache.gymProfile = profile;
    try {
      localStorage.setItem('jarvis_workouts', JSON.stringify(logs));
      localStorage.setItem('jarvis_gym_profile', JSON.stringify(profile));
    } catch (error) {
      // Cloud persistence already succeeded; a full localStorage quota must not
      // turn a completed cloud save into a duplicate retry.
      console.error('[saveCompletedWorkout] Local cache update failed:', error);
    }
    notifyCtx();
  },

  getTransactions: (): Transaction[] => localCache.transactions || [],
  saveTransactions: (transactions: Transaction[]) => {
    localCache.transactions = transactions;
    localStorage.setItem('jarvis_transactions', JSON.stringify(transactions));
    storageService.saveData('transactions', transactions);
    notifyCtx();
  },

  getHabits: (): Habit[] => localCache.habits || INITIAL_HABITS,
  saveHabits: (habits: Habit[]) => {
    localCache.habits = habits;
    localStorage.setItem('jarvis_habits', JSON.stringify(habits));
    storageService.saveData('habits', habits);
    notifyCtx();
  },

  getUserState: (): UserState => localCache.userState,
  saveUserState: (state: UserState) => {
    localCache.userState = state;
    localStorage.setItem('jarvis_user_state', JSON.stringify(state));
    storageService.saveData('userState', state);

    // Flatten attributes instantly for DB leaderboard mapping
    storageService.saveData('name', state.name);
    notifyCtx();
  },
  saveUserStateLocal: (state: UserState) => {
    localCache.userState = state;
    localStorage.setItem('jarvis_user_state', JSON.stringify(state));
    notifyCtx();
  },

  savePublicIdentity: async (name: string, photoURL: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('auth/not-authenticated');

    const publicIdentity = {
      name: normalizePublicText(name, 'Anonymous', 80),
      photoURL: normalizePublicText(photoURL, '', 2048),
    };

    await Promise.all([
      setDoc(doc(db, 'users', user.uid), publicIdentity, { merge: true }),
      setDoc(
        doc(db, LEADERBOARD_COLLECTION, user.uid),
        buildLeaderboardDocument(localCache.gymProfile, publicIdentity),
      ),
    ]);
  },

  getGymProfile: (): GymProfile => localCache.gymProfile || DEFAULT_GYM_PROFILE,
  saveGymProfile: (profile: GymProfile) => {
    localCache.gymProfile = profile;
    localStorage.setItem('jarvis_gym_profile', JSON.stringify(profile));
    storageService.saveData('gymProfile', profile);

    // Flatten attributes instantly for RTDB leaderboard mapping
    storageService.saveData('xp', profile.totalXP);
    storageService.saveData('level', profile.level);
    storageService.saveData('rank', profile.rank);
    storageService.saveData('rankEmoji', profile.rankEmoji);
    storageService.saveData('title', profile.title || 'Shadow Recruit');
    storageService.saveData('monthlyXP', profile.monthlyXP ?? 0);
    storageService.saveData('monthlyWorkouts', profile.monthlyWorkouts ?? 0);
    storageService.saveData('currentMonth', profile.currentMonth ?? '');
    storageService.saveData('currentStreak', profile.currentStreak ?? 0);
    storageService.saveData('longestStreak', profile.longestStreak ?? 0);

    // Keep the public ranking document aligned with the RTDB source of truth.
    const user = auth.currentUser;
    if (user) {
      setDoc(
        doc(db, LEADERBOARD_COLLECTION, user.uid),
        buildLeaderboardDocument(profile),
      ).catch(e => console.error('[saveGymProfile] Firestore sync:', e));
    }

    notifyCtx();
  },

  // ═══════════ SYSTEM MUTATIONS (AI Tool Calling) ═══════════
  // Reused by aiService when the LLM returns tool calls.
  // Both delegate persistence to saveGymProfile so localStorage + RTDB + Firestore stay aligned.

  applySystemPenalty: (xpDeduction: number, resetStreak: boolean): GymProfile => {
    const current = localCache.gymProfile;
    const newTotalXP = Math.max(0, (current.totalXP || 0) - Math.max(0, xpDeduction));
    const newLevel = getLevelFromXP(newTotalXP);
    const newRank = getRankForLevel(newLevel);
    const newTitle = getTitleForLevel(newLevel);
    const next: GymProfile = {
      ...current,
      totalXP: newTotalXP,
      level: newLevel,
      rank: newRank.name,
      rankEmoji: newRank.emoji,
      title: newTitle.title,
      currentStreak: resetStreak ? 0 : current.currentStreak,
    };
    storageService.saveGymProfile(next);
    return next;
  },

  // ═══════════ STREAK FREEZE TOKENS (Phase 4) ═══════════
  // Caps at MAX_STREAK_TOKENS, plus once-per-day earning via lastTokenEarned.
  // Returns true if a token was actually granted; false if at cap or already
  // earned today.
  grantStreakToken: (): boolean => {
    const MAX = 3;
    const profile = localCache.gymProfile;
    const today = new Date().toLocaleDateString('en-CA');
    const tokens = profile.streakFreezeTokens || 0;
    if (tokens >= MAX) return false;
    if (profile.lastTokenEarned === today) return false;
    storageService.saveGymProfile({
      ...profile,
      streakFreezeTokens: tokens + 1,
      lastTokenEarned: today,
    });
    return true;
  },

  rewardSystemQuest: (xpBonus: number): GymProfile => {
    const current = localCache.gymProfile;
    const newTotalXP = (current.totalXP || 0) + Math.max(0, xpBonus);
    const newLevel = getLevelFromXP(newTotalXP);
    const newRank = getRankForLevel(newLevel);
    const newTitle = getTitleForLevel(newLevel);
    const next: GymProfile = {
      ...current,
      totalXP: newTotalXP,
      level: newLevel,
      rank: newRank.name,
      rankEmoji: newRank.emoji,
      title: newTitle.title,
    };
    storageService.saveGymProfile(next);
    return next;
  },

  // ═══════════ PENDING WORKOUT (Dashboard → GymTracker handoff) ═══════════
  setPendingWorkout: (p: PendingWorkout): void => {
    pendingWorkout = p;
  },
  consumePendingWorkout: (): PendingWorkout => {
    const p = pendingWorkout;
    pendingWorkout = null;
    return p;
  },
  peekPendingWorkout: (): PendingWorkout => pendingWorkout,

  // ═══════════ LAST SYSTEM MESSAGE (Dashboard System Briefing) ═══════════
  saveLastSystemMessage: (msg: string): void => {
    lastSystemMessage = msg || '';
    try { localStorage.setItem('ourlife_last_system_message', lastSystemMessage); } catch {}
    notifyCtx();
  },
  getLastSystemMessage: (): string => lastSystemMessage,

  getGymSchedule: (): GymSchedule => localCache.gymSchedule,
  saveGymSchedule: (schedule: GymSchedule) => {
    localCache.gymSchedule = schedule;
    localStorage.setItem('jarvis_gym_schedule', JSON.stringify(schedule));
    storageService.saveData('gymSchedule', schedule);
    notifyCtx();
  },

  getUserProfile: (): UserProfile => localCache.profile,
  saveUserProfile: (profile: UserProfile) => {
    localCache.profile = profile;
    localStorage.setItem('jarvis_user_profile', JSON.stringify(profile));
    storageService.saveData('profile', profile);
    notifyCtx();
  },

  // ═══════════ GLOBAL QUERIES (RTDB Mapping) ═══════════

  getGlobalLeaderboard: async (): Promise<any[]> => {
    try {
      const q = firestoreQuery(collection(db, LEADERBOARD_COLLECTION), orderBy('xp', 'desc'), limit(20));
      const snapshot = await getDocs(q);

      const results: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        results.push({
          id: docSnap.id,
          name: data.name || 'Anonymous',
          xp: data.xp ?? 0,
          level: data.level ?? 1,
          rank: data.rank || 'Civilian',
          rankEmoji: data.rankEmoji || '🧘',
          emoji: '👤'
        });
      });
      return results;
    } catch (e) {
      console.error("Error fetching leaderboard:", e);
      return [];
    }
  },

  subscribeToLeaderboard: (callback: (data: any[]) => void) => {
    const q = firestoreQuery(collection(db, LEADERBOARD_COLLECTION), orderBy('xp', 'desc'), limit(20));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: any[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        results.push({
          id: docSnap.id,
          name: d.name || 'Anonymous',
          xp: d.xp ?? 0,
          level: d.level ?? 1,
          rank: d.rank || 'Chore Boy',
          rankEmoji: d.rankEmoji || '',
          emoji: '👤'
        });
      });
      callback(results);
    }, (error) => {
      console.error("Leaderboard subscription error:", error);
    });

    return unsubscribe;
  },

  getAllUsers: async (): Promise<LeaderboardUser[]> => {
    try {
      const q = firestoreQuery(collection(db, LEADERBOARD_COLLECTION), orderBy('xp', 'desc'));
      const snapshot = await getDocs(q);
      
      const results: LeaderboardUser[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        results.push({
          id: docSnap.id,
          name: d.name || 'Anonymous',
          photoURL: d.photoURL || '',
          level: d.level ?? 1,
          xp: d.xp ?? 0,
          monthlyXP: d.monthlyXP ?? 0,
          monthlyWorkouts: d.monthlyWorkouts ?? 0,
          currentMonth: d.currentMonth || getCurrentMonthKey(),
          currentStreak: d.currentStreak ?? 0,
          longestStreak: d.longestStreak ?? 0,
          rank: d.rank || 'E-Rank',
          rankEmoji: d.rankEmoji || '',
          title: d.title || 'Shadow Recruit',
        });
      });
      return results;
    } catch (e) {
      console.error("Error fetching all users:", e);
      return [];
    }
  },

  getPrivateUsersForAdmin: async (): Promise<PrivateUserDirectoryEntry[]> => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const results: PrivateUserDirectoryEntry[] = [];

      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        results.push({
          id: docSnap.id,
          name: d.name || 'Anonymous',
          email: d.email || '-',
          role: d.role === 'admin' ? 'admin' : 'user',
          budget: d.budget || 0,
          weight: d.weight || 0,
          height: d.height || 0,
          age: d.age || 0,
          dateOfBirth: d.dateOfBirth || '',
          photoURL: d.photoURL || '',
        });
      });

      return results;
    } catch (e) {
      console.error('Error fetching private admin directory:', e);
      return [];
    }
  },

  getUserDetails: async (uid: string): Promise<any | null> => {
    try {
      const snapshot = await get(ref(rtdb, `users/${uid}`));
      if (snapshot.exists()) {
        const data = snapshot.val();
        return {
          id: snapshot.key,
          ...data,
          workoutLogs: data.workouts || [],
          transactions: data.transactions || [],
          gymSchedule: data.gymSchedule || {},
          userState: data.userState || {},
          gymProfile: data.gymProfile || {}
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  getContextString: (): string => {
    const workouts = localCache.workouts;
    const habits = localCache.habits;
    const userState = localCache.userState;
    const profile = localCache.gymProfile;

    const lastWorkout = workouts?.length > 0 ? `${workouts[0].type} on ${workouts[0].date}` : 'No workouts logged.';
    const today = getLocalDateString();
    const todaysHabits = habits.filter(h => h.completedDates?.includes(today)).map(h => h.name).join(', ') || 'None';

    return `
      Current Date: ${today}
      User Profile: ${userState.name}, ${userState.gender}, ${calculateAge(userState.dateOfBirth)}y, ${userState.height}cm, ${userState.weight}kg
      Goal: ${userState.fitnessGoal} (${userState.activityLevel} Activity)
      Last Workout: ${lastWorkout}
      Gym Level: ${profile.level} (${profile.rank}) - ${profile.totalXP} XP
      Habits Completed Today: ${todaysHabits}
      Active Habit Streaks: ${habits.map(h => `${h.name}: ${h.streak}`).join(' | ')}
    `.trim();
  }
};
