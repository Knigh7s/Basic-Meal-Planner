/**
 * Meal Planner Custom Cards Entry Point
 * This file is the main entry point for the custom cards bundle
 */

import './weekly-horizontal-card';
import './weekly-vertical-card';
import './potential-meals-card';

// Export all card elements
export { WeeklyHorizontalCard } from './weekly-horizontal-card';
export { WeeklyVerticalCard } from './weekly-vertical-card';
export { PotentialMealsCard } from './potential-meals-card';

// Log successful loading
console.info(
  '%c MEAL-PLANNER-CARDS %c v0.2.0 ',
  'background-color: #03a9f4; color: #fff; font-weight: bold;',
  'background-color: #333; color: #fff;'
);
