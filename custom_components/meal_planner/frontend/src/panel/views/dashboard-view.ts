import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, MealPlannerData, MealRow, BulkAction } from '../../types';
import { getScheduledMeals, sortMealsByDateTime, validateMeal } from '../../utils/meal-utils';
import { parseISODate, formatISODate, isInPastWeek, isToday } from '../../utils/date-utils';
import { addMeal, updateMeal, bulkMealOperation } from '../../utils/websocket';

@customElement('dashboard-view')
export class DashboardView extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public data!: MealPlannerData;

  @property({ type: Boolean }) public narrow = false;

  @state() private _selectedIds = new Set<string>();

  @state() private _showAddDialog = false;

  @state() private _editingMeal: MealRow | null = null;

  @state() private _hidePast = true;

  @state() private _showBulkDialog = false;

  @state() private _bulkAction: BulkAction = { action: '', selectedIds: [] };

  static styles = css`
    :host {
      display: block;
    }

    .view-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .view-title {
      font-size: 20px;
      font-weight: 500;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
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

    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .meals-table-container {
      background-color: var(--card-background-color);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background-color: var(--table-header-background-color, var(--secondary-background-color));
    }

    th {
      padding: 12px;
      text-align: left;
      font-weight: 500;
      border-bottom: 1px solid var(--divider-color);
    }

    th.checkbox-col {
      width: 48px;
      text-align: center;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid var(--divider-color);
    }

    td.checkbox-col {
      text-align: center;
    }

    tr:hover {
      background-color: var(--secondary-background-color);
    }

    tr.today-row {
      background-color: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, white);
    }

    tr.today-row:hover {
      background-color: var(--primary-color, #03a9f4);
      opacity: 0.9;
    }

    .meal-name {
      font-weight: 500;
    }

    .meal-time-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      background-color: var(--secondary-background-color);
    }

    .recipe-link {
      color: var(--primary-color);
      text-decoration: none;
    }

    .recipe-link:hover {
      text-decoration: underline;
    }

    .action-button {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      background-color: transparent;
      color: var(--primary-text-color);
      cursor: pointer;
      font-size: 18px;
    }

    .action-button:hover {
      background-color: var(--secondary-background-color);
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

    /* Mobile responsiveness */
    @media (max-width: 768px) {
      table {
        font-size: 14px;
      }

      th,
      td {
        padding: 8px;
      }

      .meal-time-col,
      .recipe-col {
        display: none;
      }
    }
  `;

  private _toggleSelectAll(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      const meals = this._getFilteredMeals();
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

  private _getFilteredMeals(): MealRow[] {
    let meals = getScheduledMeals(this.data);

    if (this._hidePast) {
      const weekStart = this.data.settings.week_start;
      meals = meals.filter((m) => {
        const date = parseISODate(m.date);
        return date && !isInPastWeek(date, weekStart);
      });
    }

    return sortMealsByDateTime(meals);
  }

  private _openAddDialog(): void {
    this._editingMeal = null;
    this._showAddDialog = true;
  }

  private _openEditDialog(meal: MealRow): void {
    this._editingMeal = meal;
    this._showAddDialog = true;
  }

  private _closeDialog(): void {
    this._showAddDialog = false;
    this._editingMeal = null;
  }

  private async _saveMeal(e: CustomEvent): Promise<void> {
    const mealData = e.detail;

    try {
      if (this._editingMeal) {
        await updateMeal(this.hass, this._editingMeal.id, mealData);
      } else {
        await addMeal(this.hass, {
          name: mealData.name,
          meal_time: mealData.meal_time,
          date: mealData.date,
          recipe_url: mealData.recipe_url,
          notes: mealData.notes,
        });
      }

      this._closeDialog();
      this._notifyDataUpdate();
    } catch (err: any) {
      console.error('Failed to save meal:', err);
      alert(`Failed to save meal: ${err.message || 'Unknown error'}`);
    }
  }

  private async _handleBulkAction(action: string): Promise<void> {
    if (this._selectedIds.size === 0) {
      alert('Please select at least one meal');
      return;
    }

    const ids = Array.from(this._selectedIds);

    if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} meal(s)?`)) return;
    }

    if (action === 'assign_date') {
      this._bulkAction = { action: 'assign_date', selectedIds: ids };
      this._showBulkDialog = true;
      return;
    }

    try {
      await bulkMealOperation(this.hass, action as any, ids);
      this._selectedIds.clear();
      this._notifyDataUpdate();
    } catch (err: any) {
      console.error('Bulk action failed:', err);
      alert(`Bulk action failed: ${err.message || 'Unknown error'}`);
    }
  }

  private _notifyDataUpdate(): void {
    this.dispatchEvent(new CustomEvent('data-updated', { bubbles: true, composed: true }));
  }

  render() {
    const meals = this._getFilteredMeals();
    const hasSelection = this._selectedIds.size > 0;

    return html`
      <div class="view-header">
        <h2 class="view-title">Scheduled Meals</h2>
        <div class="header-actions">
          <mwc-button raised @click=${this._openAddDialog}>
            <ha-icon icon="mdi:plus" slot="icon"></ha-icon>
            Add Meal
          </mwc-button>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-group">
          <ha-formfield label="Hide past week">
            <ha-checkbox
              .checked=${this._hidePast}
              @change=${(e: Event) => {
                this._hidePast = (e.target as HTMLInputElement).checked;
              }}
            ></ha-checkbox>
          </ha-formfield>
        </div>

        ${hasSelection
          ? html`
              <div class="toolbar-group">
                <span>${this._selectedIds.size} selected</span>
                <mwc-button @click=${() => this._handleBulkAction('convert_to_potential')}>
                  Convert to Potential
                </mwc-button>
                <mwc-button @click=${() => this._handleBulkAction('assign_date')}>
                  Change Date
                </mwc-button>
                <mwc-button @click=${() => this._handleBulkAction('delete')}>Delete</mwc-button>
              </div>
            `
          : ''}
      </div>

      ${this._renderTable(meals)}
      ${this._showAddDialog ? this._renderMealDialog() : ''}
    `;
  }

  private _renderTable(meals: MealRow[]) {
    if (meals.length === 0) {
      return html`
        <div class="empty-state">
          <ha-icon icon="mdi:calendar-blank"></ha-icon>
          <p>No scheduled meals found</p>
          <mwc-button raised @click=${this._openAddDialog}>Add Your First Meal</mwc-button>
        </div>
      `;
    }

    return html`
      <div class="meals-table-container">
        <table>
          <thead>
            <tr>
              <th class="checkbox-col">
                <ha-checkbox @change=${this._toggleSelectAll}></ha-checkbox>
              </th>
              <th>Name</th>
              <th class="meal-time-col">Meal Time</th>
              <th>Date</th>
              <th class="recipe-col">Recipe</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${meals.map((meal) => this._renderMealRow(meal))}
          </tbody>
        </table>
      </div>
    `;
  }

  private _renderMealRow(meal: MealRow) {
    const date = parseISODate(meal.date);
    const isTodayRow = date && isToday(date);

    return html`
      <tr class=${isTodayRow ? 'today-row' : ''}>
        <td class="checkbox-col">
          <ha-checkbox
            .checked=${this._selectedIds.has(meal.id)}
            @change=${() => this._toggleSelect(meal.id)}
          ></ha-checkbox>
        </td>
        <td class="meal-name">${meal.name}</td>
        <td class="meal-time-col">
          <span class="meal-time-badge">${meal.meal_time}</span>
        </td>
        <td>${date ? formatISODate(date) : '—'}</td>
        <td class="recipe-col">
          ${meal.recipe_url
            ? html`
                <a
                  href=${meal.recipe_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="recipe-link"
                >
                  <ha-icon icon="mdi:link" style="--mdc-icon-size: 16px;"></ha-icon>
                  Recipe
                </a>
              `
            : '—'}
        </td>
        <td>${meal.notes || '—'}</td>
        <td>
          <button class="action-button" @click=${() => this._openEditDialog(meal)} title="Edit">
            ✎
          </button>
        </td>
      </tr>
    `;
  }

  private _renderMealDialog() {
    // This would be a separate dialog component in a real implementation
    // For now, returning a placeholder
    return html`<div>Meal dialog placeholder - implement meal-dialog component</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-view': DashboardView;
  }
}
