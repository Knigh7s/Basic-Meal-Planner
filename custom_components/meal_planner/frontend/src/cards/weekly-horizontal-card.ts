import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, WeeklyHorizontalCardConfig, WeeklyMealsSensorAttributes } from '../types';
import { getCurrentWeekDates, getDayLabel, isToday } from '../utils/date-utils';

/**
 * Weekly Horizontal Card
 * Displays meals in a traditional calendar grid layout (days as columns)
 */
@customElement('meal-planner-weekly-horizontal')
export class WeeklyHorizontalCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config!: WeeklyHorizontalCardConfig;

  static getStubConfig(): WeeklyHorizontalCardConfig {
    return {
      type: 'custom:meal-planner-weekly-horizontal',
      week_start: 'Sunday',
      show_empty_slots: true,
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

    .week-grid {
      display: grid;
      grid-template-columns: 100px repeat(7, 1fr);
      gap: 1px;
      background-color: var(--divider-color);
      border: 1px solid var(--divider-color);
    }

    .grid-cell {
      background-color: var(--card-background-color);
      padding: 8px;
      min-height: 60px;
    }

    .grid-header {
      background-color: var(--table-header-background-color, var(--secondary-background-color));
      font-weight: 500;
      text-align: center;
      padding: 12px 8px;
    }

    .day-header {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .day-header.today {
      background-color: var(--primary-color);
      color: var(--text-primary-color);
    }

    .meal-time-label {
      font-weight: 500;
      color: var(--secondary-text-color);
    }

    .meal-name {
      font-size: 14px;
      line-height: 1.3;
    }

    .empty-slot {
      color: var(--disabled-text-color);
      font-size: 12px;
      font-style: italic;
    }

    @media (max-width: 768px) {
      .week-grid {
        font-size: 12px;
      }

      .grid-cell {
        min-height: 40px;
        padding: 4px;
      }
    }
  `;

  setConfig(config: WeeklyHorizontalCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    this._config = {
      week_start: config.week_start || 'Sunday',
      show_empty_slots: config.show_empty_slots !== false,
      ...config,
    };
  }

  getCardSize(): number {
    return 4;
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

        <div class="week-grid">${this._renderGrid(attributes, weekStart)}</div>
      </ha-card>
    `;
  }

  private _renderGrid(attributes: WeeklyMealsSensorAttributes, weekStart: 'Sunday' | 'Monday') {
    const days = getCurrentWeekDates(weekStart);
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const mealTimes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

    // Reorder day keys based on week start
    const orderedDayKeys =
      weekStart === 'Monday'
        ? [...dayKeys.slice(1), dayKeys[0]]
        : dayKeys;

    return html`
      <!-- Corner cell -->
      <div class="grid-header"></div>

      <!-- Day headers -->
      ${orderedDayKeys.map((dayKey, index) => {
        const date = days[index];
        const todayClass = isToday(date) ? 'today' : '';

        return html`
          <div class="grid-header day-header ${todayClass}">
            <div>${getDayLabel(date, 'short')}</div>
            <div style="font-size: 12px; font-weight: normal;">${date.getDate()}</div>
          </div>
        `;
      })}

      <!-- Meal time rows -->
      ${mealTimes.map((mealTime) => {
        return html`
          <div class="grid-cell meal-time-label">${mealTime}</div>
          ${orderedDayKeys.map((dayKey) => {
            const dayData = attributes.days[dayKey];
            const mealName = dayData ? dayData[mealTime.toLowerCase()] : '';

            return html`
              <div class="grid-cell">
                ${mealName
                  ? html`<div class="meal-name">${mealName}</div>`
                  : this._config.show_empty_slots
                  ? html`<div class="empty-slot">—</div>`
                  : ''}
              </div>
            `;
          })}
        `;
      })}
    `;
  }
}

// Register the card with Home Assistant
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'meal-planner-weekly-horizontal',
  name: 'Meal Planner Weekly Horizontal',
  description: 'Display weekly meals in a calendar grid layout',
});

declare global {
  interface HTMLElementTagNameMap {
    'meal-planner-weekly-horizontal': WeeklyHorizontalCard;
  }
}
