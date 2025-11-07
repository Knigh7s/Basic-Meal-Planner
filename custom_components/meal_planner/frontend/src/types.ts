// Home Assistant Types
export interface HomeAssistant {
  connection: Connection;
  states: HassEntities;
  language: string;
  themes: any;
  user: HassUser;
  callService: (domain: string, service: string, data?: any) => Promise<any>;
  callWS: <T>(msg: any) => Promise<T>;
  // Panel navigation
  navigate?: (path: string) => void;
}

export interface Connection {
  sendMessagePromise: <T>(msg: any) => Promise<T>;
  subscribeEvents: (callback: (event: any) => void, eventType: string) => Promise<() => void>;
}

export interface HassEntities {
  [entity_id: string]: HassEntity;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: { [key: string]: any };
  last_changed: string;
  last_updated: string;
}

export interface HassUser {
  id: string;
  is_admin: boolean;
  is_owner: boolean;
  name: string;
}

// Meal Planner Types
export interface MealPlannerSettings {
  week_start: 'Sunday' | 'Monday';
}

export interface MealRow {
  id: string;
  name: string;
  meal_time: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  date: string; // ISO format YYYY-MM-DD or empty for potential meals
  recipe_url: string;
  notes: string;
}

export interface MealLibraryItem {
  name: string;
  recipe_url: string;
  notes: string;
  times_used?: number; // Calculated on frontend
}

export interface MealPlannerData {
  settings: MealPlannerSettings;
  rows: MealRow[];
  library: MealLibraryItem[];
}

// WebSocket Message Types
export interface WSMealPlannerGet {
  type: 'meal_planner/get';
}

export interface WSMealPlannerAdd {
  type: 'meal_planner/add';
  name: string;
  meal_time: string;
  date: string;
  recipe_url: string;
  notes: string;
}

export interface WSMealPlannerUpdate {
  type: 'meal_planner/update';
  row_id: string;
  name?: string;
  meal_time?: string;
  date?: string;
  recipe_url?: string;
  notes?: string;
}

export interface WSMealPlannerBulk {
  type: 'meal_planner/bulk';
  action: 'convert_to_potential' | 'assign_date' | 'delete';
  ids: string[];
  date?: string;
  meal_time?: string;
}

// Sensor Attributes
export interface PotentialMealsSensorAttributes {
  items: string[]; // Array of meal names
}

export interface WeeklyMealsSensorAttributes {
  week_start: 'Sunday' | 'Monday';
  start: string; // ISO date
  end: string; // ISO date
  days: {
    [key: string]: {
      label: string;
      breakfast: string;
      lunch: string;
      dinner: string;
      snack: string;
    };
  };
}

// Routing
export type PanelRoute = 'dashboard' | 'meals' | 'potential-meals';

// Card Configurations
export interface MealPlannerCardConfig {
  type: string;
  entity?: string;
}

export interface WeeklyHorizontalCardConfig extends MealPlannerCardConfig {
  type: 'custom:meal-planner-weekly-horizontal';
  week_start?: 'Sunday' | 'Monday';
  show_empty_slots?: boolean;
  theme?: string;
}

export interface WeeklyVerticalCardConfig extends MealPlannerCardConfig {
  type: 'custom:meal-planner-weekly-vertical';
  week_start?: 'Sunday' | 'Monday';
  compact_mode?: boolean;
}

export interface PotentialMealsCardConfig extends MealPlannerCardConfig {
  type: 'custom:meal-planner-potential-meals';
  max_items?: number;
  show_count?: boolean;
}

// Helper Functions Type
export type DateString = string; // YYYY-MM-DD format
export type ISODateString = string; // Full ISO 8601 format

// UI State
export interface TableFilters {
  hidePast: boolean;
  filterType: 'none' | 'week' | 'month';
  weekAnchor?: Date;
  monthAnchor?: Date;
}

export interface BulkAction {
  action: 'convert_to_potential' | 'assign_date' | 'delete' | '';
  selectedIds: string[];
  date?: string;
  meal_time?: string;
}
