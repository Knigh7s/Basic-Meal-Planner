import { MealRow, MealLibraryItem, MealPlannerData } from '../types';
import { parseISODate } from './date-utils';

/**
 * Check if a meal is a potential meal (no date assigned)
 */
export function isPotentialMeal(meal: MealRow): boolean {
  return !meal.date || meal.date.trim() === '';
}

/**
 * Check if a meal is scheduled (has a date assigned)
 */
export function isScheduledMeal(meal: MealRow): boolean {
  return !isPotentialMeal(meal);
}

/**
 * Get all scheduled meals from data
 */
export function getScheduledMeals(data: MealPlannerData): MealRow[] {
  return data.rows.filter(isScheduledMeal);
}

/**
 * Get all potential meals from data
 */
export function getPotentialMeals(data: MealPlannerData): MealRow[] {
  return data.rows.filter(isPotentialMeal);
}

/**
 * Sort meals by date and meal time
 */
export function sortMealsByDateTime(meals: MealRow[]): MealRow[] {
  const mealTimeOrder = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };

  return [...meals].sort((a, b) => {
    const dateA = parseISODate(a.date);
    const dateB = parseISODate(b.date);

    // Potential meals (no date) go to end
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    // Compare dates
    const dateDiff = dateA.getTime() - dateB.getTime();
    if (dateDiff !== 0) return dateDiff;

    // Same date, compare meal times
    const timeA = mealTimeOrder[a.meal_time] ?? 2;
    const timeB = mealTimeOrder[b.meal_time] ?? 2;
    return timeA - timeB;
  });
}

/**
 * Sort meals by name alphabetically
 */
export function sortMealsByName(meals: MealRow[]): MealRow[] {
  return [...meals].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/**
 * Build library with usage counts
 */
export function buildLibraryWithUsage(data: MealPlannerData): MealLibraryItem[] {
  const usageMap = new Map<string, number>();

  // Count how many times each meal name appears in scheduled meals
  for (const meal of data.rows) {
    const key = meal.name.toLowerCase().trim();
    usageMap.set(key, (usageMap.get(key) || 0) + 1);
  }

  // Build library items with usage counts
  const libraryItems: MealLibraryItem[] = data.library.map((item) => ({
    ...item,
    times_used: usageMap.get(item.name.toLowerCase().trim()) || 0,
  }));

  // Sort by usage (descending), then by name
  return libraryItems.sort((a, b) => {
    const usageDiff = (b.times_used || 0) - (a.times_used || 0);
    if (usageDiff !== 0) return usageDiff;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

/**
 * Find a meal by ID
 */
export function findMealById(data: MealPlannerData, id: string): MealRow | undefined {
  return data.rows.find((m) => m.id === id);
}

/**
 * Find library item by name (case-insensitive)
 */
export function findLibraryItemByName(
  data: MealPlannerData,
  name: string
): MealLibraryItem | undefined {
  const key = name.toLowerCase().trim();
  return data.library.find((item) => item.name.toLowerCase().trim() === key);
}

/**
 * Get unique meal names from library for autocomplete
 */
export function getUniqueMealNames(data: MealPlannerData): string[] {
  const names = new Set<string>();
  for (const item of data.library) {
    const n = item.name.trim();
    if (n) names.add(n);
  }
  return Array.from(names).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * Validate meal data
 */
export function validateMeal(meal: Partial<MealRow>): string[] {
  const errors: string[] = [];

  if (!meal.name || !meal.name.trim()) {
    errors.push('Meal name is required');
  }

  if (meal.name && meal.name.length > 100) {
    errors.push('Meal name must be 100 characters or less');
  }

  if (meal.notes && meal.notes.length > 500) {
    errors.push('Notes must be 500 characters or less');
  }

  if (meal.recipe_url && meal.recipe_url.length > 2048) {
    errors.push('Recipe URL must be 2048 characters or less');
  }

  if (meal.recipe_url && meal.recipe_url.trim()) {
    const url = meal.recipe_url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      errors.push('Recipe URL must start with http:// or https://');
    }
  }

  if (meal.date && meal.date.trim()) {
    const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(meal.date.trim());
    if (!dateMatch) {
      errors.push('Date must be in YYYY-MM-DD format');
    }
  }

  return errors;
}

/**
 * Get meal time color (for UI consistency)
 */
export function getMealTimeColor(mealTime: string): string {
  const colors: Record<string, string> = {
    Breakfast: 'var(--warning-color, #f4b400)',
    Lunch: 'var(--info-color, #0288d1)',
    Dinner: 'var(--success-color, #43a047)',
    Snack: 'var(--accent-color, #ff9800)',
  };
  return colors[mealTime] || 'var(--primary-color)';
}

/**
 * Get meal time icon (mdi icons)
 */
export function getMealTimeIcon(mealTime: string): string {
  const icons: Record<string, string> = {
    Breakfast: 'mdi:coffee',
    Lunch: 'mdi:food',
    Dinner: 'mdi:silverware-fork-knife',
    Snack: 'mdi:food-apple',
  };
  return icons[mealTime] || 'mdi:silverware-variant';
}
