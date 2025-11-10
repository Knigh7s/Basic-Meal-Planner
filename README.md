# 🍽️ Basic Meal Planner

A simple, **zero-dependency** meal planning integration for Home Assistant with a full-featured **admin dashboard** and custom Lovelace cards.

**Version:** 0.2.1

---

## ✨ Features

### 🎯 Core Features
- **Admin Dashboard** - Full-featured meal planning interface at `/meal-planner` (add to sidebar via integration options)
- **Library-Based System** - Meal library stores all meal details; scheduled entries reference the library
- **Potential Meals** - Track meal ideas without scheduling them (leave date blank)
- **Rolling 7-Day View** - Configurable dashboard showing past/present/future meals
- **Auto Migration** - Automatically migrates from old data format to new structure

### 📱 Dashboard Features
- **Three Views**: Dashboard (scheduled meals), Meals Library, Potential Meals
- **Add/Edit Meals** - Modal forms for creating and editing meals
- **Bulk Actions** - Multi-select: Convert to Potential, Assign Date, Delete
- **Search** - Search meals library by name
- **Settings** - Configure rolling view window (days before/after today)

### 📊 Sensors
Two sensors automatically created:
- **`sensor.meal_planner_potential`** - Count of potential meals with `items` attribute (list of meal names)
- **`sensor.meal_planner_week`** - Rolling 7-day view with attributes:
  - `start` / `end` - Date range
  - `days` - Grid structure with breakfast/lunch/dinner/snack for each day
  - `days_after_today` / `days_before_today` - View configuration
  - `today_index` - Which day index is today

### 🎨 Custom Lovelace Cards
Three custom cards **auto-registered** (no manual resource setup needed):
- **Weekly Horizontal** - Days across the top
- **Weekly Vertical** - Days down the side
- **Potential Meals** - List of unscheduled meal ideas

---

## 📁 Data Structure

### Storage Location
Data stored in three JSON files in `config/meal_planner/`:
- `meal_library.json` - All meal details (name, recipe URL, notes)
- `scheduled.json` - Scheduled entries (references library by ID, date, meal time)
- `settings.json` - User settings (week start, days_after_today)

### Data Model
**Library Entry:**
```json
{
  "id": "abc123",
  "name": "Spaghetti Carbonara",
  "recipe_url": "https://example.com/recipe",
  "notes": "Family favorite"
}
```

**Scheduled Entry:**
```json
{
  "id": "def456",
  "library_id": "abc123",
  "date": "2025-01-15",
  "meal_time": "Dinner",
  "potential": false
}
```

### Migration
When upgrading from v0.2.0 or earlier:
- Old data backed up to `meals.json.backup`
- Automatically converts to new library-based structure
- Deduplicates meals by name
- No data loss

---

## 🛠 Services

| Service | Description | Fields |
|---------|-------------|--------|
| **`meal_planner.add`** | Add a meal | `name`*, `meal_time`, `date`, `recipe_url`, `notes`, `potential` |
| **`meal_planner.update`** | Update a scheduled meal | `row_id`*, `name`, `meal_time`, `date`, `recipe_url`, `notes`, `potential` |
| **`meal_planner.bulk`** | Bulk operations | `action`* (convert_to_potential \| assign_date \| delete), `ids`*, `date`, `meal_time` |
| **`meal_planner.clear_potential`** | Remove all potential meals | (none) |
| **`meal_planner.clear_week`** | Remove current week's meals | (none) |
| **`meal_planner.update_settings`** | Update dashboard settings | `week_start`, `days_after_today` |

**\*** = required field

### Service Examples

**Add a meal:**
```yaml
service: meal_planner.add
data:
  name: "Chicken Tikka Masala"
  date: "2025-01-20"
  meal_time: "Dinner"
  recipe_url: "https://example.com/recipe"
  notes: "Spicy version"
```

**Update a meal:**
```yaml
service: meal_planner.update
data:
  row_id: "abc123"
  date: "2025-01-21"
  meal_time: "Lunch"
```

**Bulk delete:**
```yaml
service: meal_planner.bulk
data:
  action: "delete"
  ids: ["abc123", "def456"]
```

