# 🍽️ Basic Meal Planner (HACS Integration)

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

## 🧲 Sidebar Button (Toggle)
After installing:
- Home Assistant → **Settings → Devices & Services → Integrations → Basic Meal Planner → Configure**.
- Enable **“Add ‘Meal Planner’ to sidebar”**. *(Default: ON)*
- This adds a **Meal Planner** button to the sidebar that opens the admin dashboard.

> Prefer manual control? Add a **Webpage** panel pointing to `/meal-planner`.

---

## 🧩 Lovelace Examples (included in `/examples/lovelace/`)

- `weekly_horizontal.yaml` — Weekly view with **days across the top**.
- `weekly_vertical.yaml` — Weekly view with **days down the side**.
- `potential_meals.yaml` — Potential Meals markdown card.

Use **Add Card → Markdown** and paste the content from these files.

---

## 📦 Helpers Package (included in `/packages/helpers.yaml`)

Creates two helpers used by your weekly cards:
- `input_select.meal_planner_week_start` → **Sunday** | **Monday**
- `input_select.meal_planner_layout` → **Horizontal** | **Vertical**

To use the package, enable packages in `configuration.yaml`:
```yaml
homeassistant:
  packages: !include_dir_named packages
```
Then copy `packages/helpers.yaml` into your HA `/config/packages/` directory and restart HA.

---

## 🧪 Quick Test
- Add a meal without a date → it appears as **Potential** (and on the Potential Meals card).
- Add a meal with a date this week → it appears in the Weekly card in the relevant day/slot.
- Toggle “Hide past week” on the admin dashboard to see it filter the list.

---

## 📄 License
This project is licensed under the **MIT License**. See `LICENSE`.

MIT is permissive: others can use/modify your code (even commercially) as long as they keep your copyright + license notice.

---

Enjoy! 🎉
