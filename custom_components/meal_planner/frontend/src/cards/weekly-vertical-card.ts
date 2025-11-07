import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, WeeklyVerticalCardConfig, WeeklyMealsSensorAttributes } from '../types';
import { getCurrentWeekDates, getDayLabel, isToday, getRelativeDayLabel } from '../utils/date-utils';

/**
 * Weekly Vertical Card
 * Displays meals in a vertical day-by-day layout
 */
@customElement('meal-planner-weekly-vertical')
export class WeeklyVerticalCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config!: WeeklyVerticalCardConfig;

  static getStubConfig(): WeeklyVerticalCardConfig {
    return {
      type: 'custom:meal-planner-weekly-vertical',
      week_start: 'Sunday',
      compact_mode: false,
    };
  }

  static styles = css`
    :host {
      display: block;
    }

    ha-card {
      padding: 16px;
    }

    .card-header {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--divider-color);
    }

    .day-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .day-row {
      display: flex;
      gap: 12px;
      padding: 12px;
      background-color: var(--secondary-background-color);
      border-radius: 8px;
    }

    .day-row.today {
      background-color: var(--primary-color);
      color: var(--text-primary-color);
    }

    .day-label {
      min-width: 80px;
      font-weight: 500;
    }

    .day-label-date {
      font-size: 12px;
      color: var(--secondary-text-color);
    }

    .day-row.today .day-label-date {
      color: var(--text-primary-color);
      opacity: 0.8;
    }

    .meals {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .meal-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      background-color: var(--card-background-color);
      border-radius: 16px;
      font-size: 14px;
    }

    .day-row.today .meal-chip {
      background-color: rgba(255, 255, 255, 0.2);
    }

    .meal-time-icon {
      --mdc-icon-size: 16px;
    }

    .empty-day {
      color: var(--disabled-text-color);
      font-style: italic;
      font-size: 14px;
    }

    .day-row.today .empty-day {
      color: var(--text-primary-color);
      opacity: 0.7;
    }

    .compact .day-row {
      padding: 8px;
    }

    .compact .meal-chip {
      font-size: 12px;
      padding: 2px 8px;
    }

    .stats {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--divider-color);
      text-align: center;
      color: var(--secondary-text-color);
      font-size: 14px;
    }
  `;

  setConfig(config: WeeklyVerticalCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    this._config = {
      week_start: config.week_start || 'Sunday',
      compact_mode: config.compact_mode || false,
      ...config,
    };
  }

  getCardSize(): number {
    return this._config.compact_mode ? 5 : 7;
  }

  render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    const entity = this.hass.states['sensor.meal_planner_week'];
    if (!entity) {
      return html`
        <ha-card>
          <div class="card-content">
            <p>Entity sensor.meal_planner_week not found</p>
          </div>
        </ha-card>
      `;
    }

    const attributes = entity.attributes as WeeklyMealsSensorAttributes;
    const weekStart = this._config.week_start || attributes.week_start || 'Sunday';

    return html`
      <ha-card>
        <div class="card-header">
          <ha-icon icon="mdi:calendar-week"></ha-icon>
          This Week's Meals
        </div>

        <div class="day-list ${this._config.compact_mode ? 'compact' : ''}">
          ${this._renderDays(attributes, weekStart)}
        </div>

        ${this._renderStats(attributes)}
      </ha-card>
    `;
  }

  private _renderDays(attributes: WeeklyMealsSensorAttributes, weekStart: 'Sunday' | 'Monday') {
    const days = getCurrentWeekDates(weekStart);
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    // Reorder day keys based on week start
    const orderedDayKeys =
      weekStart === 'Monday'
        ? [...dayKeys.slice(1), dayKeys[0]]
        : dayKeys;

    return orderedDayKeys.map((dayKey, index) => {
      const date = days[index];
      const dayData = attributes.days[dayKey];
      const todayClass = isToday(date) ? 'today' : '';

      const meals = [
        { time: 'Breakfast', name: dayData?.breakfast, icon: 'mdi:coffee' },
        { time: 'Lunch', name: dayData?.lunch, icon: 'mdi:food' },
        { time: 'Dinner', name: dayData?.dinner, icon: 'mdi:silverware-fork-knife' },
        { time: 'Snack', name: dayData?.snack, icon: 'mdi:food-apple' },
      ].filter((m) => m.name);

      return html`
        <div class="day-row ${todayClass}">
          <div class="day-label">
            <div>${getRelativeDayLabel(date)}</div>
            <div class="day-label-date">${getDayLabel(date, 'short')} ${date.getDate()}</div>
          </div>

          <div class="meals">
            ${meals.length > 0
              ? meals.map(
                  (meal) => html`
                    <div class="meal-chip">
                      <ha-icon class="meal-time-icon" icon=${meal.icon}></ha-icon>
                      ${meal.name}
                    </div>
                  `
                )
              : html`<div class="empty-day">No meals planned</div>`}
          </div>
        </div>
      `;
    });
  }

  private _renderStats(attributes: WeeklyMealsSensorAttributes) {
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let totalMeals = 0;

    for (const dayKey of dayKeys) {
      const dayData = attributes.days[dayKey];
      if (dayData) {
        if (dayData.breakfast) totalMeals++;
        if (dayData.lunch) totalMeals++;
        if (dayData.dinner) totalMeals++;
        if (dayData.snack) totalMeals++;
      }
    }

    return html`
      <div class="stats">
        ${totalMeals} meal${totalMeals !== 1 ? 's' : ''} planned this week
      </div>
    `;
  }
}

// Register the card with Home Assistant
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'meal-planner-weekly-vertical',
  name: 'Meal Planner Weekly Vertical',
  description: 'Display weekly meals in a vertical day-by-day layout',
});

declare global {
  interface HTMLElementTagNameMap {
    'meal-planner-weekly-vertical': WeeklyVerticalCard;
  }
}
