import { GymProfile, WorkoutLog } from '../types';
import { calculateStreak } from '../services/gamificationService';

/**
 * The workout streak as the user should see it right now: computed live from
 * the workout log, with freeze-token–bridged days counted as filled.
 *
 * `profile.currentStreak` is only refreshed on workout save / sync, so after
 * a lapse it keeps showing an old number, and plain `calculateStreak(workouts)`
 * ignores token-protected days (reading "0" the morning a token saved the
 * chain). Display-only selector — the stored profile value is untouched.
 */
export const liveWorkoutStreak = (
  workouts: WorkoutLog[] | null | undefined,
  profile?: Pick<GymProfile, 'tokenProtectedDates'> | null,
): number => calculateStreak(workouts || [], profile?.tokenProtectedDates ?? []);
