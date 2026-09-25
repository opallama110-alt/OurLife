import { getLocalDateString } from './dateUtils';

// Habit streak math, shared by HabitTracker and the Dashboard quick-toggle so
// both screens always show the same live value (moved verbatim out of
// HabitTracker.tsx — behaviour unchanged).

export const calculateHabitStreak = (completedDates: string[] | undefined | null): number => {
  if (!completedDates || !Array.isArray(completedDates) || completedDates.length === 0) return 0;

  const sorted = [...(completedDates || [])].sort((a, b) => b.localeCompare(a));
  const today = getLocalDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateString(yesterdayDate);

  const lastDate = sorted[0];
  if (lastDate !== today && lastDate !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < (sorted?.length || 0); i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
};

export const calculateHabitLongestStreak = (completedDates: string[] | undefined | null): number => {
  if (!completedDates || !Array.isArray(completedDates) || completedDates.length === 0) return 0;
  const sorted = [...(completedDates || [])].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < (sorted?.length || 0); i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  return longest;
};
