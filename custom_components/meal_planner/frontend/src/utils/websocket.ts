import {
  HomeAssistant,
  MealPlannerData,
  WSMealPlannerAdd,
  WSMealPlannerUpdate,
  WSMealPlannerBulk,
} from '../types';

/**
 * Fetch all meal planner data via WebSocket
 */
export async function getMealPlannerData(hass: HomeAssistant): Promise<MealPlannerData> {
  return hass.connection.sendMessagePromise<MealPlannerData>({
    type: 'meal_planner/get',
  });
}

/**
 * Add a new meal via WebSocket
 */
export async function addMeal(
  hass: HomeAssistant,
  meal: {
    name: string;
    meal_time: string;
    date: string;
    recipe_url?: string;
    notes?: string;
  }
): Promise<{ queued: boolean }> {
  const msg: WSMealPlannerAdd = {
    type: 'meal_planner/add',
    name: meal.name,
    meal_time: meal.meal_time,
    date: meal.date,
    recipe_url: meal.recipe_url || '',
    notes: meal.notes || '',
  };

  return hass.connection.sendMessagePromise(msg);
}

/**
 * Update an existing meal via WebSocket
 */
export async function updateMeal(
  hass: HomeAssistant,
  rowId: string,
  updates: {
    name?: string;
    meal_time?: string;
    date?: string;
    recipe_url?: string;
    notes?: string;
  }
): Promise<{ queued: boolean }> {
  const msg: WSMealPlannerUpdate = {
    type: 'meal_planner/update',
    row_id: rowId,
    ...updates,
  };

  return hass.connection.sendMessagePromise(msg);
}

/**
 * Bulk operations on meals via WebSocket
 */
export async function bulkMealOperation(
  hass: HomeAssistant,
  action: 'convert_to_potential' | 'assign_date' | 'delete',
  ids: string[],
  options?: {
    date?: string;
    meal_time?: string;
  }
): Promise<{ queued: boolean }> {
  const msg: WSMealPlannerBulk = {
    type: 'meal_planner/bulk',
    action,
    ids,
    date: options?.date || '',
    meal_time: options?.meal_time || '',
  };

  return hass.connection.sendMessagePromise(msg);
}

/**
 * Subscribe to meal planner updates
 * @returns Unsubscribe function
 */
export async function subscribeMealPlannerUpdates(
  hass: HomeAssistant,
  callback: () => void
): Promise<() => void> {
  return hass.connection.subscribeEvents(callback, 'meal_planner_updated');
}
