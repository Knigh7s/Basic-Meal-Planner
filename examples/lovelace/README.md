# Lovelace Dashboard Cards for Meal Planner

This directory contains pre-built Lovelace dashboard card configurations for the Meal Planner custom integration. These cards provide beautiful, functional interfaces to view and manage your meal planning directly from your Home Assistant dashboard.

## Available Cards

### 1. Weekly Horizontal Grid (`weekly_horizontal.yaml`)
Displays your weekly meal schedule with days as columns and meal times (Breakfast, Lunch, Dinner, Snack) as rows. Perfect for a traditional calendar-style view.

**Features:**
- Color-coded header with week date range
- HTML table grid with custom styling
- Empty slots clearly marked
- Quick action buttons (Clear Week, Add Meal)
- Responsive design

**Best for:** Desktop dashboards, wall-mounted tablets

### 2. Weekly Vertical Grid (`weekly_vertical.yaml`)
Shows your weekly schedule with each day as a row, displaying all meal times horizontally. Includes completion statistics and progress bar.

**Features:**
- Day-by-day vertical layout
- Today's date highlighted
- Weekly completion statistics (meals planned, slots empty, percentage)
- Visual progress bar
- Summary metrics
- Quick action buttons

**Best for:** Mobile devices, compact views

### 3. Potential Meals Card (`potential_meals.yaml`)
Lists all unscheduled "potential" meals that can be added to your weekly plan.

**Features:**
- Numbered meal list
- Empty state handling
- Status indicators (Empty/Good/Great/Excellent)
- Dynamic statistics
- Quick actions (Clear All, Add Meal)
- Gradient header

**Best for:** Sidebar, meal planning dashboard section

## Installation

### Prerequisites

