import { DateString } from '../types';

/**
 * Parse ISO date string (YYYY-MM-DD) to Date object
 */
export function parseISODate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s + 'T00:00:00'); // Force local timezone interpretation
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format Date to ISO date string (YYYY-MM-DD)
 */
export function formatISODate(d: Date): DateString {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get start of week for a given date
 * @param d - Reference date
 * @param weekStart - 'Sunday' or 'Monday'
 */
export function startOfWeek(d: Date, weekStart: 'Sunday' | 'Monday' = 'Sunday'): Date {
  const day = d.getDay(); // 0 = Sun, 6 = Sat
  const isMonday = weekStart === 'Monday';

  // Calculate offset to get to week start
  let offset: number;
  if (isMonday) {
    // Monday-based week
    offset = day === 0 ? -6 : 1 - day;
  } else {
    // Sunday-based week
    offset = -day;
  }

  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  res.setDate(res.getDate() + offset);
  return res;
}

/**
 * Get end of week for a given date
 */
export function endOfWeek(d: Date, weekStart: 'Sunday' | 'Monday' = 'Sunday'): Date {
  const sow = startOfWeek(d, weekStart);
  const res = new Date(sow);
  res.setDate(sow.getDate() + 6);
  res.setHours(23, 59, 59, 999);
  return res;
}

/**
 * Check if a date is in the past week (before current week starts)
 */
export function isInPastWeek(dt: Date | null, weekStart: 'Sunday' | 'Monday' = 'Sunday'): boolean {
  if (!dt) return false;
  const today = new Date();
  const thisWeekStart = startOfWeek(today, weekStart);
  return dt < thisWeekStart;
}

/**
 * Check if two dates are in the same week
 */
export function isInSameWeek(
  dt: Date | null,
  anchor: Date = new Date(),
  weekStart: 'Sunday' | 'Monday' = 'Sunday'
): boolean {
  if (!dt) return false;
  const s1 = startOfWeek(anchor, weekStart).getTime();
  const e1 = endOfWeek(anchor, weekStart).getTime();
  const t = dt.getTime();
  return t >= s1 && t <= e1;
}

/**
 * Check if two dates are in the same month
 */
export function isInSameMonth(dt: Date | null, anchor: Date = new Date()): boolean {
  if (!dt) return false;
  return dt.getFullYear() === anchor.getFullYear() && dt.getMonth() === anchor.getMonth();
}

/**
 * Get array of dates for current week
 */
export function getCurrentWeekDates(weekStart: 'Sunday' | 'Monday' = 'Sunday'): Date[] {
  const today = new Date();
  const start = startOfWeek(today, weekStart);
  const dates: Date[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }

  return dates;
}

/**
 * Get day of week label (Sun, Mon, etc.)
 */
export function getDayLabel(date: Date, format: 'short' | 'long' = 'short'): string {
  const options: Intl.DateTimeFormatOptions = { weekday: format === 'short' ? 'short' : 'long' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Get formatted date string for display
 */
export function getFormattedDate(date: Date, includeYear: boolean = false): string {
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();

  if (includeYear) {
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  return `${month} ${day}`;
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

/**
 * Get relative day label (Today, Tomorrow, Yesterday, or day name)
 */
export function getRelativeDayLabel(date: Date): string {
  if (isToday(date)) return 'Today';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const dateNorm = new Date(date);
  dateNorm.setHours(0, 0, 0, 0);

  if (dateNorm.getTime() === tomorrow.getTime()) return 'Tomorrow';
  if (dateNorm.getTime() === yesterday.getTime()) return 'Yesterday';

  return getDayLabel(date, 'long');
}
