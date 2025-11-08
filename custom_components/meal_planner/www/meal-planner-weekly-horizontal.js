// meal-planner-weekly-horizontal.js
// Custom Lovelace card for weekly meal planning (horizontal calendar grid)

class MealPlannerWeeklyHorizontal extends HTMLElement {
  setConfig(config) {
    // Default to sensor.meal_planner_week if not specified
    this.config = {
      entity: (config && config.entity) || 'sensor.meal_planner_week',
      week_start: (config && config.week_start) || 'Sunday',
      show_empty: (config && config.show_empty !== false) !== false,
      show_snacks: (config && config.show_snacks !== false) !== false,
      title: (config && config.title) || 'Weekly Meal Plan'
    };

    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <div class="card-header">
            <div class="name"></div>
          </div>
          <div class="card-content"></div>
        </ha-card>
      `;
      this.content = this.querySelector('.card-content');
      this.header = this.querySelector('.name');
    }
  }

  set hass(hass) {
    this._hass = hass;

    const entity = hass.states[this.config.entity];
    if (!entity) {
      this.content.innerHTML = `<div class="error">Entity ${this.config.entity} not found</div>`;
      return;
    }

    this.updateCard(entity);
  }

  updateCard(entity) {
    const days = entity.attributes.days || {};
    const weekStart = entity.attributes.week_start || this.config.week_start;
    const dateRange = entity.state || '';

    this.header.textContent = `${this.config.title} (${dateRange})`;

    // Day order based on week start
    const dayOrder = weekStart === 'Monday'
      ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    const mealTimes = ['breakfast', 'lunch', 'dinner'];
    if (this.config.show_snacks) {
      mealTimes.push('snack');
    }

    // Build table
    let html = '<table class="meal-grid"><thead><tr><th></th>';

    // Header row (days)
    dayOrder.forEach(day => {
      const label = days[day]?.label || day.toUpperCase();
      html += `<th>${label}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Meal time rows
    mealTimes.forEach(mealTime => {
      html += `<tr><th class="meal-time">${this.capitalize(mealTime)}</th>`;

      dayOrder.forEach(day => {
        const meal = days[day]?.[mealTime] || '';
        const isEmpty = !meal || meal.trim() === '';

        if (isEmpty && !this.config.show_empty) {
          html += '<td class="empty"></td>';
        } else if (isEmpty) {
          html += '<td class="empty">—</td>';
        } else {
          html += `<td class="meal">${this.escapeHtml(meal)}</td>`;
        }
      });

      html += '</tr>';
    });

    html += '</tbody></table>';
    this.content.innerHTML = html;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getCardSize() {
    return 4;
  }

  static get styles() {
    return `
      .meal-grid {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .meal-grid th, .meal-grid td {
        padding: 8px;
        text-align: center;
        border: 1px solid var(--divider-color);
      }
      .meal-grid thead th {
        background: var(--primary-color);
        color: var(--text-primary-color);
        font-weight: 600;
      }
      .meal-grid tbody th.meal-time {
        background: var(--secondary-background-color);
        font-weight: 500;
        text-align: left;
      }
      .meal-grid td.meal {
        background: var(--card-background-color);
      }
      .meal-grid td.empty {
        background: var(--secondary-background-color);
        opacity: 0.5;
      }
      .error {
        color: var(--error-color);
        padding: 16px;
      }
    `;
  }
}

// Define the custom element
customElements.define('meal-planner-weekly-horizontal', MealPlannerWeeklyHorizontal);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'meal-planner-weekly-horizontal',
  name: 'Meal Planner Weekly Horizontal',
  description: 'Weekly meal plan in calendar grid layout',
  preview: false,
  documentationURL: 'https://github.com/Knigh7s/Basic-Meal-Planner'
});

console.info(
  '%c MEAL-PLANNER-WEEKLY-HORIZONTAL %c v0.1.0 ',
  'color: white; background: green; font-weight: 700;',
  'color: green; background: white; font-weight: 700;'
);
