import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GYM_PROFILE } from '../gamificationService';
import { storageService } from '../storageService';
import { streakProtectionService } from '../streakProtectionService';
import { GymProfile, WorkoutLog } from '../../types';

vi.mock('../storageService', () => ({
  storageService: {
    getGymProfile: vi.fn(),
    getWorkouts: vi.fn(),
    saveGymProfile: vi.fn(),
  },
}));

const workoutOn = (id: string, date: string): WorkoutLog => ({
  id,
  date,
  type: 'Push',
  muscleGroups: ['chest'],
  exercises: [],
  coreWork: false,
  xpEarned: 100,
});

const profileWith = (overrides: Partial<GymProfile> = {}): GymProfile => ({
  ...DEFAULT_GYM_PROFILE,
  streakFreezeTokens: 2,
  currentStreak: 3,
  longestStreak: 3,
  tokenProtectedDates: [],
  streakProtectionHistory: [],
  ...overrides,
});

describe('streakProtectionService', () => {
  const getGymProfile = vi.mocked(storageService.getGymProfile);
  const getWorkouts = vi.mocked(storageService.getWorkouts);
  const saveGymProfile = vi.mocked(storageService.saveGymProfile);

  let profile: GymProfile;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 10, 0, 0));
    vi.clearAllMocks();

    profile = profileWith();
    getGymProfile.mockImplementation(() => profile);
    getWorkouts.mockReturnValue([
      workoutOn('day-before', '2026-08-22'),
      workoutOn('three-days-before', '2026-08-21'),
    ]);
    saveGymProfile.mockImplementation(updated => {
      profile = updated;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['no tokens', { streakFreezeTokens: 0 }],
    ['no streak', { currentStreak: 0 }],
  ])('does not protect when the profile has %s', (_label, overrides) => {
    profile = profileWith(overrides);

    expect(streakProtectionService.checkAndProtectStreak()).toBeNull();
    expect(saveGymProfile).not.toHaveBeenCalled();
  });

  it('does not consume a token when yesterday already has a workout', () => {
    getWorkouts.mockReturnValue([workoutOn('yesterday', '2026-08-23')]);

    expect(streakProtectionService.checkAndProtectStreak()).toBeNull();
    expect(saveGymProfile).not.toHaveBeenCalled();
  });

  it('does not consume a token when yesterday is already protected', () => {
    profile = profileWith({ tokenProtectedDates: ['2026-08-23'] });

    expect(streakProtectionService.checkAndProtectStreak()).toBeNull();
    expect(saveGymProfile).not.toHaveBeenCalled();
  });

  it('burns exactly one token and persists the bridged streak', () => {
    expect(streakProtectionService.checkAndProtectStreak()).toEqual({
      tokenUsed: true,
      tokensRemaining: 1,
      protectedDate: '2026-08-23',
      streakSaved: 3,
    });

    expect(saveGymProfile).toHaveBeenCalledTimes(1);
    expect(profile).toMatchObject({
      streakFreezeTokens: 1,
      tokenProtectedDates: ['2026-08-23'],
      currentStreak: 3,
      longestStreak: 3,
      streakProtectionHistory: [{ date: '2026-08-23', streakSaved: 3 }],
    });
    expect(profile.lastTokenUsed).toBe('2026-08-24T03:00:00.000Z');
  });

  it('is idempotent when checked again on the same day', () => {
    expect(streakProtectionService.checkAndProtectStreak()?.tokenUsed).toBe(true);
    expect(streakProtectionService.checkAndProtectStreak()).toBeNull();
    expect(saveGymProfile).toHaveBeenCalledTimes(1);
  });
});
