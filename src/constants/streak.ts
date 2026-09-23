// Streak visual tiers + milestones shared by every streak surface
// (habit cards, Dashboard, StatusCard, Profile, Gym analytics, toasts).

/** 0 = cold ash · 1 spark (1-2d) · 2 flame (3-6d) · 3 blaze (7-13d) · 4 inferno (14-29d) · 5 System-blue (30d+) */
export type FlameLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const flameLevel = (days: number): FlameLevel => {
  if (!Number.isFinite(days) || days <= 0) return 0;
  if (days < 3) return 1;
  if (days < 7) return 2;
  if (days < 14) return 3;
  if (days < 30) return 4;
  return 5;
};

/** 100+ days gets the purple/gold "Monarch" treatment on top of level 5. */
export const LEGEND_STREAK_DAYS = 100;

export const STREAK_MILESTONES = [3, 7, 30, 100, 365] as const;

/** The highest milestone crossed when a streak goes from `prev` to `next`, else null. */
export const crossedMilestone = (prev: number, next: number): number | null => {
  for (let i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
    const m = STREAK_MILESTONES[i];
    if (prev < m && next >= m) return m;
  }
  return null;
};

export const MILESTONE_COPY: Record<number, string> = {
  3: 'Bara mulai menyala. Jangan putus.',
  7: 'Seminggu penuh — Sistem mengakui konsistensimu.',
  30: 'Api biru terbangun. Kebiasaan terbentuk.',
  100: 'Seratus hari. Level Monarch.',
  365: 'Satu tahun penuh. Legenda.',
};

/** Stable small hash — used to de-sync flame flicker phases between cards. */
export const hashId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
};
