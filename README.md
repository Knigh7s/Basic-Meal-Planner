# 🍽️ Basic Meal Planner

A simple, **zero-dependency** meal planning integration for Home Assistant with an **admin dashboard** and Lovelace support.

---

## ✨ Features
- **Admin dashboard** at `/meal-planner` (Add “Meal Planner” to sidebar via integration options).
- **Unified storage** for all meals (scheduled, future, and potential — date blank).
- **Default**: admin hides meals older than the **last completed week**; toggle to show all.
- **Bulk actions**: Convert to Potential, Assign date, Delete (multi-select).
- **Filters**: by **Week** or **Month** (admin display only).
- **Meal Library**: auto-remembers names (+ recipe/notes) for reuse.
- **Sensors**:
  - `sensor.meal_planner_potential` → attribute `items` (unscheduled names).
  - `sensor.meal_planner_week` → attributes `start`, `end`, `days` (weekly grid).
- **Frontend-only** weekly card controls (week start + layout) via helpers (included package).

---

## 🧭 Available Functions

| Feature | Description |
|--------|-------------|
| **Add Meal** | Add name, optional date, meal time, recipe URL, notes. Blank date → Potential. |
| **Meal Library** | Name suggestions appear as you type; library is auto-updated. |
| **Admin Filters** | Hide past week (default), filter by week or month (display-only). |
| **Bulk Actions** | Convert to Potential (clear date), Assign date (date & meal time), Delete row. |
| **Potential Meals Sensor** | `sensor.meal_planner_potential` lists unscheduled meal names as an attribute. |
| **Weekly View Sensor** | `sensor.meal_planner_week` exposes the current week's meals for Lovelace. |
| **Frontend Controls** | Weekly card reads helpers for **week start** and **layout** (provided in `/packages/helpers.yaml`). |

---

## 🛠 Services

| Service | Description |
|--------|-------------|
| `meal_planner.add` | Add a meal (blank date = Potential). Fields: `name`, `meal_time`, `date?`, `recipe_url?`, `notes?`. |
| `meal_planner.bulk` | Bulk actions. Fields: `action` (convert_to_potential \| assign_date \| delete), `ids`, `date?`, `meal_time?`. |
| `meal_planner.clear_potential` | Remove all Potential (unscheduled) meals. |
| `meal_planner.clear_week` | Remove scheduled meals in the **current week**. |
| `meal_planner.promote_future_to_week` | No-op in unified model (kept for compatibility). |

---

## 🚀 Install (HACS)
1. Upload this repository to GitHub.
2. In Home Assistant: **HACS → Integrations → ⋮ → Custom repositories** → add your repo URL as **Integration**.
3. Install **Basic Meal Planner**.
4. **Restart Home Assistant**.

---

## 🧩 Lovelace Examples (included in `/examples/lovelace/`)

- `weekly_horizontal.yaml` — Weekly view with **days across the top**.
- `weekly_vertical.yaml` — Weekly view with **days down the side**.
- `potential_meals.yaml` — Potential Meals markdown card.

Use **Add Card → Markdown** and paste the content from these files.

---
