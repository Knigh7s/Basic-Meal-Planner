// Meal Planner Panel App
// Vanilla JavaScript with WebSocket integration

class MealPlannerApp {
  constructor() {
    this.hass = null;
    this.data = {
      settings: { week_start: 'sunday' },
      scheduled: {},
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
      // Try to get existing connection
      if (window.hassConnection) {
        this.hass = window.hassConnection;
        console.log('[Meal Planner] Using existing HASS connection');
        resolve();
        return;
      }

      // Wait for connection
      const checkConnection = setInterval(() => {
        if (window.hassConnection) {
          this.hass = window.hassConnection;
          console.log('[Meal Planner] HASS connection established');
          clearInterval(checkConnection);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkConnection);
        console.warn('[Meal Planner] HASS connection timeout - using demo mode');
        this.hass = null;
        resolve();
      }, 10000);
    });
  }

  async loadData() {
    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - using empty data');
      return;
    }

    try {
      console.log('[Meal Planner] Loading data from backend...');

      const response = await this.hass.callWS({
        type: 'meal_planner/get'
      });

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

      await this.hass.callWS({
        type: 'meal_planner/bulk',
        data: this.data
      });

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

      await this.hass.callWS({
        type: 'meal_planner/add',
        ...meal
      });

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

  async updateMeal(oldMeal, newMeal) {
    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - cannot update meal');
      return false;
    }

    try {
      console.log('[Meal Planner] Updating meal:', { oldMeal, newMeal });

      await this.hass.callWS({
        type: 'meal_planner/update',
        old_name: oldMeal.name,
        old_date: oldMeal.date || '',
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
    const scheduled = this.data.scheduled || {};
    const scheduledMeals = [];

    // Collect all scheduled meals
    for (const [date, meals] of Object.entries(scheduled)) {
      for (const [mealTime, name] of Object.entries(meals)) {
        if (name && name.trim()) {
          scheduledMeals.push({
            date,
            mealTime,
            name
          });
        }
      }
    }

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
    html += '<th>Actions</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    scheduledMeals.forEach(meal => {
      const mealData = JSON.stringify({ name: meal.name, date: meal.date });
      html += '<tr>';
      html += `<td>${this.formatDate(meal.date)}</td>`;
      html += `<td><span class="badge badge-secondary">${this.capitalize(meal.mealTime)}</span></td>`;
      html += `<td>${this.escapeHtml(meal.name)}</td>`;
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
      filteredMeals = library.filter(meal =>
        meal.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filteredMeals.length === 0) {
      const message = this.searchQuery
        ? `No meals found matching "${this.escapeHtml(this.searchQuery)}"`
        : 'No meals in library yet';

      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <div class="empty-text">${message}</div>
          <div class="empty-hint">Add meals with or without dates to build your library</div>
        </div>
      `;
      return;
    }

    let html = '<div class="cards-grid">';

    filteredMeals.forEach(meal => {
      const mealData = JSON.stringify({ name: meal, date: '' });
      html += `
        <div class="meal-card">
          <div class="meal-card-header">
            <div class="meal-card-title">${this.escapeHtml(meal)}</div>
          </div>
          <div class="meal-card-actions">
            <button class="edit-meal-btn btn-primary" data-meal='${this.escapeHtml(mealData)}'>Schedule</button>
          </div>
        </div>
      `;
    });

    html += '</div>';
    content.innerHTML = html;
  }

  renderPotentialMeals() {
    const content = document.getElementById('potential-content');
    const scheduled = this.data.scheduled || {};
    const library = this.data.library || [];

    // Find potential meals (in library but not scheduled)
    const scheduledNames = new Set();
    for (const meals of Object.values(scheduled)) {
      for (const name of Object.values(meals)) {
        if (name && name.trim()) {
          scheduledNames.add(name.trim().toLowerCase());
        }
      }
    }

    const potentialMeals = library.filter(meal =>
      !scheduledNames.has(meal.toLowerCase())
    );

    if (potentialMeals.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💡</div>
          <div class="empty-text">No potential meals</div>
          <div class="empty-hint">All your library meals are scheduled, or add new meal ideas</div>
        </div>
      `;
      return;
    }

    let html = '<div class="cards-grid">';

    potentialMeals.forEach((meal, index) => {
      const mealData = JSON.stringify({ name: meal, date: '' });
      html += `
        <div class="meal-card">
          <div class="meal-card-header">
            <span class="badge badge-primary">${index + 1}</span>
            <div class="meal-card-title">${this.escapeHtml(meal)}</div>
          </div>
          <div class="meal-card-actions">
            <button class="edit-meal-btn btn-primary" data-meal='${this.escapeHtml(mealData)}'>Schedule</button>
          </div>
        </div>
      `;
    });

    html += '</div>';
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
      document.getElementById('meal-time').value = mealData.mealTime || 'Dinner';
      document.getElementById('meal-recipe').value = mealData.recipe || '';
      document.getElementById('meal-notes').value = mealData.notes || '';
    } else {
      // Add mode
      title.textContent = isPotential ? 'Add Potential Meal' : 'Add Meal';
      if (isPotential) {
        document.getElementById('meal-date').value = '';
      } else {
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('meal-date').value = today;
      }
    }

    // Populate meal suggestions from library
    const datalist = document.getElementById('meal-suggestions');
    datalist.innerHTML = '';
    (this.data.library || []).forEach(meal => {
      const option = document.createElement('option');
      option.value = meal;
      datalist.appendChild(option);
    });

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

    const newMeal = {
      name,
      date: date || '',
      meal_time: mealTime.toLowerCase(),
      recipe: recipe || '',
      notes: notes || ''
    };

    let success = false;

    if (this.editingMeal) {
      // Update existing meal
      success = await this.updateMeal(this.editingMeal, newMeal);
    } else {
      // Add new meal
      success = await this.addMeal(newMeal);
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

    // Remove from scheduled
    if (meal.date && this.data.scheduled[meal.date]) {
      for (const [mealTime, name] of Object.entries(this.data.scheduled[meal.date])) {
        if (name === meal.name) {
          delete this.data.scheduled[meal.date][mealTime];
        }
      }

      // Clean up empty date entries
      if (Object.keys(this.data.scheduled[meal.date]).length === 0) {
        delete this.data.scheduled[meal.date];
      }
    }

    // Save and re-render
    const success = await this.saveData();
    if (success) {
      await this.loadData();
      this.renderCurrentView();
    } else {
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
