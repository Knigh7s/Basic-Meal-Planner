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

    // Use Home Assistant service API directly (more reliable than WebSocket)
    if (this.hass && this.hass.callService) {
      console.log('[Meal Planner] Using Service API');

      // Map WebSocket command types to service names
      const serviceMap = {
        'meal_planner/get': null, // GET still uses WebSocket
        'meal_planner/add': 'add',
        'meal_planner/update': 'update',
        'meal_planner/bulk': 'bulk',
        'meal_planner/update_settings': 'update_settings',
        'meal_planner/update_library': 'update_library',
        'meal_planner/delete_library': 'delete_library'
      };

      const serviceName = serviceMap[type];

      if (serviceName) {
        console.log('[Meal Planner] Calling service: meal_planner.' + serviceName);
        try {
          await this.hass.callService('meal_planner', serviceName, data);
          console.log('[Meal Planner] Service call succeeded');
          return { success: true };
        } catch (error) {
          console.error('[Meal Planner] Service call failed:', error);
          throw error;
        }
      }
    }

    // Fallback to WebSocket for GET command
    if (this.hass && this.hass.callWS && type === 'meal_planner/get') {
      console.log('[Meal Planner] Using WebSocket API for GET');
      try {
        const result = await this.hass.callWS({ type });
        console.log('[Meal Planner] WebSocket result:', result);
        return result;
      } catch (error) {
        console.error('[Meal Planner] WebSocket call failed:', error);
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

  // Modal helpers
  showAlert(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('alert-modal');
      const messageEl = document.getElementById('alert-message');
      const okBtn = modal.querySelector('.alert-ok');
      const closeBtn = modal.querySelector('.modal-close');
      const overlay = modal.querySelector('.modal-overlay');

      messageEl.textContent = message;
      modal.classList.remove('hidden');

      const closeModal = () => {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', closeModal);
        closeBtn.removeEventListener('click', closeModal);
        overlay.removeEventListener('click', closeModal);
        resolve();
      };

      okBtn.addEventListener('click', closeModal);
      closeBtn.addEventListener('click', closeModal);
      overlay.addEventListener('click', closeModal);
    });
  }

  showConfirm(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const messageEl = document.getElementById('confirm-message');
      const okBtn = modal.querySelector('.confirm-ok');
      const cancelBtn = modal.querySelector('.confirm-cancel');
      const closeBtn = modal.querySelector('.modal-close');
      const overlay = modal.querySelector('.modal-overlay');

      messageEl.textContent = message;
      modal.classList.remove('hidden');

      const closeModal = (result) => {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', okHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        closeBtn.removeEventListener('click', cancelHandler);
        overlay.removeEventListener('click', cancelHandler);
        resolve(result);
      };

      const okHandler = () => closeModal(true);
      const cancelHandler = () => closeModal(false);

      okBtn.addEventListener('click', okHandler);
      cancelBtn.addEventListener('click', cancelHandler);
      closeBtn.addEventListener('click', cancelHandler);
      overlay.addEventListener('click', cancelHandler);
    });
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

  async updateLibraryEntry(libraryId, fields) {
    try {
      await this.callService('meal_planner/update_library', { library_id: libraryId, ...fields });
      await this.loadData();
      this.renderCurrentView();
      return true;
    } catch (error) {
      console.error('[Meal Planner] Failed to update library entry:', error);
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
      addMealLibraryBtn.addEventListener('click', () => this.openMealModal(true));
    }

    // Library filter
    const libraryFilter = document.getElementById('library-filter');
    if (libraryFilter) {
      libraryFilter.addEventListener('change', () => this.renderMealsLibrary());
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

      // Edit scheduled meal (dashboard / potential views)
      if (target.classList.contains('edit-meal-btn') || target.closest('.edit-meal-btn')) {
        const btn = target.classList.contains('edit-meal-btn') ? target : target.closest('.edit-meal-btn');
        const mealData = JSON.parse(btn.getAttribute('data-meal'));
        this.openMealModal(false, mealData);
      }

      // Edit library entry (library view)
      if (target.classList.contains('edit-library-btn') || target.closest('.edit-library-btn')) {
        const btn = target.classList.contains('edit-library-btn') ? target : target.closest('.edit-library-btn');
        const libData = JSON.parse(btn.getAttribute('data-lib'));
        this.openLibraryEditModal(libData);
      }

      // Delete scheduled meal (dashboard / potential views)
      if (target.classList.contains('delete-meal-btn') || target.closest('.delete-meal-btn')) {
        const btn = target.classList.contains('delete-meal-btn') ? target : target.closest('.delete-meal-btn');
        const mealData = JSON.parse(btn.getAttribute('data-meal'));
        this.deleteMeal(mealData);
      }

      // Delete library entry (all scheduled instances + library record)
      if (target.classList.contains('delete-library-meal-btn') || target.closest('.delete-library-meal-btn')) {
        const btn = target.classList.contains('delete-library-meal-btn') ? target : target.closest('.delete-library-meal-btn');
        const libData = JSON.parse(btn.getAttribute('data-lib'));
        this.deleteLibraryMeal(libData);
      }

      // Toggle potential flag on library entry
      if (target.classList.contains('toggle-potential-btn') || target.closest('.toggle-potential-btn')) {
        const btn = target.classList.contains('toggle-potential-btn') ? target : target.closest('.toggle-potential-btn');
        const libData = JSON.parse(btn.getAttribute('data-lib'));
        this.togglePotential(libData.library_id, !libData.potential);
      }

      // Open recipe link (companion app compatible — window.top breaks out of iframe)
      if (target.classList.contains('recipe-link') || target.closest('.recipe-link')) {
        e.preventDefault();
        const link = target.classList.contains('recipe-link') ? target : target.closest('.recipe-link');
        const url = link.dataset.url;
        if (url) window.top.open(url, '_blank', 'noopener noreferrer');
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
    }
  }

  renderDashboard() {
    const content = document.getElementById('dashboard-content');
    const scheduled = this.data.scheduled || [];

    // Filter to meals with dates (not potential) within the keep window
    const daysToKeep = this.data.settings?.days_to_keep ?? 14;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    cutoff.setHours(0, 0, 0, 0);

    const scheduledMeals = scheduled.filter(m => {
      if (!m.date || !m.date.trim()) return false;
      return new Date(m.date + 'T00:00:00') >= cutoff;
    });

    // Sort ascending: past meals at top, upcoming meals below
    scheduledMeals.sort((a, b) => new Date(a.date) - new Date(b.date));

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
      html += `<td>${meal.recipe_url ? `<a href="#" class="recipe-link" data-url="${this.escapeHtml(meal.recipe_url)}">View Recipe</a>` : '-'}</td>`;
      html += `<td>${meal.notes ? this.escapeHtml(meal.notes) : '-'}</td>`;
      html += `<td>
        <button class="edit-meal-btn btn-primary" data-meal='${this.escapeHtml(mealData)}'>✏️ Edit</button>
        <button class="delete-meal-btn btn-danger" data-meal='${this.escapeHtml(mealData)}'>🗑️ Delete</button>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    content.innerHTML = html;
  }

  renderMealsLibrary() {
    const content = document.getElementById('meals-content');
    const filterEl = document.getElementById('library-filter');
    const filterValue = filterEl ? filterEl.value : 'all';

    // Read directly from library (includes all meals regardless of scheduled status)
    let meals = (this.data.library || []).slice().sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    // Filter by search query
    if (this.searchQuery) {
      meals = meals.filter(meal =>
        meal.name.toLowerCase().includes(this.searchQuery)
      );
    }

    // Filter by potential status
    if (filterValue === 'potential') {
      meals = meals.filter(meal => meal.potential === true);
    }

    if (meals.length === 0) {
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

    meals.forEach(meal => {
      const libData = JSON.stringify({
        library_id: meal.id,
        name: meal.name,
        recipe_url: meal.recipe_url || '',
        notes: meal.notes || '',
        potential: meal.potential || false
      });
      const isPotential = meal.potential === true;
      const rowClass = isPotential ? ' class="potential-row"' : '';
      const starClass = isPotential ? 'btn-potential btn-potential-active' : 'btn-potential';
      const starTitle = isPotential ? 'Remove Potential Meal' : 'Mark as a Potential Meal';

      html += `<tr${rowClass}>`;
      html += `<td>${this.escapeHtml(meal.name)}</td>`;
      html += `<td>${meal.recipe_url ? `<a href="#" class="recipe-link" data-url="${this.escapeHtml(meal.recipe_url)}">View Recipe</a>` : '-'}</td>`;
      html += `<td>${meal.notes ? this.escapeHtml(meal.notes) : '-'}</td>`;
      html += `<td>
        <button class="${starClass} toggle-potential-btn" data-lib='${this.escapeHtml(libData)}' title="${starTitle}">⭐</button>
        <button class="edit-library-btn btn-primary" data-lib='${this.escapeHtml(libData)}'>✏️ Edit</button>
        <button class="delete-library-meal-btn btn-danger" data-lib='${this.escapeHtml(libData)}'>🗑️ Delete</button>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    content.innerHTML = html;
  }

  async togglePotential(libraryId, newValue) {
    try {
      await this.callService('meal_planner/update_library', {
        library_id: libraryId,
        potential: newValue
      });
      await this.loadData();
      this.renderMealsLibrary();
    } catch (error) {
      console.error('[Meal Planner] Failed to toggle potential:', error);
      await this.showAlert('Failed to update potential status. Please try again.');
    }
  }

  openLibraryEditModal(libData) {
    const modal = document.getElementById('meal-modal');
    const form = document.getElementById('meal-form');
    const title = document.getElementById('modal-title');

    form.reset();
    this.editingMeal = null;
    this.editingLibraryId = libData.library_id;

    // Ensure all fields are visible
    document.getElementById('meal-date').closest('.form-group').style.display = '';
    document.getElementById('meal-time').closest('.form-group').style.display = '';

    title.textContent = 'Edit Meal';
    document.getElementById('meal-name').value = libData.name || '';
    document.getElementById('meal-date').value = '';
    document.getElementById('meal-time').value = 'Dinner';
    document.getElementById('meal-recipe').value = libData.recipe_url || '';
    document.getElementById('meal-notes').value = libData.notes || '';

    modal.classList.remove('hidden');
  }

  openMealModal(hideScheduleFields = false, mealData = null) {
    this.editingLibraryId = null;

    // Restore any hidden fields
    document.getElementById('meal-date').closest('.form-group').style.display = '';
    document.getElementById('meal-time').closest('.form-group').style.display = '';
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
      title.textContent = 'Add Meal';
      // Leave date blank - user chooses if they want to schedule it
      document.getElementById('meal-date').value = '';
    }

    modal.classList.remove('hidden');
  }

  closeMealModal() {
    const modal = document.getElementById('meal-modal');
    modal.classList.add('hidden');
    this.editingMeal = null;
    this.editingLibraryId = null;

    // Restore any hidden fields
    document.getElementById('meal-date').closest('.form-group').style.display = '';
    document.getElementById('meal-time').closest('.form-group').style.display = '';
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

      if (!name) {
        await this.showAlert('Please enter a meal name');
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

      if (this.editingLibraryId) {
        // Update library entry (name/recipe/notes)
        success = await this.updateLibraryEntry(this.editingLibraryId, {
          name,
          recipe_url: recipe || '',
          notes: notes || ''
        });
        // If a date was also provided, create a scheduled entry
        if (success && date) {
          success = await this.addMeal({ name, date, meal_time: mealTime, recipe_url: recipe || '', notes: notes || '' });
        }
      } else if (this.editingMeal && this.editingMeal.id) {
        // Update an existing scheduled entry
        success = await this.updateMeal(this.editingMeal.id, mealData);
      } else {
        // Add new meal
        success = await this.addMeal(mealData);
      }

      if (success) {
        console.log('[Meal Planner] Closing modal after successful save');
        this.closeMealModal();
      } else {
        console.log('[Meal Planner] Not closing modal - save failed');
        await this.showAlert('Failed to save meal. Please try again.');
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

    document.getElementById('settings-days-after').value = this.data.settings?.days_after_today ?? 3;
    document.getElementById('settings-days-to-keep').value = this.data.settings?.days_to_keep ?? 14;

    modal.classList.remove('hidden');
  }

  closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('hidden');
  }

  async handleSettingsSubmit() {
    const daysAfter = parseInt(document.getElementById('settings-days-after').value);
    const daysToKeep = parseInt(document.getElementById('settings-days-to-keep').value);

    if (daysAfter < 0 || daysAfter > 6) {
      await this.showAlert('Days after today must be between 0 and 6');
      return;
    }
    if (daysToKeep < 1 || daysToKeep > 365) {
      await this.showAlert('Days to keep must be between 1 and 365');
      return;
    }

    this.data.settings.days_after_today = daysAfter;
    this.data.settings.days_to_keep = daysToKeep;

    const success = await this.saveSettings();

    if (success) {
      this.closeSettingsModal();
      await this.loadData();
      this.renderCurrentView();
    } else {
      await this.showAlert('Failed to save settings. Please try again.');
    }
  }

  async deleteMeal(meal) {
    const confirmed = await this.showConfirm(`Delete "${meal.name}"?`);
    if (!confirmed) {
      return;
    }

    if (!this.hass) {
      console.warn('[Meal Planner] No HASS connection - cannot delete meal');
      await this.showAlert('Failed to delete meal. Please try again.');
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
      await this.showAlert('Failed to delete meal. Please try again.');
    }
  }

  async deleteLibraryMeal(libData) {
    const mealName = libData.name;
    const libraryId = libData.library_id;

    const confirmed = await this.showConfirm(`Delete "${mealName}" from your library? This will also remove all scheduled instances of this meal.`);
    if (!confirmed) return;

    if (!this.hass) {
      await this.showAlert('Failed to delete meal. Please try again.');
      return;
    }

    try {
      await this.callService('meal_planner/delete_library', { library_id: libraryId });
      await this.loadData();
      this.renderCurrentView();
    } catch (error) {
      console.error('[Meal Planner] Failed to delete library meal:', error);
      await this.showAlert('Failed to delete meal. Please try again.');
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
