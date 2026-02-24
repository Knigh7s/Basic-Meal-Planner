// meal-planner-weekly-vertical.js
// Custom Lovelace card for weekly meal planning (vertical day-by-day layout)

class MealPlannerWeeklyVertical extends HTMLElement {
  setConfig(config) {
    // Default to sensor.meal_planner_week if not specified
    this.config = {
      entity: (config && config.entity) || 'sensor.meal_planner_week',
      week_start: (config && config.week_start) || 'Sunday',
      compact: (config && config.compact) || false,
      show_snacks: (config && config.show_snacks !== false) !== false,
      title: (config && config.title) || 'Meal Plan'
    };

    if (!this.content) {
      this.innerHTML = `
        <style>${this.constructor.styles}</style>
        <ha-card class="meal-planner-vertical-card">
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
    const totalDays = entity.attributes.total_days || 7;
    const todayIndex = entity.attributes.today_index || 3;

    this.header.textContent = this.config.title;

    // Build day order from day0, day1, day2, etc.
    const dayOrder = [];
    for (let i = 0; i < totalDays; i++) {
      dayOrder.push(`day${i}`);
    }

    const mealTimes = ['breakfast', 'lunch', 'dinner'];
    if (this.config.show_snacks) {
      mealTimes.push('snack');
    }

    let html = '<div class="day-list">';

    dayOrder.forEach((day, index) => {
      const dayData = days[day] || {};
      const label = dayData.label || day.toUpperCase();
      const dateStr = dayData.date || '';
      const isToday = index === todayIndex;  // today is at the specified index

      // Get day name and date number
      const dayParts = label.split(' ');
      const dayName = dayParts[0]; // e.g., "Mon"
      const dateNum = dayParts.length > 1 ? dayParts[1] : '';  // e.g., "26"

      html += `<div class="day-row ${isToday ? 'today' : ''}">`;

      // Left side - Date
      html += `<div class="date-col">`;
      html += `<div class="day-name">${dayName}</div>`;
      if (dateNum) {
        html += `<div class="date-num">${dateNum}</div>`;
      }
      html += `</div>`;

      // Right side - Meals
      html += `<div class="meals-col">`;

      if (!this.config.compact) {
        let hasMeals = false;
        mealTimes.forEach(mealTime => {
          const meal = dayData[mealTime] || '';
          if (meal && meal.trim()) {
            hasMeals = true;
            html += `<div class="meal-item">`;
            html += `<div class="meal-details">`;
            html += `<span class="meal-name">${this.escapeHtml(meal)}</span>`;
            html += `<span class="meal-time">${this.capitalize(mealTime)}</span>`;
            html += `</div>`;
            html += `</div>`;
          }
        });

        if (!hasMeals) {
          html += `<div class="no-meals">No meals planned</div>`;
        }
      }

      html += `</div>`;
      html += `</div>`;
    });

    html += '</div>';
    this.content.innerHTML = html;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getCardSize() {
    return this.config.compact ? 3 : 5;
  }

  getGridOptions() {
    return { columns: 6, rows: 5, min_columns: 3, min_rows: 3 };
  }

  static get styles() {
    return `
      .meal-planner-vertical-card .day-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 4px;
      }

      .meal-planner-vertical-card .day-row {
        display: flex;
        align-items: stretch;
        border-radius: 12px;
        overflow: hidden;
        background: var(--card-background-color, #2b2b2b);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        min-height: 60px;
      }

      .meal-planner-vertical-card .day-row.today {
        background: linear-gradient(135deg,
          var(--primary-color, #e91e63) 0%,
          var(--accent-color, #9c27b0) 100%);
        box-shadow: 0 4px 12px rgba(233, 30, 99, 0.4);
      }

      .meal-planner-vertical-card .date-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 70px;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.15);
        border-right: 2px solid rgba(255, 255, 255, 0.1);
      }

      .meal-planner-vertical-card .day-row.today .date-col {
        background: rgba(255, 255, 255, 0.2);
        border-right-color: rgba(255, 255, 255, 0.3);
      }

      .meal-planner-vertical-card .day-name {
        font-size: 0.75em;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--secondary-text-color, #aaa);
        margin-bottom: 2px;
      }

      .meal-planner-vertical-card .day-row.today .day-name {
        color: rgba(255, 255, 255, 0.9);
      }

      .meal-planner-vertical-card .date-num {
        font-size: 1.8em;
        font-weight: 700;
        line-height: 1;
        color: var(--primary-text-color, #fff);
      }

      .meal-planner-vertical-card .day-row.today .date-num {
        color: #fff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .meal-planner-vertical-card .meals-col {
        flex: 1;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        justify-content: center;
      }

      .meal-planner-vertical-card .meal-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
      }

      .meal-planner-vertical-card .meal-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .meal-planner-vertical-card .meal-name {
        font-size: 0.95em;
        font-weight: 500;
        color: var(--primary-text-color, #fff);
        line-height: 1.3;
      }

      .meal-planner-vertical-card .day-row.today .meal-name {
        color: #fff;
      }

      .meal-planner-vertical-card .meal-time {
        font-size: 0.75em;
        color: var(--secondary-text-color, #aaa);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .meal-planner-vertical-card .day-row.today .meal-time {
        color: rgba(255, 255, 255, 0.8);
      }

      .meal-planner-vertical-card .no-meals {
        font-size: 0.85em;
        color: var(--secondary-text-color, #666);
        font-style: italic;
        padding: 4px 0;
      }

      .meal-planner-vertical-card .day-row.today .no-meals {
        color: rgba(255, 255, 255, 0.7);
      }

      .meal-planner-vertical-card .error {
        color: var(--error-color);
        padding: 16px;
        text-align: center;
      }
    `;
  }
}

// Only define if not already defined
if (!customElements.get('meal-planner-weekly-vertical')) {
  customElements.define('meal-planner-weekly-vertical', MealPlannerWeeklyVertical);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === 'meal-planner-weekly-vertical')) {
  window.customCards.push({
    type: 'meal-planner-weekly-vertical',
    name: 'Meal Planner: Weekly Vertical',
    description: 'Weekly meal plan in a vertical day-by-day layout',
    preview: false,
    documentationURL: 'https://github.com/Knigh7s/Basic-Meal-Planner'
  });
}

console.info(
  '%c MEAL-PLANNER-WEEKLY-VERTICAL %c v0.1.1 ',
  'color: white; background: green; font-weight: 700;',
  'color: green; background: white; font-weight: 700;'
);
