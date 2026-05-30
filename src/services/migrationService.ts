import { storageService } from './storageService';

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION SERVICE
// One-shot migrations that run on app boot. Idempotent — safe to invoke on
// every load; each migration self-detects whether it's already been applied.
// ═══════════════════════════════════════════════════════════════════════════

export const migrationService = {
  /**
   * Convert legacy `userState.age: number` into `userState.dateOfBirth: string`.
   * Older clients only stored an integer age, so we estimate DOB as Jan 1 of the
   * year `currentYear - age`. The user can correct it from Settings whenever.
   *
   * Skips if dateOfBirth is already populated, regardless of whether `age` is
   * still present (so a slow rollout where some devices are stale doesn't clobber
   * a freshly-edited DOB).
   */
  migrateAgeToDateOfBirth: (): void => {
    const userState = storageService.getUserState() as any;
    if (!userState) return;

    if (userState.dateOfBirth) {
      // Already migrated. Strip stale `age` field if it lingered, but don't
      // touch DOB.
      if ('age' in userState) {
        delete userState.age;
        storageService.saveUserStateLocal(userState);
      }
      return;
    }

    const legacyAge = typeof userState.age === 'number' ? userState.age : 0;
    if (legacyAge <= 0) {
      // No legacy data — fresh user, onboarding will set DOB explicitly.
      return;
    }

    const estimatedYear = new Date().getFullYear() - legacyAge;
    const estimatedDOB = `${estimatedYear}-01-01`;

    const migrated = { ...userState, dateOfBirth: estimatedDOB };
    delete migrated.age;

    // Local-only save here. Once the auth listener fires, syncToRemote() will
    // push the new shape to RTDB + Firestore as part of normal hydration.
    storageService.saveUserStateLocal(migrated);
    console.log(
      `[migration] age ${legacyAge} → estimated DOB ${estimatedDOB} (user can correct in Settings)`
    );
  },
};
