import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, PotentialMealsCardConfig, PotentialMealsSensorAttributes } from '../types';

/**
 * Potential Meals Card
 * Displays unscheduled meals
 */
@customElement('meal-planner-potential-meals')
export class PotentialMealsCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config!: PotentialMealsCardConfig;

  static getStubConfig(): PotentialMealsCardConfig {
    return {
      type: 'custom:meal-planner-potential-meals',
      max_items: 10,
      show_count: true,
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--divider-color);
    }

    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 8px;
      background-color: var(--primary-color);
      color: var(--text-primary-color);
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
    }

    .meals-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .meal-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background-color: var(--secondary-background-color);
      border-radius: 8px;
    }

    .meal-icon {
      --mdc-icon-size: 20px;
      color: var(--secondary-text-color);
    }

    .meal-name {
      flex: 1;
      font-size: 14px;
    }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: var(--secondary-text-color);
    }

    .empty-state ha-icon {
      --mdc-icon-size: 48px;
      color: var(--disabled-text-color);
      margin-bottom: 8px;
    }

    .show-more {
      text-align: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--divider-color);
    }

    .show-more a {
      color: var(--primary-color);
      text-decoration: none;
      font-size: 14px;
    }

    .show-more a:hover {
      text-decoration: underline;
    }
  `;

  setConfig(config: PotentialMealsCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    this._config = {
      max_items: config.max_items || 10,
      show_count: config.show_count !== false,
      ...config,
    };
  }

  getCardSize(): number {
    return 3;
  }

  render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    const entity = this.hass.states['sensor.meal_planner_potential'];
    if (!entity) {
      return html`
        <ha-card>
          <div class="card-content">
            <p>Entity sensor.meal_planner_potential not found</p>
          </div>
        </ha-card>
      `;
    }

    const count = parseInt(entity.state, 10) || 0;
    const attributes = entity.attributes as PotentialMealsSensorAttributes;
    const items = attributes.items || [];

    return html`
      <ha-card>
        <div class="card-header">
          <div>
            <ha-icon icon="mdi:lightbulb-outline"></ha-icon>
            Potential Meals
          </div>
          ${this._config.show_count ? html`<div class="count-badge">${count}</div>` : ''}
        </div>

        ${this._renderMealsList(items)}
      </ha-card>
    `;
  }

  private _renderMealsList(items: string[]) {
    if (items.length === 0) {
      return html`
        <div class="empty-state">
          <ha-icon icon="mdi:check-circle-outline"></ha-icon>
          <p>All meals are scheduled!</p>
        </div>
      `;
    }

    const maxItems = this._config.max_items || 10;
    const displayItems = items.slice(0, maxItems);
    const hasMore = items.length > maxItems;

    return html`
      <div class="meals-list">
        ${displayItems.map(
          (name) => html`
            <div class="meal-item">
              <ha-icon class="meal-icon" icon="mdi:food"></ha-icon>
              <div class="meal-name">${name}</div>
            </div>
          `
        )}
      </div>

      ${hasMore
        ? html`
            <div class="show-more">
              <a href="/meal-planner/potential-meals">
                View all ${items.length} potential meals →
              </a>
            </div>
          `
        : ''}
    `;
  }
}

// Register the card with Home Assistant
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'meal-planner-potential-meals',
  name: 'Meal Planner Potential Meals',
  description: 'Display unscheduled meals',
});

declare global {
  interface HTMLElementTagNameMap {
    'meal-planner-potential-meals': PotentialMealsCard;
  }
}
