import { storageService } from './storageService';
import { calculateStreak, calculateLongestStreak } from './gamificationService';

// ═══════════════════════════════════════════════════════════════════════════
// STREAK PROTECTION SERVICE (Phase 4)
//
// One responsibility: on app boot, if yesterday was missed and the user has
// at least one Streak Freeze Token AND a streak worth saving, auto-burn a
// token and mark yesterday as token-protected. The streak math in
// gamificationService merges protected dates with workout dates so the chain
// continues across the bridged day.
//
// Self-rate-limited via lastTokenUsed (one auto-protect per calendar day) so
// repeated boots in the same day don't burn extra tokens.
// ═══════════════════════════════════════════════════════════════════════════

const todayString = (): string => new Date().toLocaleDateString('en-CA');
const yesterdayString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
};

export interface StreakProtectionResult {
  tokenUsed: boolean;
  tokensRemaining: number;
  protectedDate?: string;
  streakSaved?: number;
}

export const streakProtectionService = {
  /**
   * Decide whether a token should auto-protect a missed day. Idempotent —
   * safe to call on every app boot. Returns null if no protection happened.
   */
  checkAndProtectStreak: (): StreakProtectionResult | null => {
    const profile = storageService.getGymProfile();
    if (!profile) return null;

    const tokens = profile.streakFreezeTokens || 0;
    const savedStreak = profile.currentStreak || 0;

    // No token, or no streak worth saving — nothing to do.
    if (tokens <= 0 || savedStreak <= 0) return null;

    const today = todayString();
    const yesterday = yesterdayString();

    // Cap at one auto-protection per calendar day.
    const lastUsedDay = (profile.lastTokenUsed || '').slice(0, 10);
    if (lastUsedDay === today) return null;

    const workouts = storageService.getWorkouts();
    const workoutDates = new Set((workouts || []).map(w => w.date));
    const protectedDates = new Set(profile.tokenProtectedDates || []);

    // If yesterday already counts (real workout or earlier protection),
    // there's nothing to bridge. Today's miss alone is the existing 1-day
    // grace built into calculateStreak.
    if (workoutDates.has(yesterday) || protectedDates.has(yesterday)) return null;

    // Burn one token to mark yesterday as filled.
    const newProtected = [...(profile.tokenProtectedDates || []), yesterday];
    const newTokens = Math.max(0, tokens - 1);
    const newCurrent = calculateStreak(workouts, newProtected);
    const newLongest = Math.max(profile.longestStreak || 0, calculateLongestStreak(workouts, newProtected));

    storageService.saveGymProfile({
      ...profile,
      streakFreezeTokens: newTokens,
      lastTokenUsed: new Date().toISOString(),
      tokenProtectedDates: newProtected,
      streakProtectionHistory: [
        ...(profile.streakProtectionHistory || []),
        { date: yesterday, streakSaved: savedStreak },
      ],
      currentStreak: newCurrent,
      longestStreak: newLongest,
    });

    return {
      tokenUsed: true,
      tokensRemaining: newTokens,
      protectedDate: yesterday,
      streakSaved: savedStreak,
    };
  },
};
