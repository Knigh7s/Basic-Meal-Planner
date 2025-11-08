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
        <style>${this.constructor.styles}</style>
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
        background: linear-gradient(135deg,
          var(--primary-color, #e91e63) 0%,
          var(--accent-color, #9c27b0) 100%);
        color: #fff;
        padding: 6px 14px;
        border-radius: 20px;
        font-weight: 700;
        font-size: 0.9em;
        min-width: 28px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(233, 30, 99, 0.3);
      }

      .meal-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .meal-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 12px;
        background: linear-gradient(90deg,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.08) 0%,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.02) 100%);
        border-radius: 10px;
        border-left: 3px solid rgba(var(--rgb-primary-color, 3, 169, 244), 0.3);
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .meal-item:hover {
        background: linear-gradient(90deg,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.15) 0%,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.05) 100%);
        border-left-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.5);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
        transform: translateX(3px);
      }

      .meal-number {
        background: linear-gradient(135deg,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.25) 0%,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.15) 100%);
        color: var(--primary-text-color, #fff);
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.95em;
        flex-shrink: 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      }

      .meal-name {
        flex: 1;
        font-weight: 500;
        color: var(--primary-text-color, #fff);
        line-height: 1.4;
      }

      .more-items {
        text-align: center;
        padding: 16px 0 8px;
        color: var(--secondary-text-color, #888);
        font-style: italic;
        font-size: 0.9em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .more-items::before {
        content: '⬇️';
        font-size: 1.1em;
      }

      .empty-state {
        text-align: center;
        padding: 48px 24px;
        background: linear-gradient(135deg,
          rgba(var(--rgb-primary-color, 3, 169, 244), 0.05) 0%,
          rgba(var(--rgb-accent-color, 156, 39, 176), 0.05) 100%);
        border-radius: 12px;
        margin: 8px;
      }

      .empty-icon {
        font-size: 4em;
        margin-bottom: 16px;
        filter: grayscale(0.3);
        opacity: 0.8;
      }

      .empty-text {
        font-size: 1.2em;
        font-weight: 600;
        margin-bottom: 10px;
        color: var(--primary-text-color, #fff);
      }

      .empty-hint {
        color: var(--secondary-text-color, #aaa);
        font-size: 0.95em;
        line-height: 1.5;
        max-width: 300px;
        margin: 0 auto;
      }

      .error {
        color: var(--error-color);
        padding: 16px;
        text-align: center;
        background: rgba(var(--rgb-error-color, 244, 67, 54), 0.1);
        border-radius: 8px;
        margin: 8px;
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
