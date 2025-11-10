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
    console.log('[Meal Planner] callService called with:', { type, data });

    // Use WebSocket API if available
    if (this.hass && this.hass.callWS && !this.hass.useFetchAPI) {
      console.log('[Meal Planner] Using WebSocket API');
      try {
        // Add timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('WebSocket timeout after 10s')), 10000)
        );

        const wsPayload = { type, ...data };
        console.log('[Meal Planner] Sending WebSocket payload:', wsPayload);
        console.log('[Meal Planner] Payload keys:', Object.keys(wsPayload));
        const wsPromise = this.hass.callWS(wsPayload);

        const result = await Promise.race([wsPromise, timeoutPromise]);
        console.log('[Meal Planner] WebSocket result:', result);
        return result;
      } catch (error) {
        console.error('[Meal Planner] WebSocket call failed:', error);
        console.error('[Meal Planner] Error type:', error.constructor.name);
        console.error('[Meal Planner] Error message:', error.message);
        if (error.code) console.error('[Meal Planner] Error code:', error.code);
        throw error;
      }
    }

    // Fallback to fetch API
    console.log('[Meal Planner] Using Fetch API');
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

  async saveSettings() {
    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - cannot save settings');
      return false;
    }

    try {
      console.log('[Meal Planner] Saving settings:', this.data.settings);

      await this.callService('meal_planner/update_settings', this.data.settings);

      console.log('[Meal Planner] Settings saved successfully');
      return true;
    } catch (error) {
      console.error('[Meal Planner] Failed to save settings:', error);
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

      const result = await this.callService('meal_planner/add', meal);

      console.log('[Meal Planner] Add result:', result);

      // Reload data
      await this.loadData();
      this.renderCurrentView();

      console.log('[Meal Planner] Meal added successfully');
      return true;
    } catch (error) {
      console.error('[Meal Planner] Failed to add meal:', error);
      console.error('[Meal Planner] Error details:', error.message, error.stack);
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

      const result = await this.callService('meal_planner/update', {
        row_id: mealId,
        ...newMeal
      });

      console.log('[Meal Planner] Update result:', result);

      // Reload data
      await this.loadData();
      this.renderCurrentView();

      console.log('[Meal Planner] Meal updated successfully');
      return true;
    } catch (error) {
      console.error('[Meal Planner] Failed to update meal:', error);
      console.error('[Meal Planner] Error details:', error.message, error.stack);
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

    // Add meal button (Dashboard)
    const addMealBtn = document.getElementById('add-meal-btn');
    if (addMealBtn) {
      addMealBtn.addEventListener('click', () => this.openMealModal());
    }

    // Add meal button (Library)
    const addMealLibraryBtn = document.getElementById('add-meal-library-btn');
    if (addMealLibraryBtn) {
      addMealLibraryBtn.addEventListener('click', () => this.openMealModal());
    }

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettingsModal());
    }

    // Meal Modal controls
    const modal = document.getElementById('meal-modal');
    const modalClose = modal.querySelector('.modal-close');
    const modalCancel = modal.querySelector('.modal-cancel');
    const modalOverlay = modal.querySelector('.modal-overlay');

    [modalClose, modalCancel, modalOverlay].forEach(el => {
      el.addEventListener('click', () => this.closeMealModal());
    });

    // Meal Form submission
    const form = document.getElementById('meal-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // Settings Modal controls
    const settingsModal = document.getElementById('settings-modal');
    const settingsModalClose = settingsModal.querySelector('.modal-close');
    const settingsModalCancel = settingsModal.querySelector('.modal-cancel');
    const settingsModalOverlay = settingsModal.querySelector('.modal-overlay');

    [settingsModalClose, settingsModalCancel, settingsModalOverlay].forEach(el => {
      el.addEventListener('click', () => this.closeSettingsModal());
    });

    // Settings Form submission
    const settingsForm = document.getElementById('settings-form');
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSettingsSubmit();
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

      // Delete library meal (all instances with this name)
      if (target.classList.contains('delete-library-meal-btn') || target.closest('.delete-library-meal-btn')) {
        const btn = target.classList.contains('delete-library-meal-btn') ? target : target.closest('.delete-library-meal-btn');
        const mealName = btn.getAttribute('data-name');
        this.deleteLibraryMeal(mealName);
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
        notes: meal.notes || '',
        potential: meal.potential || false
      });

      html += '<tr>';
      html += `<td>${this.formatDate(meal.date)}</td>`;
      html += `<td><span class="badge badge-secondary">${this.capitalize(meal.meal_time)}</span></td>`;
      html += `<td>${this.escapeHtml(meal.name)}</td>`;
      html += `<td>${meal.recipe_url ? `<a href="${this.escapeHtml(meal.recipe_url)}" target="_blank">View Recipe</a>` : '-'}</td>`;
      html += `<td>${meal.notes ? this.escapeHtml(meal.notes) : '-'}</td>`;
      html += `<td>
        <button class="edit-meal-btn btn-primary" data-meal='${this.escapeHtml(mealData)}'>Edit</button>
        <button class="delete-meal-btn btn-danger" data-meal='${this.escapeHtml(mealData)}'>🗑️ Delete</button>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    content.innerHTML = html;
  }

  renderMealsLibrary() {
    const content = document.getElementById('meals-content');
    const scheduled = this.data.scheduled || [];

    // Group meals by name to create library (unique meal names)
    const libraryMap = new Map();
    scheduled.forEach(meal => {
      const key = meal.name.toLowerCase();
      if (!libraryMap.has(key)) {
        libraryMap.set(key, meal); // Use first instance of each meal name
      }
    });

    // Convert to array and sort alphabetically
    let uniqueMeals = Array.from(libraryMap.values()).sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    // Filter by search query
    if (this.searchQuery) {
      uniqueMeals = uniqueMeals.filter(meal =>
        meal.name.toLowerCase().includes(this.searchQuery)
      );
    }

    if (uniqueMeals.length === 0) {
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

    uniqueMeals.forEach(meal => {
      const mealData = JSON.stringify({
        id: meal.id,
        name: meal.name,
        date: meal.date || '',
        meal_time: meal.meal_time || 'Dinner',
        recipe_url: meal.recipe_url || '',
        notes: meal.notes || '',
        potential: meal.potential || false
      });

      html += '<tr>';
      html += `<td>${this.escapeHtml(meal.name)}</td>`;
      html += `<td>${meal.recipe_url ? `<a href="${this.escapeHtml(meal.recipe_url)}" target="_blank">View Recipe</a>` : '-'}</td>`;
      html += `<td>${meal.notes ? this.escapeHtml(meal.notes) : '-'}</td>`;
      html += `<td>
        <button class="edit-meal-btn btn-primary" data-meal='${this.escapeHtml(mealData)}'>Edit</button>
        <button class="delete-library-meal-btn btn-danger" data-name='${this.escapeHtml(meal.name)}'>🗑️ Delete</button>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    content.innerHTML = html;
  }

  renderPotentialMeals() {
    const content = document.getElementById('potential-content');
    const scheduled = this.data.scheduled || [];

    // Filter meals marked as potential
    const potentialMeals = scheduled.filter(m => m.potential === true);

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
        notes: meal.notes || '',
        potential: meal.potential || false
      });

      html += '<tr>';
      html += `<td>${this.escapeHtml(meal.name)}</td>`;
      html += `<td>${meal.recipe_url ? `<a href="${this.escapeHtml(meal.recipe_url)}" target="_blank">View Recipe</a>` : '-'}</td>`;
      html += `<td>${meal.notes ? this.escapeHtml(meal.notes) : '-'}</td>`;
      html += `<td>
        <button class="edit-meal-btn btn-primary" data-meal='${this.escapeHtml(mealData)}'>Schedule</button>
        <button class="delete-meal-btn btn-danger" data-meal='${this.escapeHtml(mealData)}'>🗑️ Delete</button>
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
      document.getElementById('meal-potential').checked = mealData.potential || false;
    } else {
      // Add mode
      title.textContent = 'Add Meal';
      // Leave date blank - user chooses if they want to schedule it
      document.getElementById('meal-date').value = '';
      document.getElementById('meal-potential').checked = false;
    }

    modal.classList.remove('hidden');
  }

  closeMealModal() {
    const modal = document.getElementById('meal-modal');
    modal.classList.add('hidden');
    this.editingMeal = null;
  }

  async handleFormSubmit() {
    // Prevent double submission
    if (this.isSaving) {
      console.log('[Meal Planner] Already saving, ignoring duplicate submission');
      return;
    }
    this.isSaving = true;

    const submitBtn = document.querySelector('#meal-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      const name = document.getElementById('meal-name').value.trim();
      const date = document.getElementById('meal-date').value;
      const mealTime = document.getElementById('meal-time').value;
      const recipe = document.getElementById('meal-recipe').value.trim();
      const notes = document.getElementById('meal-notes').value.trim();
      const potential = document.getElementById('meal-potential').checked;

      if (!name) {
        alert('Please enter a meal name');
        return;
      }

      const mealData = {
        name,
        date: date || '',
        meal_time: mealTime,
        recipe_url: recipe || '',
        notes: notes || '',
        potential: potential
      };

      let success = false;

      if (this.editingMeal && this.editingMeal.id) {
        // Update existing meal
        console.log('[Meal Planner] Calling updateMeal with ID:', this.editingMeal.id);
        success = await this.updateMeal(this.editingMeal.id, mealData);
        console.log('[Meal Planner] updateMeal returned:', success);
      } else {
        // Add new meal
        console.log('[Meal Planner] Calling addMeal');
        success = await this.addMeal(mealData);
        console.log('[Meal Planner] addMeal returned:', success);
      }

      if (success) {
        console.log('[Meal Planner] Closing modal after successful save');
        this.closeMealModal();
      } else {
        console.log('[Meal Planner] Not closing modal - save failed');
        alert('Failed to save meal. Please try again.');
      }
    } finally {
      this.isSaving = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save';
      }
    }
  }

  openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const input = document.getElementById('settings-days-after');

    // Populate current value
    input.value = this.data.settings?.days_after_today || 3;

    modal.classList.remove('hidden');
  }

  closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('hidden');
  }

  async handleSettingsSubmit() {
    const daysAfter = parseInt(document.getElementById('settings-days-after').value);

    if (daysAfter < 0 || daysAfter > 6) {
      alert('Days after today must be between 0 and 6');
      return;
    }

    // Update settings
    this.data.settings.days_after_today = daysAfter;

    const success = await this.saveSettings();

    if (success) {
      this.closeSettingsModal();
      // Reload to show updated view
      await this.loadData();
      this.renderCurrentView();
    } else {
      alert('Failed to save settings. Please try again.');
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

  async deleteLibraryMeal(mealName) {
    // Find all scheduled meals with this name
    const scheduled = this.data.scheduled || [];
    const mealsToDelete = scheduled.filter(m => m.name === mealName);

    if (mealsToDelete.length === 0) {
      alert(`No scheduled meals found for "${mealName}"`);
      return;
    }

    const count = mealsToDelete.length;
    const message = count === 1
      ? `Delete "${mealName}"? This will remove 1 scheduled meal.`
      : `Delete "${mealName}"? This will remove all ${count} scheduled meals with this name.`;

    if (!confirm(message)) {
      return;
    }

    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - cannot delete meals');
      alert('Failed to delete meals. Please try again.');
      return;
    }

    try {
      console.log('[Meal Planner] Deleting library meal:', mealName, 'Count:', count);

      // Get all IDs
      const ids = mealsToDelete.map(m => m.id);

      // Use bulk delete service
      await this.callService('meal_planner/bulk', {
        action: 'delete',
        ids: ids,
        date: '',
        meal_time: ''
      });

      // Reload data
      await this.loadData();
      this.renderCurrentView();

      console.log('[Meal Planner] Library meal deleted successfully');
    } catch (error) {
      console.error('[Meal Planner] Failed to delete library meal:', error);
      alert('Failed to delete meals. Please try again.');
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
