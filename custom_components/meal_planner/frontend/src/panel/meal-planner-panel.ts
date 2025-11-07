import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, MealPlannerData, PanelRoute } from '../types';
import { getMealPlannerData, subscribeMealPlannerUpdates } from '../utils/websocket';

import './views/dashboard-view';
import './views/meals-library-view';
import './views/potential-meals-view';

/**
 * Main Meal Planner Panel Component
 * Handles routing between different views and manages global state
 */
@customElement('meal-planner-panel')
export class MealPlannerPanel extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Boolean }) public narrow = false;

  @property({ type: String }) public route?: string;

  @state() private _currentView: PanelRoute = 'dashboard';

  @state() private _data: MealPlannerData | null = null;

  @state() private _loading = true;

  @state() private _error: string | null = null;

  private _unsubscribe?: () => void;

  static styles = css`
    :host {
      display: block;
      height: 100%;
      background-color: var(--primary-background-color);
      color: var(--primary-text-color);
    }

    .panel-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background-color: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color));
      box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.2));
    }

    .panel-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 24px;
      font-weight: 500;
      margin: 0;
    }

    .panel-title ha-icon {
      --mdc-icon-size: 32px;
    }

    .panel-nav {
      display: flex;
      gap: 8px;
      padding: 16px 24px;
      background-color: var(--card-background-color);
      border-bottom: 1px solid var(--divider-color);
      overflow-x: auto;
    }

    .nav-button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background-color: transparent;
      color: var(--primary-text-color);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.2s;
    }

    .nav-button:hover {
      background-color: var(--secondary-background-color);
    }

    .nav-button.active {
      background-color: var(--primary-color);
      color: var(--text-primary-color);
    }

    .panel-content {
      flex: 1;
      overflow: auto;
      padding: 16px 24px;
    }

    .loading-container,
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 48px 24px;
    }

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--divider-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .error-message {
      color: var(--error-color);
      font-size: 16px;
      margin-top: 16px;
      text-align: center;
    }

    .retry-button {
      margin-top: 16px;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background-color: var(--primary-color);
      color: var(--text-primary-color);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
      .panel-header {
        padding: 12px 16px;
      }

      .panel-title {
        font-size: 20px;
      }

      .panel-nav {
        padding: 12px 16px;
      }

      .panel-content {
        padding: 12px 16px;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadData();
    this._setupSubscription();
    this._parseRoute();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._unsubscribe) {
      this._unsubscribe();
    }
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);

    if (changedProps.has('route')) {
      this._parseRoute();
    }

    if (changedProps.has('hass') && this.hass && !this._data) {
      this._loadData();
    }
  }

  private _parseRoute(): void {
    // Parse route from panel URL
    // Expected format: /meal-planner/{view}
    const path = this.route || window.location.pathname;
    const parts = path.split('/').filter((p) => p);

    // Find the view part after 'meal-planner'
    const mealPlannerIndex = parts.findIndex((p) => p === 'meal-planner');
    const viewPart = parts[mealPlannerIndex + 1];

    if (viewPart === 'meals') {
      this._currentView = 'meals';
    } else if (viewPart === 'potential-meals') {
      this._currentView = 'potential-meals';
    } else {
      this._currentView = 'dashboard';
    }
  }

  private async _setupSubscription(): Promise<void> {
    if (!this.hass) return;

    try {
      this._unsubscribe = await subscribeMealPlannerUpdates(this.hass, () => {
        this._loadData();
      });
    } catch (err) {
      console.error('Failed to subscribe to updates:', err);
    }
  }

  private async _loadData(): Promise<void> {
    if (!this.hass) return;

    this._loading = true;
    this._error = null;

    try {
      this._data = await getMealPlannerData(this.hass);
    } catch (err: any) {
      console.error('Failed to load meal planner data:', err);
      this._error = err.message || 'Failed to load data';
    } finally {
      this._loading = false;
    }
  }

  private _navigate(view: PanelRoute): void {
    this._currentView = view;

    // Update browser URL without page reload
    const path = view === 'dashboard' ? '/meal-planner' : `/meal-planner/${view}`;
    window.history.pushState(null, '', path);

    // Notify HA of navigation (optional, for URL sync)
    this.dispatchEvent(
      new CustomEvent('location-changed', {
        detail: { path },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleDataUpdate(): void {
    // Child views will dispatch this event when they modify data
    this._loadData();
  }

  render() {
    return html`
      <div class="panel-container">
        <div class="panel-header">
          <h1 class="panel-title">
            <ha-icon icon="mdi:silverware-fork-knife"></ha-icon>
            Meal Planner
          </h1>
        </div>

        <div class="panel-nav">
          <button
            class="nav-button ${this._currentView === 'dashboard' ? 'active' : ''}"
            @click=${() => this._navigate('dashboard')}
          >
            Dashboard
          </button>
          <button
            class="nav-button ${this._currentView === 'meals' ? 'active' : ''}"
            @click=${() => this._navigate('meals')}
          >
            Meals Library
          </button>
          <button
            class="nav-button ${this._currentView === 'potential-meals' ? 'active' : ''}"
            @click=${() => this._navigate('potential-meals')}
          >
            Potential Meals
          </button>
        </div>

        <div class="panel-content">${this._renderContent()}</div>
      </div>
    `;
  }

  private _renderContent() {
    if (this._loading) {
      return html`
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Loading meal planner...</p>
        </div>
      `;
    }

    if (this._error) {
      return html`
        <div class="error-container">
          <ha-icon icon="mdi:alert-circle-outline" style="--mdc-icon-size: 48px;"></ha-icon>
          <p class="error-message">${this._error}</p>
          <button class="retry-button" @click=${this._loadData}>Retry</button>
        </div>
      `;
    }

    if (!this._data) {
      return html`
        <div class="error-container">
          <p class="error-message">No data available</p>
        </div>
      `;
    }

    switch (this._currentView) {
      case 'dashboard':
        return html`
          <dashboard-view
            .hass=${this.hass}
            .data=${this._data}
            .narrow=${this.narrow}
            @data-updated=${this._handleDataUpdate}
          ></dashboard-view>
        `;
      case 'meals':
        return html`
          <meals-library-view
            .hass=${this.hass}
            .data=${this._data}
            .narrow=${this.narrow}
            @data-updated=${this._handleDataUpdate}
          ></meals-library-view>
        `;
      case 'potential-meals':
        return html`
          <potential-meals-view
            .hass=${this.hass}
            .data=${this._data}
            .narrow=${this.narrow}
            @data-updated=${this._handleDataUpdate}
          ></potential-meals-view>
        `;
      default:
        return html`<div>Unknown view</div>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'meal-planner-panel': MealPlannerPanel;
  }
}
