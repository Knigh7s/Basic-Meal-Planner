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
        <style>${this.constructor.styles}</style>
        <ha-card class="meal-planner-horizontal-card">
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
    const startDate = entity.attributes.start || '';
    const endDate = entity.attributes.end || '';

    // Format date range as "Nov 02 - Nov 08"
    let dateRangeFormatted = '';
    if (startDate && endDate) {
      // Parse dates without timezone conversion
      const startParts = startDate.split('-');
      const endParts = endDate.split('-');
      const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
      const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));

      const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      const startDay = String(start.getDate()).padStart(2, '0');
      const endDay = String(end.getDate()).padStart(2, '0');
      dateRangeFormatted = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }

    this.header.textContent = dateRangeFormatted
      ? `${this.config.title} - ${dateRangeFormatted}`
      : this.config.title;

    // Day order based on week start
    const dayOrder = weekStart === 'Monday'
      ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    const mealTimes = ['breakfast', 'lunch', 'dinner'];
    if (this.config.show_snacks) {
      mealTimes.push('snack');
    }

    // Get today's day code
    const today = new Date();
    const todayCode = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()];

    // Build table
    let html = '<table class="meal-grid"><thead><tr><th class="corner-cell"></th>';

    // Header row (days)
    dayOrder.forEach(day => {
      const dayData = days[day] || {};
      const label = dayData.label || day.toUpperCase();
      const isToday = day === todayCode;

      // Get day name and date number
      const dayParts = label.split(' ');
      const dayName = dayParts[0];
      const dateNum = dayParts.length > 1 ? dayParts[1] : '';

      html += `<th class="day-header ${isToday ? 'today' : ''}">`;
      html += `<div class="day-name">${dayName}</div>`;
      if (dateNum) {
        html += `<div class="date-num">${dateNum}</div>`;
      }
      html += `</th>`;
    });
    html += '</tr></thead><tbody>';

    // Meal time rows
    mealTimes.forEach(mealTime => {
      html += `<tr><th class="meal-time">${this.capitalize(mealTime)}</th>`;

      dayOrder.forEach(day => {
        const meal = days[day]?.[mealTime] || '';
        const isEmpty = !meal || meal.trim() === '';
        const isToday = day === todayCode;

        if (isEmpty && !this.config.show_empty) {
          html += `<td class="empty ${isToday ? 'today' : ''}"></td>`;
        } else if (isEmpty) {
          html += `<td class="empty ${isToday ? 'today' : ''}">—</td>`;
        } else {
          html += `<td class="meal ${isToday ? 'today' : ''}">${this.escapeHtml(meal)}</td>`;
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
      .meal-planner-horizontal-card .card-content {
        padding: 0;
        overflow-x: auto;
      }

      .meal-planner-horizontal-card .meal-grid {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        table-layout: fixed;
      }

      .meal-planner-horizontal-card .meal-grid th,
      .meal-planner-horizontal-card .meal-grid td {
        padding: 12px 10px;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: all 0.2s ease;
      }

      /* Corner cell */
      .meal-planner-horizontal-card .meal-grid .corner-cell {
        background: transparent;
        border: none;
        width: 80px;
      }

      /* Day headers */
      .meal-planner-horizontal-card .meal-grid thead th.day-header {
        background: linear-gradient(180deg,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.15) 0%,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.05) 100%);
        font-weight: 600;
        padding: 14px 8px;
        border-bottom: 2px solid rgba(var(--rgb-primary-color, 3, 169, 244), 0.3);
        position: relative;
      }

      .meal-planner-horizontal-card .meal-grid thead th.day-header.today {
        background: linear-gradient(180deg,
          var(--primary-color, #e91e63) 0%,
          var(--accent-color, #9c27b0) 100%);
        color: #fff;
        box-shadow: 0 3px 10px rgba(233, 30, 99, 0.3);
        border-bottom-color: rgba(255, 255, 255, 0.3);
      }

      .meal-planner-horizontal-card .meal-grid thead th.day-header .day-name {
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
        opacity: 0.9;
      }

      .meal-planner-horizontal-card .meal-grid thead th.day-header.today .day-name {
        color: rgba(255, 255, 255, 0.95);
      }

      .meal-planner-horizontal-card .meal-grid thead th.day-header .date-num {
        font-size: 1.4em;
        font-weight: 700;
        line-height: 1;
      }

      .meal-planner-horizontal-card .meal-grid thead th.day-header.today .date-num {
        color: #fff;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }

      /* Meal time labels */
      .meal-planner-horizontal-card .meal-grid tbody th.meal-time {
        background: linear-gradient(90deg,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.12) 0%,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.04) 100%);
        font-weight: 600;
        text-align: left;
        white-space: nowrap;
        padding-left: 12px;
        border-right: 2px solid rgba(var(--rgb-primary-color, 3, 169, 244), 0.2);
        color: var(--primary-text-color, #fff);
      }

      /* Meal cells */
      .meal-planner-horizontal-card .meal-grid td {
        background: var(--card-background-color, #2b2b2b);
        font-size: 0.9em;
        padding: 14px 10px;
        vertical-align: middle;
        position: relative;
      }

      .meal-planner-horizontal-card .meal-grid td.meal {
        background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.08);
        font-weight: 500;
        color: var(--primary-text-color, #fff);
        cursor: default;
      }

      .meal-planner-horizontal-card .meal-grid td.today {
        background: linear-gradient(180deg,
          rgba(233, 30, 99, 0.2) 0%,
          rgba(156, 39, 176, 0.15) 100%);
        border-left: 2px solid rgba(233, 30, 99, 0.4);
        border-right: 2px solid rgba(233, 30, 99, 0.4);
      }

      .meal-planner-horizontal-card .meal-grid td.meal.today {
        background: linear-gradient(180deg,
          rgba(233, 30, 99, 0.25) 0%,
          rgba(156, 39, 176, 0.2) 100%);
        font-weight: 600;
        color: #fff;
      }

      .meal-planner-horizontal-card .meal-grid td.empty {
        background: rgba(0, 0, 0, 0.15);
        color: var(--secondary-text-color, #888);
        opacity: 0.6;
      }

      .meal-planner-horizontal-card .meal-grid td.empty.today {
        background: linear-gradient(180deg,
          rgba(233, 30, 99, 0.15) 0%,
          rgba(156, 39, 176, 0.1) 100%);
        opacity: 0.8;
      }

      /* First/last cell rounding */
      .meal-planner-horizontal-card .meal-grid thead tr:first-child th:first-child {
        border-top-left-radius: 8px;
      }

      .meal-planner-horizontal-card .meal-grid thead tr:first-child th:last-child {
        border-top-right-radius: 8px;
      }

      .meal-planner-horizontal-card .meal-grid tbody tr:last-child th:first-child {
        border-bottom-left-radius: 8px;
      }

      .meal-planner-horizontal-card .meal-grid tbody tr:last-child td:last-child {
        border-bottom-right-radius: 8px;
      }

      .meal-planner-horizontal-card .error {
        color: var(--error-color);
        padding: 16px;
        text-align: center;
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
