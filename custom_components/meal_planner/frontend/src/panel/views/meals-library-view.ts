import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, MealPlannerData, MealLibraryItem } from '../../types';
import { buildLibraryWithUsage } from '../../utils/meal-utils';
import { addMeal } from '../../utils/websocket';
import { formatISODate } from '../../utils/date-utils';

@customElement('meals-library-view')
export class MealsLibraryView extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public data!: MealPlannerData;

  @property({ type: Boolean }) public narrow = false;

  @state() private _searchQuery = '';

  @state() private _showScheduleDialog = false;

  @state() private _selectedLibraryItem: MealLibraryItem | null = null;

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

    .search-bar {
      margin-bottom: 16px;
    }

    .search-input {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      background-color: var(--card-background-color);
      color: var(--primary-text-color);
      font-size: 14px;
    }

    .library-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .meal-card {
      background-color: var(--card-background-color);
      border-radius: 8px;
      padding: 16px;
      box-shadow: var(--ha-card-box-shadow);
    }

    .meal-card-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 12px;
    }

    .meal-card-title {
      font-size: 16px;
      font-weight: 500;
      margin: 0;
    }

    .usage-badge {
      background-color: var(--primary-color);
      color: var(--text-primary-color);
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .meal-card-content {
      color: var(--secondary-text-color);
      font-size: 14px;
      line-height: 1.5;
    }

    .meal-card-actions {
      margin-top: 12px;
      display: flex;
      gap: 8px;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--secondary-text-color);
    }

    @media (max-width: 768px) {
      .library-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  private _getFilteredLibrary(): MealLibraryItem[] {
    const library = buildLibraryWithUsage(this.data);

    if (!this._searchQuery) return library;

    const query = this._searchQuery.toLowerCase();
    return library.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.notes || '').toLowerCase().includes(query)
    );
  }

  private _openScheduleDialog(item: MealLibraryItem): void {
    this._selectedLibraryItem = item;
    this._showScheduleDialog = true;
  }

  private async _scheduleFromLibrary(e: CustomEvent): Promise<void> {
    if (!this._selectedLibraryItem) return;

    const { date, meal_time } = e.detail;

    try {
      await addMeal(this.hass, {
        name: this._selectedLibraryItem.name,
        meal_time,
        date,
        recipe_url: this._selectedLibraryItem.recipe_url,
        notes: this._selectedLibraryItem.notes,
      });

      this._showScheduleDialog = false;
      this._selectedLibraryItem = null;
      this._notifyDataUpdate();
    } catch (err: any) {
      console.error('Failed to schedule meal:', err);
      alert(`Failed to schedule meal: ${err.message || 'Unknown error'}`);
    }
  }

  private _notifyDataUpdate(): void {
    this.dispatchEvent(new CustomEvent('data-updated', { bubbles: true, composed: true }));
  }

  render() {
    const library = this._getFilteredLibrary();

    return html`
      <div class="view-header">
        <h2 class="view-title">Meals Library (${library.length})</h2>
      </div>

      <div class="search-bar">
        <input
          type="text"
          class="search-input"
          placeholder="Search meals..."
          .value=${this._searchQuery}
          @input=${(e: Event) => {
            this._searchQuery = (e.target as HTMLInputElement).value;
          }}
        />
      </div>

      ${this._renderLibrary(library)}
    `;
  }

  private _renderLibrary(library: MealLibraryItem[]) {
    if (library.length === 0) {
      return html`
        <div class="empty-state">
          <ha-icon icon="mdi:book-open-blank-variant"></ha-icon>
          <p>No meals in your library yet</p>
          <p>Meals are automatically added to your library when you create them</p>
        </div>
      `;
    }

    return html`
      <div class="library-grid">
        ${library.map((item) => this._renderMealCard(item))}
      </div>
    `;
  }

  private _renderMealCard(item: MealLibraryItem) {
    return html`
      <div class="meal-card">
        <div class="meal-card-header">
          <h3 class="meal-card-title">${item.name}</h3>
          ${item.times_used
            ? html`<span class="usage-badge">${item.times_used}x</span>`
            : ''}
        </div>

        <div class="meal-card-content">
          ${item.notes ? html`<p>${item.notes}</p>` : ''}
          ${item.recipe_url
            ? html`
                <a href=${item.recipe_url} target="_blank" rel="noopener noreferrer">
                  <ha-icon icon="mdi:link"></ha-icon>
                  Recipe
                </a>
              `
            : ''}
        </div>

        <div class="meal-card-actions">
          <mwc-button @click=${() => this._openScheduleDialog(item)}>
            Add to Schedule
          </mwc-button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'meals-library-view': MealsLibraryView;
  }
}
