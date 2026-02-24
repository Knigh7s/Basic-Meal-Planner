# Basic Meal Planner

A simple, zero-dependency meal planning integration for Home Assistant with an admin dashboard and custom Lovelace cards.

**Version:** 0.3.0

---

## Installation

### HACS (Recommended)
1. In Home Assistant: **HACS → Integrations → Custom repositories**
2. Add the repository URL and select **Integration** as the category
3. Install **Basic Meal Planner** and restart Home Assistant
4. Go to **Settings → Devices & Services → Add Integration**
5. Search for "Basic Meal Planner" and complete setup

### Manual
1. Copy `custom_components/meal_planner` to your `config/custom_components/` directory
2. Restart Home Assistant
3. Go to **Settings → Devices & Services → Add Integration**, search for "Basic Meal Planner"

---

## Dashboard

Access the dashboard from the sidebar. Two views are available:

- **Scheduled Meals** — View, add, edit, and delete scheduled meals
- **Meals Library** — All known meals; edit details, schedule a meal, mark as potential, or delete

### Meals Library
- Click **Edit** on any row to update the meal's name, recipe, or notes — add a date to schedule it at the same time
- Click the **star** to toggle a meal as a Potential Meal (an idea you want to cook someday)
- Use the filter dropdown to show all meals or potential meals only
- Search by name using the search box

### Settings
Access via the Settings button on the dashboard:

- **Days After Today (0–6)** — Controls the rolling 7-day sensor window (e.g. `3` = 3 days before + today + 3 after)
- **Days of Past Meals to Keep (1–365)** — Scheduled meals older than this are automatically removed. Default: 14. Library entries are never auto-deleted.

---

## Sensors

**`sensor.meal_planner_potential`**
- State: count of potential meals
- Attribute `items`: sorted list of potential meal names

**`sensor.meal_planner_week`**
- State: date range string
- Attributes: rolling 7-day grid with breakfast/lunch/dinner/snack slots per day
  - `days` — grid keyed `day0`–`day6`
  - `today_index` — which index is today
  - `start` / `end` — ISO date strings

---

## Custom Lovelace Cards

Cards are auto-registered on startup — no manual resource configuration needed.

**Weekly Horizontal:**
```yaml
type: custom:meal-planner-weekly-horizontal
entity: sensor.meal_planner_week
title: This Week's Meals
```

**Weekly Vertical:**
```yaml
type: custom:meal-planner-weekly-vertical
entity: sensor.meal_planner_week
title: Weekly Meal Plan
```

**Potential Meals:**
```yaml
type: custom:meal-planner-potential-meals
entity: sensor.meal_planner_potential
title: Meal Ideas
```

---

## Services

| Service | Description | Key Fields |
|---------|-------------|------------|
| `meal_planner.add` | Add a meal | `name`*, `meal_time`, `date`, `recipe_url`, `notes` |
| `meal_planner.update` | Update a scheduled meal | `row_id`*, `name`, `meal_time`, `date`, `recipe_url`, `notes` |
| `meal_planner.update_library` | Update a library entry | `library_id`*, `name`, `recipe_url`, `notes`, `potential` |
| `meal_planner.delete_library` | Delete a library entry and all its scheduled instances | `library_id`* |
| `meal_planner.bulk` | Bulk action on scheduled meals | `action`* (`convert_to_potential` \| `assign_date` \| `delete`), `ids`* |
| `meal_planner.clear_potential` | Remove all potential meals from the library | (none) |
| `meal_planner.clear_week` | Remove all scheduled meals in the current week | (none) |
| `meal_planner.update_settings` | Update settings | `days_after_today`, `days_to_keep` |

**\*** = required

---

## Troubleshooting

**Cards not loading** — Hard refresh the browser (Ctrl+Shift+R), then restart Home Assistant if the issue persists.

**Sensors not found** — Confirm the integration is set up under **Settings → Devices & Services**, then restart Home Assistant.

**Changes not saving** — Check the browser console (F12) for errors. Verify `config/meal_planner/` is writable.

---

## License

Open source. Feel free to modify and distribute.
