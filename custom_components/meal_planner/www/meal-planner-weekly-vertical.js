// meal-planner-weekly-vertical.js
// Custom Lovelace card for weekly meal planning (vertical day-by-day layout)

class MealPlannerWeeklyVertical extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity (sensor.meal_planner_week)');
    }

    this.config = {
      entity: config.entity,
      week_start: config.week_start || 'Sunday',
      compact: config.compact || false,
      show_snacks: config.show_snacks !== false,
      title: config.title || 'This Week'
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

    // Day order
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

    let html = '<div class="day-list">';

    dayOrder.forEach(day => {
      const dayData = days[day] || {};
      const label = dayData.label || day.toUpperCase();
      const isToday = day === todayCode;

      // Count meals for this day
      let mealCount = 0;
      mealTimes.forEach(mealTime => {
        if (dayData[mealTime] && dayData[mealTime].trim()) {
          mealCount++;
        }
      });

      html += `<div class="day-row ${isToday ? 'today' : ''}">`;
      html += `<div class="day-header">`;
      html += `<span class="day-label">${label}</span>`;
      if (isToday) html += `<span class="today-badge">Today</span>`;
      html += `<span class="meal-count">${mealCount}/${mealTimes.length}</span>`;
      html += `</div>`;

      if (!this.config.compact) {
        html += `<div class="meal-list">`;
        mealTimes.forEach(mealTime => {
          const meal = dayData[mealTime] || '';
          const icon = this.getMealIcon(mealTime);
          if (meal && meal.trim()) {
            html += `<div class="meal-item">`;
            html += `<span class="meal-icon">${icon}</span>`;
            html += `<span class="meal-name">${this.escapeHtml(meal)}</span>`;
            html += `</div>`;
          }
        });
        html += `</div>`;
      }

      html += `</div>`;
    });

    html += '</div>';
    this.content.innerHTML = html;
  }

  getMealIcon(mealTime) {
    const icons = {
      breakfast: '🍳',
      lunch: '🥗',
      dinner: '🍽️',
      snack: '🍿'
    };
    return icons[mealTime] || '🍴';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getCardSize() {
    return this.config.compact ? 3 : 5;
  }

  static get styles() {
    return `
      .day-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .day-row {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 12px;
        background: var(--card-background-color);
      }
      .day-row.today {
        border-color: var(--primary-color);
        border-width: 2px;
        background: var(--primary-background-color);
      }
      .day-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .day-label {
        font-weight: 600;
        font-size: 1.1em;
      }
      .today-badge {
        background: var(--primary-color);
        color: var(--text-primary-color);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: 600;
      }
      .meal-count {
        margin-left: auto;
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }
      .meal-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .meal-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }
      .meal-icon {
        font-size: 1.2em;
      }
      .meal-name {
        flex: 1;
      }
      .error {
        color: var(--error-color);
        padding: 16px;
      }
    `;
  }
}

customElements.define('meal-planner-weekly-vertical', MealPlannerWeeklyVertical);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'meal-planner-weekly-vertical',
  name: 'Meal Planner Weekly Vertical',
  description: 'Weekly meal plan in vertical day-by-day layout',
  preview: false,
  documentationURL: 'https://github.com/Knigh7s/Basic-Meal-Planner'
});

console.info(
  '%c MEAL-PLANNER-WEEKLY-VERTICAL %c v0.1.0 ',
  'color: white; background: green; font-weight: 700;',
  'color: green; background: white; font-weight: 700;'
);
