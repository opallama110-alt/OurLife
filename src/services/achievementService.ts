import { GymProfile, Habit, WorkoutLog } from '../types';
import { storageService } from './storageService';
import {
  Achievement, ACHIEVEMENTS, REWARDS_BY_RARITY, evaluateAchievements,
} from './gamificationService';

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT SERVICE (Phase 5A)
//
// One responsibility: detect newly-unlocked achievements (currently unlocked
// AND not in profile.unlockedAchievementIds), grant their rewards once, and
// persist the new IDs. Pure-ish — only mutates profile via storageService.
// Returns the newly unlocked entries so callers can drive notifications.
//
// Reward defaults derive from `REWARDS_BY_RARITY`. Per-achievement
// `xpBonus` / `tokenReward` overrides take precedence.
// ═══════════════════════════════════════════════════════════════════════════

export interface AchievementUnlock {
  achievement: Achievement;
  xpAwarded: number;
  tokensAwarded: number;
}

export const achievementService = {
  /**
   * Recompute achievements against current state, grant rewards for any
   * newly-met ones, persist the new unlocked ID list, and return the
   * unlock events so the UI can show notifications.
   *
   * Idempotent — re-evaluating without progress yields no unlocks.
   */
  checkAndGrant: (
    workouts?: WorkoutLog[],
    profile?: GymProfile,
    habits?: Habit[],
  ): AchievementUnlock[] => {
    const w = workouts ?? storageService.getWorkouts();
    const p = profile ?? storageService.getGymProfile();
    const h = habits ?? storageService.getHabits();
    if (!p) return [];

    const evaluated = evaluateAchievements(w, p, h);
    const known = new Set(p.unlockedAchievementIds || []);
    const newlyUnlocked = evaluated.filter(a => a.unlocked && !known.has(a.id));
    if (newlyUnlocked.length === 0) return [];

    // Grant rewards. We bypass storageService.grantStreakToken's once-per-day
    // earning cap here because achievement rewards aren't habit-derived
    // earnings — they're milestone payouts. The 3-token hard cap still
    // applies via Math.min below.
    const TOKEN_CAP = 3;
    let xpAccumulator = 0;
    let tokenAccumulator = 0;
    const unlocks: AchievementUnlock[] = [];

    for (const a of newlyUnlocked) {
      const def = REWARDS_BY_RARITY[a.rarity];
      const xp = a.xpBonus ?? def.xp;
      const tokens = a.tokenReward ?? def.tokens;
      xpAccumulator += xp;
      tokenAccumulator += tokens;
      unlocks.push({ achievement: a, xpAwarded: xp, tokensAwarded: tokens });
    }

    // Single profile write so only one Firebase sync fires for the batch.
    const currentProfile = storageService.getGymProfile();
    const newTotalXP = (currentProfile.totalXP || 0) + xpAccumulator;
    const newTokens = Math.min(
      TOKEN_CAP,
      (currentProfile.streakFreezeTokens || 0) + tokenAccumulator,
    );

    storageService.saveGymProfile({
      ...currentProfile,
      totalXP: newTotalXP,
      streakFreezeTokens: newTokens,
      unlockedAchievementIds: [
        ...(currentProfile.unlockedAchievementIds || []),
        ...newlyUnlocked.map(a => a.id),
      ],
    });

    return unlocks;
  },

  /**
   * Catalog snapshot — every achievement with its current unlocked status,
   * progress (when defined), and effective reward values. Powers the
   * Profile gallery in 5B.
   */
  getCatalog: (
    workouts?: WorkoutLog[],
    profile?: GymProfile,
    habits?: Habit[],
  ) => {
    const w = workouts ?? storageService.getWorkouts();
    const p = profile ?? storageService.getGymProfile();
    const h = habits ?? storageService.getHabits();
    return ACHIEVEMENTS.map(a => {
      const unlocked = a.isUnlocked(w, p, h);
      const progress = a.getProgress ? a.getProgress(w, p, h) : (unlocked ? (a.requirement ?? 1) : 0);
      const def = REWARDS_BY_RARITY[a.rarity];
      return {
        ...a,
        unlocked,
        progress,
        xpReward: a.xpBonus ?? def.xp,
        tokenReward: a.tokenReward ?? def.tokens,
      };
    });
  },
};