**Option 1: Enhanced Version (Recommended)**
Install these custom cards from HACS for the best experience:
- [card-mod](https://github.com/thomasloven/lovelace-card-mod) - For custom styling
- [vertical-stack-in-card](https://github.com/ofekashery/vertical-stack-in-card) - For card grouping

**Option 2: Basic Version**
No additional cards required! Each configuration file includes an "ALTERNATIVE" version at the bottom that works with stock Home Assistant cards.

### Installation Steps

1. **Open your Lovelace dashboard in edit mode:**
   - Navigate to your dashboard
   - Click the three dots (⋮) in the top right
   - Select "Edit Dashboard"

2. **Add a new card:**
   - Click "+ Add Card" button
   - Scroll down and click "Manual" (or "Show Code Editor")

3. **Copy the card configuration:**
   - Open the desired YAML file from this directory
   - Copy the entire contents
   - If you don't have card-mod/vertical-stack-in-card installed, copy the ALTERNATIVE version at the bottom of the file instead

4. **Paste and save:**
   - Paste the configuration into the card editor
   - Click "Save" to add the card to your dashboard

5. **Adjust entity IDs (if needed):**
   - If your sensors have different names, update the entity IDs in the configuration:
     - `sensor.meal_planner_week` → your week sensor entity ID
     - `sensor.meal_planner_potential` → your potential meals sensor entity ID

## Customization

### Changing Colors

All cards use Home Assistant CSS variables for theming. They automatically adapt to your chosen theme. Common variables include:

- `--primary-color` - Main accent color
- `--accent-color` - Secondary accent color
- `--card-background-color` - Card backgrounds
- `--primary-text-color` - Main text
- `--secondary-text-color` - Dimmed text
- `--divider-color` - Borders and dividers
- `--success-color` - Success buttons (green)
- `--warning-color` - Warning buttons (orange)
- `--error-color` - Error/delete buttons (red)

### Modifying Icons

To change the meal time icons, edit the emoji in the template:

```yaml
{% set meal_times = [
  {'key': 'breakfast', 'icon': '🌅', 'label': 'Breakfast'},  # Change 🌅 to your preferred icon
  {'key': 'lunch', 'icon': '☀️', 'label': 'Lunch'},
  {'key': 'dinner', 'icon': '🌙', 'label': 'Dinner'},
  {'key': 'snack', 'icon': '🍿', 'label': 'Snack'}
] %}
```

### Changing Day Order

By default, weeks start on Sunday. To change to Monday-first:

```yaml
{% set day_order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] %}
```

### Hiding Specific Meal Times

To hide snacks from the grid, remove them from the `meal_times` array:

```yaml
{% set meal_times = [
  {'key': 'breakfast', 'icon': '🌅', 'label': 'Breakfast'},
  {'key': 'lunch', 'icon': '☀️', 'label': 'Lunch'},
  {'key': 'dinner', 'icon': '🌙', 'label': 'Dinner'}
  # Removed snack
] %}
```

## Advanced Usage

### Combining Cards

Create a comprehensive meal planning dashboard by combining all three cards:

```yaml
type: vertical-stack
cards:
  # Add weekly_vertical.yaml configuration here

  # Add potential_meals.yaml configuration here
```

### Mobile Responsive Layout

Use the grid card for mobile-friendly layouts:

```yaml
type: grid
columns: 1
square: false
cards:
  # Add weekly_vertical.yaml (works best on mobile)

  # Add potential_meals.yaml
```

### Conditional Card Display

Show different cards based on screen size using conditional cards:

```yaml
type: conditional
conditions:
  - condition: screen
    media_query: "(min-width: 768px)"
card:
  # Show horizontal grid on desktop
  # paste weekly_horizontal.yaml config
```

## Troubleshooting

### Card shows "Entity not available"
**Solution:** Your meal planner integration isn't loaded or configured. Check:
1. Integration is installed in `custom_components/meal_planner/`
2. Home Assistant has been restarted after installation
3. Integration is configured (check Configuration → Integrations)

### "Custom element doesn't exist: vertical-stack-in-card"
**Solution:** You're using the enhanced version without the required custom cards. Either:
1. Install `vertical-stack-in-card` from HACS, or
2. Use the ALTERNATIVE version at the bottom of each YAML file

### Styling doesn't appear / Card looks plain
**Solution:** You're missing `card-mod`. Either:
1. Install `card-mod` from HACS, or
2. Use the ALTERNATIVE version which uses basic markdown tables

### Template errors or "UndefinedError"
**Solution:** Ensure your sensor provides the expected attributes:
- `sensor.meal_planner_week` must have `days` attribute with structure documented above
- `sensor.meal_planner_potential` must have `items` attribute (array of strings)

### Dates not displaying correctly
**Solution:** Check your Home Assistant timezone settings:
1. Go to Configuration → General
2. Verify "Time Zone" is set correctly
3. Restart Home Assistant

## Example Dashboard Layout

Here's a recommended full dashboard layout:

```yaml
views:
  - title: Meal Planning
    path: meals
    icon: mdi:food
    cards:
      - type: vertical-stack
        cards:
          # Weekly vertical grid (paste weekly_vertical.yaml)

      - type: horizontal-stack
        cards:
          # Potential meals (paste potential_meals.yaml)

          # You could add a second column here for shopping lists, etc.
```

## Card Comparison

| Feature | Horizontal Grid | Vertical Grid | Potential Meals |
|---------|----------------|---------------|-----------------|
| Layout | Days as columns | Days as rows | List view |
| Best Device | Desktop/Tablet | Mobile/Any | Any |
| Statistics | No | Yes | Yes |
| Progress Bar | No | Yes | No |
| Action Buttons | Yes | Yes | Yes |
| Space Used | Wide | Compact | Compact |
| Empty State | Dashes | "No meal planned" | Custom message |

## Support

For issues or questions:
1. Check the main integration documentation
2. Verify your sensor entities are providing the correct data structure
3. Test with the ALTERNATIVE basic versions first
4. Check Home Assistant logs for template errors

## Version History

- **v1.0** - Initial release with three card types
  - Weekly horizontal grid
  - Weekly vertical grid with statistics
  - Potential meals list

## License

These Lovelace configurations are provided as part of the Meal Planner custom integration and follow the same license.
