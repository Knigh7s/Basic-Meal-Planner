// Meal Planner Panel App
// Vanilla JavaScript with WebSocket integration

class MealPlannerApp {
  constructor() {
    this.hass = null;
    this.data = {
      settings: { week_start: 'sunday' },
      scheduled: [],  // Array of meal objects with {id, name, meal_time, date, recipe_url, notes}
      library: []
    };
    this.currentView = 'dashboard';
    this.editingMeal = null;
    this.searchQuery = '';

    this.init();
  }

  async init() {
    console.log('[Meal Planner] Initializing app...');

    // Wait for Home Assistant connection
    await this.connectToHass();

    // Load initial data
    await this.loadData();

    // Setup event listeners
    this.setupEventListeners();

    // Render initial view
    this.switchView('dashboard');

    console.log('[Meal Planner] App initialized successfully');
  }

  async connectToHass() {
    return new Promise((resolve) => {
      // Try multiple methods to get Home Assistant connection

      // Method 1: Check parent window for hass object (for iframe panels)
      if (window.parent && window.parent !== window) {
        try {
          if (window.parent.customElements && window.parent.customElements.get('home-assistant')) {
            const homeAssistant = window.parent.document.querySelector('home-assistant');
            if (homeAssistant && homeAssistant.hass) {
              this.hass = homeAssistant.hass;
              console.log('[Meal Planner] Connected via parent home-assistant element');
              resolve();
              return;
            }
          }
        } catch (e) {
          console.log('[Meal Planner] Cannot access parent window:', e.message);
        }
      }

      // Method 2: Wait for parent connection
      let attempts = 0;
      const checkConnection = setInterval(() => {
        attempts++;

        // Try parent window
        try {
          if (window.parent && window.parent !== window) {
            const homeAssistant = window.parent.document.querySelector('home-assistant');
            if (homeAssistant && homeAssistant.hass) {
              this.hass = homeAssistant.hass;
              console.log('[Meal Planner] Connected to parent HASS');
              clearInterval(checkConnection);
              resolve();
              return;
            }
          }
        } catch (e) {
          // Cannot access parent
        }

        // Try window.hassConnection
        if (window.hassConnection) {
          this.hass = window.hassConnection;
          console.log('[Meal Planner] Connected via window.hassConnection');
          clearInterval(checkConnection);
          resolve();
          return;
        }

        // Timeout after 50 attempts (5 seconds)
        if (attempts >= 50) {
          clearInterval(checkConnection);
          console.warn('[Meal Planner] Connection timeout - using fetch API fallback');
          this.hass = { useFetchAPI: true };
          resolve();
        }
      }, 100);
    });
  }

  async callService(type, data = {}) {
    // Use WebSocket API if available
    if (this.hass && this.hass.callWS && !this.hass.useFetchAPI) {
      return await this.hass.callWS({ type, ...data });
    }

    // Fallback to fetch API
    try {
      const response = await fetch('/api/websocket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, ...data })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Meal Planner] Fetch API failed:', error);
      throw error;
    }
  }

  async loadData() {
    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - using empty data');
      return;
    }

