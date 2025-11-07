// Custom panel for Meal Planner
class MealPlannerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          width: 100%;
        }
        iframe {
          border: 0;
          width: 100%;
          height: 100%;
          display: block;
          background-color: var(--primary-background-color);
        }
      </style>
      <iframe src="/meal-planner/index.html" title="Meal Planner" allowfullscreen></iframe>
    `;
  }

  setConfig(config) {
    // Panel config (if needed)
  }

  set hass(hass) {
    // Pass hass to iframe if needed
  }
}

customElements.define('meal-planner-panel', MealPlannerPanel);
