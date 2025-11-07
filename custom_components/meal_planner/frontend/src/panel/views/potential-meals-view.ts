import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, MealPlannerData, MealRow } from '../../types';
import { getPotentialMeals, sortMealsByName } from '../../utils/meal-utils';
import { updateMeal, bulkMealOperation } from '../../utils/websocket';

@customElement('potential-meals-view')
export class PotentialMealsView extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public data!: MealPlannerData;

  @property({ type: Boolean }) public narrow = false;

  @state() private _selectedIds = new Set<string>();

  @state() private _showScheduleDialog = false;

  @state() private _schedulingMeal: MealRow | null = null;

  static styles = css`
    :host {
      display: block;
    }

    .view-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .view-title {
      font-size: 20px;
      font-weight: 500;
      margin: 0;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
      padding: 12px;
      background-color: var(--card-background-color);
      border-radius: 8px;
    }

    .meals-container {
      background-color: var(--card-background-color);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: var(--ha-card-box-shadow);
    }

    .meal-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid var(--divider-color);
    }

    .meal-item:last-child {
      border-bottom: none;
    }

    .meal-item:hover {
      background-color: var(--secondary-background-color);
    }

    .meal-content {
      flex: 1;
    }

    .meal-name {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .meal-meta {
      font-size: 14px;
      color: var(--secondary-text-color);
    }

    .meal-actions {
      display: flex;
      gap: 8px;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--secondary-text-color);
    }

    .empty-state ha-icon {
      --mdc-icon-size: 64px;
      color: var(--disabled-text-color);
      margin-bottom: 16px;
    }
  `;

  private _toggleSelectAll(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      const meals = this._getPotentialMeals();
      this._selectedIds = new Set(meals.map((m) => m.id));
    } else {
      this._selectedIds = new Set();
    }
    this.requestUpdate();
  }

  private _toggleSelect(id: string): void {
    if (this._selectedIds.has(id)) {
      this._selectedIds.delete(id);
    } else {
      this._selectedIds.add(id);
    }
    this.requestUpdate();
  }

  private _getPotentialMeals(): MealRow[] {
    return sortMealsByName(getPotentialMeals(this.data));
  }

  private _openScheduleDialog(meal: MealRow): void {
    this._schedulingMeal = meal;
    this._showScheduleDialog = true;
  }

  private async _scheduleMeal(e: CustomEvent): Promise<void> {
    if (!this._schedulingMeal) return;

    const { date, meal_time } = e.detail;

    try {
      await updateMeal(this.hass, this._schedulingMeal.id, {
        date,
        meal_time,
      });

      this._showScheduleDialog = false;
      this._schedulingMeal = null;
      this._notifyDataUpdate();
    } catch (err: any) {
      console.error('Failed to schedule meal:', err);
      alert(`Failed to schedule meal: ${err.message || 'Unknown error'}`);
    }
  }

  private async _handleBulkDelete(): Promise<void> {
    if (this._selectedIds.size === 0) {
      alert('Please select at least one meal');
      return;
    }

    if (!confirm(`Delete ${this._selectedIds.size} potential meal(s)?`)) return;

    try {
      await bulkMealOperation(this.hass, 'delete', Array.from(this._selectedIds));
      this._selectedIds.clear();
      this._notifyDataUpdate();
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      alert(`Bulk delete failed: ${err.message || 'Unknown error'}`);
    }
  }

  private _notifyDataUpdate(): void {
    this.dispatchEvent(new CustomEvent('data-updated', { bubbles: true, composed: true }));
  }

  render() {
    const meals = this._getPotentialMeals();
    const hasSelection = this._selectedIds.size > 0;

    return html`
      <div class="view-header">
        <h2 class="view-title">Potential Meals (${meals.length})</h2>
      </div>

      ${hasSelection
        ? html`
            <div class="toolbar">
              <span>${this._selectedIds.size} selected</span>
              <div>
                <mwc-button @click=${this._handleBulkDelete}>Delete Selected</mwc-button>
              </div>
            </div>
          `
        : ''}

      ${this._renderMeals(meals)}
    `;
  }

  private _renderMeals(meals: MealRow[]) {
    if (meals.length === 0) {
      return html`
        <div class="empty-state">
          <ha-icon icon="mdi:lightbulb-outline"></ha-icon>
          <p>No potential meals</p>
          <p>Potential meals are meals without a scheduled date</p>
        </div>
      `;
    }

    return html`
      <div class="meals-container">
        ${meals.map((meal) => this._renderMealItem(meal))}
      </div>
    `;
  }

  private _renderMealItem(meal: MealRow) {
    return html`
      <div class="meal-item">
        <ha-checkbox
          .checked=${this._selectedIds.has(meal.id)}
          @change=${() => this._toggleSelect(meal.id)}
        ></ha-checkbox>

        <div class="meal-content">
          <div class="meal-name">${meal.name}</div>
          <div class="meal-meta">
            ${meal.notes || 'No notes'}
            ${meal.recipe_url
              ? html`
                  •
                  <a href=${meal.recipe_url} target="_blank" rel="noopener noreferrer">
                    Recipe
                  </a>
                `
              : ''}
          </div>
        </div>

        <div class="meal-actions">
          <mwc-button @click=${() => this._openScheduleDialog(meal)}>
            <ha-icon icon="mdi:calendar-plus" slot="icon"></ha-icon>
            Schedule
          </mwc-button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'potential-meals-view': PotentialMealsView;
  }
}
