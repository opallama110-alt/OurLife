// ═══════════════════════════════════════════════════════════════════════════
// DATE-OF-BIRTH UTILITIES
// Single source of truth for converting between the canonical UserState shape
// (`dateOfBirth: string` in ISO YYYY-MM-DD) and presentation (age, formatted
// labels, <input type="date"> values).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute age in completed years from an ISO date-of-birth.
 * Honors month/day so a birthday that hasn't passed this year drops the age.
 * Returns 0 if input is empty/invalid (callers can render "—" if they want).
 */
export const calculateAge = (dateOfBirth: string): number => {
  if (!dateOfBirth) return 0;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
};

/**
 * Localized date label, e.g. "15 Mei 2004". Default locale = id-ID.
 * Returns empty string for missing/invalid input — callers fall back as needed.
 */
export const formatDateForDisplay = (dateOfBirth: string, locale: string = 'id-ID'): string => {
  if (!dateOfBirth) return '';
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
};

/**
 * Normalize any ISO datetime to the YYYY-MM-DD form expected by <input type="date">.
 */
export const formatDateForInput = (dateOfBirth: string): string => {
  if (!dateOfBirth) return '';
  return dateOfBirth.split('T')[0];
};

/**
 * Return a local calendar date without converting through UTC first.
 * This keeps workout and habit day keys aligned after midnight in UTC+7.
 */
export const getLocalDateString = (date: Date = new Date()): string =>
  date.toLocaleDateString('en-CA');

export const getTodayString = (): string => {
  return getLocalDateString();
};

// Bounds for the date picker — birth dates beyond today are nonsensical,
// and 1900 is a generous lower bound that still types-checks date inputs.
export const getMaxDate = (): string => getTodayString();
export const getMinDate = (): string => '1900-01-01';