---

## 🚀 Installation

### HACS (Recommended)
1. Upload this repository to GitHub
2. In Home Assistant: **HACS → Integrations → ⋮ → Custom repositories**
3. Add your repo URL and select **Integration** as category
4. Click **Install** on Basic Meal Planner
5. **Restart Home Assistant**
6. Go to **Settings → Devices & Services → Add Integration**
7. Search for "Basic Meal Planner" and configure

### Manual Installation
1. Copy `custom_components/meal_planner` to your `config/custom_components/` directory
2. **Restart Home Assistant**
3. Go to **Settings → Devices & Services → Add Integration**
4. Search for "Basic Meal Planner" and configure

---

## 🎨 Using the Custom Cards

The custom Lovelace cards are **automatically registered** - no manual resource setup needed!

### Adding Cards to Dashboard

**1. Weekly Horizontal Card**
```yaml
type: custom:meal-planner-weekly-horizontal
entity: sensor.meal_planner_week
title: This Week's Meals
```

**2. Weekly Vertical Card**
```yaml
type: custom:meal-planner-weekly-vertical
entity: sensor.meal_planner_week
title: Weekly Meal Plan
```

**3. Potential Meals Card**
```yaml
type: custom:meal-planner-potential-meals
entity: sensor.meal_planner_potential
title: Meal Ideas
```

### Card Options

All cards support:
- `entity` - The sensor entity (required)
- `title` - Card title (optional)
- `show_empty` - Show meals with no name (default: false)

---

## ⚙️ Configuration

### Dashboard Settings
Access via **Dashboard → Settings button** (⚙️):

**Days After Today (0-6):**
- Controls the rolling 7-day view window
- `3` = 3 days before + today + 3 days after (today in middle)
- `6` = 0 days before + today + 6 days after (today at top)
- `0` = 6 days before + today + 0 days after (today at bottom)

### Integration Options
Configure via **Settings → Devices & Services → Meal Planner → Configure**:
- **Add to Sidebar** - Show/hide "Meal Planner" in sidebar

---

## 🔧 Troubleshooting

### Cards show "Configuration Error"
1. Clear browser cache with hard refresh (Ctrl+Shift+R or Ctrl+F5)
2. Check Developer Tools console for errors
3. Verify sensor entities exist: `sensor.meal_planner_week` and `sensor.meal_planner_potential`
4. Restart Home Assistant

### Sensors not found
1. Check **Settings → Devices & Services → Meal Planner** is configured
2. Restart Home Assistant
3. Check logs for errors: **Settings → System → Logs**

### Changes not saving
- Changes use Home Assistant Service API (reliable)
- Check browser console for errors (F12)
- Verify data files in `config/meal_planner/` are writable

### Cache Issues
- Cards use version-based cache busting (`?v=0.2.1`)
- Browser cache should automatically clear on version update
- If issues persist, do hard refresh (Ctrl+Shift+R)

---

## 📝 Developer Notes

### File Structure
```
custom_components/meal_planner/
├── __init__.py          # Core integration logic
├── config_flow.py       # Configuration flow
├── const.py            # Constants
├── manifest.json       # Integration metadata
├── sensor.py           # Sensor entities
├── panel/              # Admin dashboard
│   ├── index.html
│   ├── app.js
│   └── style.css
└── www/                # Custom cards
    ├── meal-planner-weekly-horizontal.js
    ├── meal-planner-weekly-vertical.js
    └── meal-planner-potential-meals.js
```

### Data Storage
- **Location:** `config/meal_planner/`
- **Format:** JSON files (UTF-8, pretty-printed)
- **Backup:** Old format backed up on migration
- **Direct File I/O:** Uses `json.load()`/`json.dump()` with executor jobs

### API
- **Services:** Used for all data modifications (reliable, logged)
- **WebSocket:** Used only for data retrieval (`meal_planner/get`)
- **Frontend:** Calls Service API directly via `hass.callService()`

---

## 📄 License

This project is open source. Feel free to modify and distribute.

---

## 🙏 Contributing

Issues and pull requests welcome on GitHub!