    try {
      console.log('[Meal Planner] Loading data from backend...');

      const response = await this.callService('meal_planner/get');

      if (response) {
        this.data = response;
        console.log('[Meal Planner] Data loaded:', this.data);
      }
    } catch (error) {
      console.error('[Meal Planner] Failed to load data:', error);
    }
  }

  async saveData() {
    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - cannot save');
      return false;
    }

    try {
      console.log('[Meal Planner] Saving data to backend...');

      await this.callService('meal_planner/bulk', { data: this.data });

      console.log('[Meal Planner] Data saved successfully');
      return true;
    } catch (error) {
      console.error('[Meal Planner] Failed to save data:', error);
      return false;
    }
  }

  async addMeal(meal) {
    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - cannot add meal');
      return false;
    }

    try {
      console.log('[Meal Planner] Adding meal:', meal);

      await this.callService('meal_planner/add', meal);

      // Reload data
      await this.loadData();
      this.renderCurrentView();

      console.log('[Meal Planner] Meal added successfully');
      return true;
    } catch (error) {
      console.error('[Meal Planner] Failed to add meal:', error);
      return false;
    }
  }

  async updateMeal(mealId, newMeal) {
    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - cannot update meal');
      return false;
    }

    try {
      console.log('[Meal Planner] Updating meal:', { mealId, newMeal });

      await this.callService('meal_planner/update', {
        row_id: mealId,
        ...newMeal
      });

      // Reload data
      await this.loadData();
      this.renderCurrentView();

      console.log('[Meal Planner] Meal updated successfully');
      return true;
    } catch (error) {
      console.error('[Meal Planner] Failed to update meal:', error);
      return false;
    }
  }

  setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const view = tab.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Add meal buttons
    const addMealBtn = document.getElementById('add-meal-btn');
    if (addMealBtn) {
      addMealBtn.addEventListener('click', () => this.openMealModal());
    }

    const addPotentialBtn = document.getElementById('add-potential-btn');
    if (addPotentialBtn) {
      addPotentialBtn.addEventListener('click', () => this.openMealModal(true));
    }

    // Modal controls
    const modal = document.getElementById('meal-modal');
    const modalClose = modal.querySelector('.modal-close');
    const modalCancel = modal.querySelector('.modal-cancel');
    const modalOverlay = modal.querySelector('.modal-overlay');

    [modalClose, modalCancel, modalOverlay].forEach(el => {
      el.addEventListener('click', () => this.closeMealModal());
    });

    // Form submission
    const form = document.getElementById('meal-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // Search
    const searchInput = document.getElementById('search-meals');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderMealsLibrary();
      });
    }

    // Event delegation for dynamic content
    document.getElementById('views').addEventListener('click', (e) => {
      const target = e.target;

      // Edit meal
      if (target.classList.contains('edit-meal-btn') || target.closest('.edit-meal-btn')) {
        const btn = target.classList.contains('edit-meal-btn') ? target : target.closest('.edit-meal-btn');
        const mealData = JSON.parse(btn.getAttribute('data-meal'));
        this.openMealModal(false, mealData);
      }

      // Delete meal
      if (target.classList.contains('delete-meal-btn') || target.closest('.delete-meal-btn')) {
        const btn = target.classList.contains('delete-meal-btn') ? target : target.closest('.delete-meal-btn');
        const mealData = JSON.parse(btn.getAttribute('data-meal'));
        this.deleteMeal(mealData);
      }
    });
  }

  switchView(viewName) {
    console.log('[Meal Planner] Switching to view:', viewName);

    this.currentView = viewName;

    // Update tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      if (tab.getAttribute('data-view') === viewName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`${viewName}-view`);
    if (activeView) {
      activeView.classList.add('active');
    }

    // Render view content
    this.renderCurrentView();
  }

  renderCurrentView() {
    switch (this.currentView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'meals':
        this.renderMealsLibrary();
        break;
      case 'potential':
        this.renderPotentialMeals();
        break;
    }
  }

  renderDashboard() {
    const content = document.getElementById('dashboard-content');
    const scheduled = this.data.scheduled || [];

    // Filter only meals with dates (not potential)
    const scheduledMeals = scheduled.filter(m => m.date && m.date.trim());

    // Sort by date (newest first)
    scheduledMeals.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (scheduledMeals.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-text">No scheduled meals yet</div>
          <div class="empty-hint">Click "Add Meal" to schedule your first meal</div>
        </div>
      `;
      return;
    }

    let html = '<div class="table-container"><table>';
    html += '<thead><tr>';
    html += '<th>Date</th>';
    html += '<th>Meal Time</th>';
    html += '<th>Meal Name</th>';
    html += '<th>Recipe URL</th>';
    html += '<th>Notes</th>';
    html += '<th>Actions</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    scheduledMeals.forEach(meal => {
      const mealData = JSON.stringify({
        id: meal.id,
        name: meal.name,
        date: meal.date,
        meal_time: meal.meal_time,
        recipe_url: meal.recipe_url || '',
        notes: meal.notes || ''
      });

      html += '<tr>';
      html += `<td>${this.formatDate(meal.date)}</td>`;
      html += `<td><span class="badge badge-secondary">${this.capitalize(meal.meal_time)}</span></td>`;
      html += `<td>${this.escapeHtml(meal.name)}</td>`;
      html += `<td>${meal.recipe_url ? `<a href="${this.escapeHtml(meal.recipe_url)}" target="_blank">View Recipe</a>` : '-'}</td>`;
      html += `<td>${meal.notes ? this.escapeHtml(meal.notes) : '-'}</td>`;
      html += `<td>
        <button class="edit-meal-btn btn-secondary" data-meal='${this.escapeHtml(mealData)}'>Edit</button>
        <button class="delete-meal-btn btn-secondary" data-meal='${this.escapeHtml(mealData)}'>Delete</button>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    content.innerHTML = html;
  }

  renderMealsLibrary() {
    const content = document.getElementById('meals-content');
    const library = this.data.library || [];

    // Filter by search query
    let filteredMeals = library;
    if (this.searchQuery) {
      filteredMeals = library.filter(meal => {
        const mealName = typeof meal === 'string' ? meal : meal.name;
        return mealName.toLowerCase().includes(this.searchQuery);
      });
    }

    if (filteredMeals.length === 0) {
      const message = this.searchQuery
        ? `No meals found matching "${this.escapeHtml(this.searchQuery)}"`
        : 'No meals in library yet';

      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <div class="empty-text">${message}</div>
          <div class="empty-hint">Add meals to build your library</div>
        </div>
      `;
      return;
    }

    let html = '<div class="table-container"><table>';
    html += '<thead><tr>';
    html += '<th>Meal Name</th>';
    html += '<th>Recipe URL</th>';
    html += '<th>Notes</th>';
    html += '<th>Actions</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    filteredMeals.forEach(meal => {
      // Handle both string and object formats
      const mealName = typeof meal === 'string' ? meal : meal.name;
      const recipeUrl = typeof meal === 'object' ? meal.recipe_url || '' : '';
      const notes = typeof meal === 'object' ? meal.notes || '' : '';

      const mealData = JSON.stringify({
        name: mealName,
        date: '',
        meal_time: 'Dinner',
        recipe_url: recipeUrl,
        notes: notes
      });

      html += '<tr>';
      html += `<td>${this.escapeHtml(mealName)}</td>`;
      html += `<td>${recipeUrl ? `<a href="${this.escapeHtml(recipeUrl)}" target="_blank">View Recipe</a>` : '-'}</td>`;
      html += `<td>${notes ? this.escapeHtml(notes) : '-'}</td>`;
      html += `<td>
        <button class="edit-meal-btn btn-secondary" data-meal='${this.escapeHtml(mealData)}'>Schedule</button>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    content.innerHTML = html;
  }

  renderPotentialMeals() {
    const content = document.getElementById('potential-content');
    const scheduled = this.data.scheduled || [];

    // Filter meals without dates (potential meals)
    const potentialMeals = scheduled.filter(m => !m.date || !m.date.trim());

    if (potentialMeals.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💡</div>
          <div class="empty-text">No potential meals</div>
          <div class="empty-hint">Add meals without dates to track ideas</div>
        </div>
      `;
      return;
    }

    let html = '<div class="table-container"><table>';
    html += '<thead><tr>';
    html += '<th>Meal Name</th>';
    html += '<th>Meal Time</th>';
    html += '<th>Recipe URL</th>';
    html += '<th>Notes</th>';
    html += '<th>Actions</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    potentialMeals.forEach(meal => {
      const mealData = JSON.stringify({
        id: meal.id,
        name: meal.name,
        date: meal.date || '',
        meal_time: meal.meal_time,
        recipe_url: meal.recipe_url || '',
        notes: meal.notes || ''
      });

      html += '<tr>';
      html += `<td>${this.escapeHtml(meal.name)}</td>`;
      html += `<td><span class="badge badge-secondary">${this.capitalize(meal.meal_time)}</span></td>`;
      html += `<td>${meal.recipe_url ? `<a href="${this.escapeHtml(meal.recipe_url)}" target="_blank">View Recipe</a>` : '-'}</td>`;
      html += `<td>${meal.notes ? this.escapeHtml(meal.notes) : '-'}</td>`;
      html += `<td>
        <button class="edit-meal-btn btn-primary" data-meal='${this.escapeHtml(mealData)}'>Schedule</button>
        <button class="delete-meal-btn btn-secondary" data-meal='${this.escapeHtml(mealData)}'>Delete</button>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    content.innerHTML = html;
  }

  openMealModal(isPotential = false, mealData = null) {
    const modal = document.getElementById('meal-modal');
    const form = document.getElementById('meal-form');
    const title = document.getElementById('modal-title');

    // Reset form
    form.reset();
    this.editingMeal = mealData;

    if (mealData) {
      // Edit mode
      title.textContent = 'Edit Meal';
      document.getElementById('meal-name').value = mealData.name || '';
      document.getElementById('meal-date').value = mealData.date || '';
      document.getElementById('meal-time').value = this.capitalize(mealData.meal_time || 'Dinner');
      document.getElementById('meal-recipe').value = mealData.recipe_url || '';
      document.getElementById('meal-notes').value = mealData.notes || '';
    } else {
      // Add mode
      title.textContent = isPotential ? 'Add Potential Meal' : 'Add Meal';
      // Leave date blank - user chooses if they want to schedule it
      document.getElementById('meal-date').value = '';
    }

    modal.classList.remove('hidden');
  }

  closeMealModal() {
    const modal = document.getElementById('meal-modal');
    modal.classList.add('hidden');
    this.editingMeal = null;
  }

  async handleFormSubmit() {
    const name = document.getElementById('meal-name').value.trim();
    const date = document.getElementById('meal-date').value;
    const mealTime = document.getElementById('meal-time').value;
    const recipe = document.getElementById('meal-recipe').value.trim();
    const notes = document.getElementById('meal-notes').value.trim();

    if (!name) {
      alert('Please enter a meal name');
      return;
    }

    const mealData = {
      name,
      date: date || '',
      meal_time: mealTime,
      recipe_url: recipe || '',
      notes: notes || ''
    };

    let success = false;

    if (this.editingMeal && this.editingMeal.id) {
      // Update existing meal
      success = await this.updateMeal(this.editingMeal.id, mealData);
    } else {
      // Add new meal
      success = await this.addMeal(mealData);
    }

    if (success) {
      this.closeMealModal();
    } else {
      alert('Failed to save meal. Please try again.');
    }
  }

  async deleteMeal(meal) {
    if (!confirm(`Delete "${meal.name}"?`)) {
      return;
    }

    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - cannot delete meal');
      alert('Failed to delete meal. Please try again.');
      return;
    }

    try {
      console.log('[Meal Planner] Deleting meal:', meal);

      // Use bulk delete service
      await this.callService('meal_planner/bulk', {
        action: 'delete',
        ids: [meal.id],
        date: '',
        meal_time: ''
      });

      // Reload data
      await this.loadData();
      this.renderCurrentView();

      console.log('[Meal Planner] Meal deleted successfully');
    } catch (error) {
      console.error('[Meal Planner] Failed to delete meal:', error);
      alert('Failed to delete meal. Please try again.');
    }
  }

  // Utility functions
  formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.mealPlannerApp = new MealPlannerApp();
  });
} else {
  window.mealPlannerApp = new MealPlannerApp();
}
