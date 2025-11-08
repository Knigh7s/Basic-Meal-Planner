// meal-planner-potential-meals.js
// Custom Lovelace card for potential/unscheduled meals

class MealPlannerPotentialMeals extends HTMLElement {
  setConfig(config) {
    // Default to sensor.meal_planner_potential if not specified
    this.config = {
      entity: (config && config.entity) || 'sensor.meal_planner_potential',
      max_items: (config && config.max_items) || 10,
      show_count: (config && config.show_count !== false) !== false,
      title: (config && config.title) || 'Potential Meals'
    };

    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <div class="card-header">
            <div class="name"></div>
            <div class="count-badge"></div>
          </div>
          <div class="card-content"></div>
        </ha-card>
      `;
      this.content = this.querySelector('.card-content');
      this.header = this.querySelector('.name');
      this.badge = this.querySelector('.count-badge');
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
    const items = entity.attributes.items || [];
    const count = parseInt(entity.state) || 0;

    this.header.textContent = this.config.title;

    // Count badge
    if (this.config.show_count) {
      this.badge.textContent = count;
      this.badge.style.display = 'flex';
    } else {
      this.badge.style.display = 'none';
    }

    if (items.length === 0) {
      this.content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💡</div>
          <div class="empty-text">No potential meals yet</div>
          <div class="empty-hint">Add meals without dates to track ideas</div>
        </div>
      `;
      return;
    }

    // Limit items
    const displayItems = items.slice(0, this.config.max_items);
    const hasMore = items.length > this.config.max_items;

    let html = '<ul class="meal-list">';
    displayItems.forEach((meal, index) => {
      html += `<li class="meal-item">`;
      html += `<span class="meal-number">${index + 1}</span>`;
      html += `<span class="meal-name">${this.escapeHtml(meal)}</span>`;
      html += `</li>`;
    });
    html += '</ul>';

    if (hasMore) {
      const remaining = items.length - this.config.max_items;
      html += `<div class="more-items">+${remaining} more...</div>`;
    }

    this.content.innerHTML = html;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getCardSize() {
    return 3;
  }

  static get styles() {
    return `
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-right: 16px;
      }
      .count-badge {
        background: var(--primary-color);
        color: var(--text-primary-color);
        padding: 4px 12px;
        border-radius: 16px;
        font-weight: 600;
        font-size: 0.9em;
        min-width: 24px;
        text-align: center;
      }
      .meal-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .meal-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--divider-color);
      }
      .meal-item:last-child {
        border-bottom: none;
      }
      .meal-number {
        background: var(--secondary-background-color);
        color: var(--secondary-text-color);
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.9em;
        flex-shrink: 0;
      }
      .meal-name {
        flex: 1;
      }
      .more-items {
        text-align: center;
        padding: 12px 0;
        color: var(--secondary-text-color);
        font-style: italic;
      }
      .empty-state {
        text-align: center;
        padding: 32px 16px;
      }
      .empty-icon {
        font-size: 3em;
        margin-bottom: 12px;
      }
      .empty-text {
        font-size: 1.1em;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--primary-text-color);
      }
      .empty-hint {
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }
      .error {
        color: var(--error-color);
        padding: 16px;
      }
    `;
  }
}

customElements.define('meal-planner-potential-meals', MealPlannerPotentialMeals);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'meal-planner-potential-meals',
  name: 'Meal Planner Potential Meals',
  description: 'List of unscheduled potential meals',
  preview: false,
  documentationURL: 'https://github.com/Knigh7s/Basic-Meal-Planner'
});

console.info(
  '%c MEAL-PLANNER-POTENTIAL-MEALS %c v0.1.0 ',
  'color: white; background: green; font-weight: 700;',
  'color: green; background: white; font-weight: 700;'
);
