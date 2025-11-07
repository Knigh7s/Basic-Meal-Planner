# Custom Lovelace Cards

The Meal Planner integration includes 3 custom Lovelace cards you can add to your dashboards.

---

## 🎴 Available Cards

1. **Weekly Horizontal** - Calendar grid layout (7 days × meal times)
2. **Weekly Vertical** - Day-by-day vertical list (mobile-friendly)
3. **Potential Meals** - List of unscheduled meal ideas

---

## 📦 Installation (One-Time Setup)

After installing the integration via HACS, you need to add the card resources **once**:

### Step 1: Go to Lovelace Resources

1. Go to **Settings → Dashboards**
2. Click **⋮ (three dots)** in top right
3. Click **"Resources"**

### Step 2: Add Each Card

Click **"+ ADD RESOURCE"** and add these **3 resources**:

**Card 1: Weekly Horizontal**
- URL: `/meal_planner/meal-planner-weekly-horizontal.js`
- Type: `JavaScript Module`

**Card 2: Weekly Vertical**
- URL: `/meal_planner/meal-planner-weekly-vertical.js`
- Type: `JavaScript Module`

**Card 3: Potential Meals**
- URL: `/meal_planner/meal-planner-potential-meals.js`
- Type: `JavaScript Module`

### Step 3: Restart Browser

Close all browser tabs and reopen Home Assistant (or hard refresh with Ctrl+Shift+R).

---

## 🎨 Using the Cards

### Add to Dashboard

1. Go to your dashboard
2. Click **⋮ → Edit Dashboard**
3. Click **"+ ADD CARD"**
4. Search for "Meal Planner"
5. Pick a card

### Card Picker Names

After adding resources, you'll see:
- **Meal Planner Weekly Horizontal**
- **Meal Planner Weekly Vertical**
- **Meal Planner Potential Meals**

---

## 📝 Card Configurations

### Weekly Horizontal Card

```yaml
type: custom:meal-planner-weekly-horizontal
entity: sensor.meal_planner_week
week_start: Sunday  # or Monday
show_empty: true    # Show empty slots
show_snacks: true   # Show snack row
title: Weekly Meal Plan
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | Required | `sensor.meal_planner_week` |
| `week_start` | string | `Sunday` | `Sunday` or `Monday` |
| `show_empty` | boolean | `true` | Show empty meal slots |
| `show_snacks` | boolean | `true` | Show snack row |
| `title` | string | `Weekly Meal Plan` | Card header title |

---

### Weekly Vertical Card

```yaml
type: custom:meal-planner-weekly-vertical
entity: sensor.meal_planner_week
week_start: Sunday  # or Monday
compact: false      # Compact mode
show_snacks: true   # Show snacks
title: This Week
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | Required | `sensor.meal_planner_week` |
| `week_start` | string | `Sunday` | `Sunday` or `Monday` |
| `compact` | boolean | `false` | Compact display mode |
| `show_snacks` | boolean | `true` | Show snacks |
| `title` | string | `This Week` | Card header title |

**Compact Mode:**
- `false` - Shows all meals with icons
- `true` - Shows only day headers with meal counts

---

### Potential Meals Card

```yaml
type: custom:meal-planner-potential-meals
entity: sensor.meal_planner_potential
max_items: 10       # Maximum meals to display
show_count: true    # Show count badge
title: Potential Meals
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | Required | `sensor.meal_planner_potential` |
| `max_items` | number | `10` | Max meals to show |
| `show_count` | boolean | `true` | Show count badge in header |
| `title` | string | `Potential Meals` | Card header title |

---

## 🎯 Example Dashboard Layout

### Full-Width Weekly Grid

```yaml
type: custom:meal-planner-weekly-horizontal
entity: sensor.meal_planner_week
week_start: Sunday
show_empty: true
```

### Two-Column Layout

```yaml
type: horizontal-stack
cards:
  - type: custom:meal-planner-weekly-vertical
    entity: sensor.meal_planner_week
    compact: false

  - type: custom:meal-planner-potential-meals
    entity: sensor.meal_planner_potential
    max_items: 15
```

### Mobile View

```yaml
type: vertical-stack
cards:
  - type: custom:meal-planner-weekly-vertical
    entity: sensor.meal_planner_week
    compact: true

  - type: custom:meal-planner-potential-meals
    entity: sensor.meal_planner_potential
    max_items: 5
```

---

## 🆘 Troubleshooting

### Cards not appearing in picker

1. **Check resources are added:**
   - Settings → Dashboards → ⋮ → Resources
   - Should see 3 entries with `/meal_planner/` URLs

2. **Clear browser cache:**
   - Close all Home Assistant tabs
   - Reopen or use Ctrl+Shift+R

3. **Check browser console (F12):**
   - Look for green "MEAL-PLANNER" messages
   - Should see version numbers

### "Entity not found" error

- Make sure integration is installed and loaded
- Check entity exists: Developer Tools → States
- Search for `sensor.meal_planner_week` and `sensor.meal_planner_potential`

### Cards show "Custom element doesn't exist"

- Resources not loaded properly
- Check URL is exactly: `/meal_planner/meal-planner-weekly-horizontal.js` (note the underscore in path)
- Restart Home Assistant
- Clear browser cache

### Styles look broken

- Cards use Home Assistant theme variables
- Should adapt to your theme automatically
- Try switching themes to test

---

## 🔄 Updating

When you update the integration via HACS:

1. **Resources stay registered** - no need to re-add
2. **Restart Home Assistant**
3. **Clear browser cache** (Ctrl+Shift+R)
4. Cards automatically load new version

---

## 📱 Mobile Support

All cards are responsive:
- **Horizontal Card**: Better on tablets/desktop
- **Vertical Card**: Optimized for mobile phones
- **Potential Card**: Works on all sizes

---

## 🎨 Theme Support

Cards automatically adapt to:
- ✅ Dark mode
- ✅ Light mode
- ✅ Custom themes

Uses these CSS variables:
- `--primary-color`
- `--card-background-color`
- `--divider-color`
- `--secondary-text-color`

---

## 💡 Tips

1. **Use vertical card on mobile** - easier to scroll
2. **Use horizontal card on desktop** - better overview
3. **Limit potential meals** - set `max_items: 5` on mobile
4. **Hide snacks if you don't use them** - set `show_snacks: false`

---

## 📚 More Help

- **Integration Setup**: See main README.md
- **Report Issues**: https://github.com/Knigh7s/Basic-Meal-Planner/issues
- **Feature Requests**: Open a GitHub issue

---

**Made with ❤️ for the Home Assistant community**
