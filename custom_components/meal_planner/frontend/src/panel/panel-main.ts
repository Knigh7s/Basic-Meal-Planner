/**
 * Meal Planner Custom Panel Entry Point
 * This file is the main entry point for the custom panel bundle
 */

import './meal-planner-panel';

// Export the panel element for Home Assistant
export { MealPlannerPanel } from './meal-planner-panel';

// Register the panel with Home Assistant
// This code executes when the bundle is loaded
console.info(
  '%c MEAL-PLANNER-PANEL %c v0.2.0 ',
  'background-color: #03a9f4; color: #fff; font-weight: bold;',
  'background-color: #333; color: #fff;'
);
