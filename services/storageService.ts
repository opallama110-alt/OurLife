import { Transaction, Habit, WorkoutLog, UserState, GymProfile, GymSchedule, UserProfile } from '../types';
import { INITIAL_HABITS } from '../constants';
import { DEFAULT_GYM_PROFILE, rolloverMonthlyIfNeeded, getCurrentMonthKey } from '../gamification';
import { rtdb, auth, db } from '../firebase-config'; 
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
    age: 25, fitnessGoal: 'Build Muscle', activityLevel: 'Moderate', dailyBudget: 150000
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

// Simple event emitter for data changes
const listeners: (() => void)[] = [];
export const notifyCtx = () => listeners.forEach(l => l());

let activeSubscriptions: (() => void)[] = [];

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
            setDoc(doc(db, 'users', fsUser.uid), {
              monthlyXP: 0,
              monthlyWorkouts: 0,
              currentMonth: thisMonth,
            }, { merge: true }).catch(e => console.error('[syncUser] monthly rollover Firestore sync:', e));
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
      await update(ref(rtdb, `users/${user.uid}`), payload);

      // Sync strictly indexable data to Firestore for Leaderboard/Admin
      await setDoc(doc(db, 'users', user.uid), {
        name: payload.name,
        email: user.email || '',
        xp: payload.xp,
        level: payload.level,
        rank: payload.rank,
        rankEmoji: payload.rankEmoji,
        title: payload.title,
        role: payload.role || 'user',
        budget: localCache.userState?.dailyBudget || 0,
        weight: localCache.userState?.weight || 0,
        height: localCache.userState?.height || 0,
        age: localCache.userState?.age || 0,
        // Monthly League fields — indexable for "top monthly XP" queries
        monthlyXP: payload.monthlyXP,
        monthlyWorkouts: payload.monthlyWorkouts,
        currentMonth: payload.currentMonth,
        currentStreak: payload.currentStreak,
        longestStreak: payload.longestStreak,
      }, { merge: true });
    } catch (e) {
      console.error("Optimistic RTDB/Firestore sync failed", e);
    }
  },

  reSyncAllUserStats: async () => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Recalculate Profile locally based on workouts
    const { recalculateGymProfile } = require('../gamification');
    const newProfile = recalculateGymProfile(localCache.workouts);

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

      await setDoc(doc(db, 'users', user.uid), {
        xp: newProfile.totalXP,
        level: newProfile.level,
        rank: newProfile.rank,
        rankEmoji: newProfile.rankEmoji,
        title: newProfile.title || 'Shadow Recruit',
      }, { merge: true });
      
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

    // ── Phase 3 fix: also push to Firestore so the Leaderboard (which
    // reads from the `users` Firestore collection) stays in sync.
    const user = auth.currentUser;
    if (user) {
      setDoc(doc(db, 'users', user.uid), {
        xp: profile.totalXP,
        level: profile.level,
        rank: profile.rank,
        rankEmoji: profile.rankEmoji,
        title: profile.title || 'Shadow Recruit',
        name: localCache.userState?.name || 'User',
        monthlyXP: profile.monthlyXP ?? 0,
        monthlyWorkouts: profile.monthlyWorkouts ?? 0,
        currentMonth: profile.currentMonth ?? '',
        currentStreak: profile.currentStreak ?? 0,
        longestStreak: profile.longestStreak ?? 0,
      }, { merge: true }).catch(e => console.error('[saveGymProfile] Firestore sync:', e));
    }

    notifyCtx();
  },

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
      const q = firestoreQuery(collection(db, 'users'), orderBy('xp', 'desc'), limit(20));
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
    const q = firestoreQuery(collection(db, 'users'), orderBy('xp', 'desc'), limit(20));
    
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

  getAllUsers: async (): Promise<any[]> => {
    try {
      const q = firestoreQuery(collection(db, 'users'), orderBy('xp', 'desc'));
      const snapshot = await getDocs(q);
      
      const results: any[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        results.push({
          id: docSnap.id,
          name: d.name || 'Anonymous',
          email: d.email || '-',
          level: d.level ?? 1,
          xp: d.xp ?? 0,
          budget: d.budget || 0,
          weight: d.weight || 0,
          height: d.height || 0,
          age: d.age || 0,
          role: d.role || 'user',
          // Compare fields — monthly league + streak
          monthlyXP: d.monthlyXP ?? 0,
          monthlyWorkouts: d.monthlyWorkouts ?? 0,
          currentStreak: d.currentStreak ?? 0,
          longestStreak: d.longestStreak ?? 0,
          rank: d.rank || 'E-Rank',
          rankEmoji: d.rankEmoji || '🥉',
          title: d.title || 'Shadow Recruit',
          photoURL: d.photoURL || '',
        });
      });
      return results;
    } catch (e) {
      console.error("Error fetching all users:", e);
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
    const transactions = localCache.transactions;
    const habits = localCache.habits;
    const userState = localCache.userState;
    const profile = localCache.gymProfile;

    const lastWorkout = workouts?.length > 0 ? `${workouts[0].type} on ${workouts[0].date}` : 'No workouts logged.';
    const today = new Date().toISOString().split('T')[0];
    const todaysHabits = habits.filter(h => h.completedDates?.includes(today)).map(h => h.name).join(', ') || 'None';
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return `
      Current Date: ${today}
      User Profile: ${userState.name}, ${userState.gender}, ${userState.age}y, ${userState.height}cm, ${userState.weight}kg
      Goal: ${userState.fitnessGoal} (${userState.activityLevel} Activity)
      Last Workout: ${lastWorkout}
      Gym Level: ${profile.level} (${profile.rank}) - ${profile.totalXP} XP
      Habits Completed Today: ${todaysHabits}
      Financials: Income ${totalIncome}, Expense ${totalExpense}, Balance ${totalIncome - totalExpense}
      Active Habit Streaks: ${habits.map(h => `${h.name}: ${h.streak}`).join(' | ')}
    `.trim();
  }
};