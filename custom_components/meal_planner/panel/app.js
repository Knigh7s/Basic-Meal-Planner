// =====================
// Helper functions
// =====================
function $(selector) {
  return document.getElementById(selector.replace(/^#/, ''));
}

// =====================
// Home Assistant WS helpers
// =====================
async function getHAConnection() {
  // Prefer the HA shell connection exposed to iframes
  if (window.parent && window.parent.hassConnection) {
    const hc = await window.parent.hassConnection; // resolves to {conn, auth}
    return hc.conn ?? hc;
  }
  throw new Error("Open Meal Planner from the Home Assistant sidebar so authentication is handled.");
}

async function callWS(type, payload = {}) {
  const conn = await getHAConnection();
  if (typeof conn.sendMessagePromise !== "function") {
    throw new Error("HA connection not ready (sendMessagePromise missing)");
  }
  return conn.sendMessagePromise({ type, ...payload });
}

// convenience wrapper if you prefer the {type,...} style
async function haWS(msg) {
  const { type, ...rest } = msg || {};
  return callWS(type, rest);
}

// =====================
// State
// =====================
let allData = {
  settings: { week_start: "Sunday" },
  rows: [],
  library: [],
};

let currentEditId = null; // track the row being edited (null = adding)

// =====================
// Date utilities
// =====================
function parseISODate(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfWeek(d, weekStart = "Sunday") {
  const day = d.getDay(); // 0 Sun - 6 Sat
  const isMonday = (weekStart || "Sunday").toLowerCase() === "monday";
  // Compute offset so we land on correct week start
  const offset = isMonday ? (day === 0 ? -6 : 1 - day) : -day;
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  res.setDate(res.getDate() + offset);
  return res;
}

function endOfWeek(d, weekStart = "Sunday") {
  const sow = startOfWeek(d, weekStart);
  const res = new Date(sow);
  res.setDate(sow.getDate() + 6);
  res.setHours(23, 59, 59, 999);
  return res;
}

function isInPastWeek(dt, weekStart = "Sunday") {
  if (!dt) return false;
  const today = new Date();
  const thisWeekStart = startOfWeek(today, weekStart);
  return dt < thisWeekStart; // strictly before current week
}

function isInSameWeek(dt, anchor = new Date(), weekStart = "Sunday") {
  if (!dt) return false;
  const s1 = startOfWeek(anchor, weekStart).getTime();
  const e1 = endOfWeek(anchor, weekStart).getTime();
  const t = dt.getTime();
  return t >= s1 && t <= e1;
}

function isInSameMonth(dt, anchor = new Date()) {
  if (!dt) return false;
  return dt.getFullYear() === anchor.getFullYear() && dt.getMonth() === anchor.getMonth();
}

// =====================
// Fetch & Render
// =====================
async function loadMeals() {
  console.log("loadMeals() - Fetching data from backend...");
  const resp = await haWS({ type: "meal_planner/get" });
  console.log("loadMeals() - Response received:", resp);
  console.log("loadMeals() - Number of meals:", resp?.rows?.length || 0);
  // resp = { settings, rows, library }
  allData = resp || allData;
  console.log("loadMeals() - allData updated:", allData);
  renderTable();
  populateDatalist();
}

function renderTable() {
  console.log("renderTable() - Starting render...");
  const tbody = document.querySelector("#allTable tbody");
  if (!tbody) {
    console.error("renderTable() - tbody not found!");
    return;
  }

  const hidePast = $("#hidePast")?.checked;
  const filterType = $("#filterType")?.value || "none";
  const weekPicker = $("#weekPicker");
  const monthPicker = $("#monthPicker");
  const weekStart = (allData.settings?.week_start || "Sunday");

  console.log("renderTable() - Filters:", { hidePast, filterType, weekStart });
  console.log("renderTable() - Total meals to render:", allData.rows?.length || 0);

  // figure anchor for filters
  let weekAnchor = new Date();
  if (weekPicker && !weekPicker.classList.contains("hidden") && weekPicker.value) {
    const [y, w] = weekPicker.value.split("-W");
    if (y && w) {
      const jan4 = new Date(Number(y), 0, 4);
      const dayOfWeek = jan4.getDay() || 7;
      const thurs = new Date(jan4);
      thurs.setDate(jan4.getDate() - dayOfWeek + 1 + (Number(w) - 1) * 7);
      weekAnchor = thurs;
    }
  }

  let monthAnchor = new Date();
  if (monthPicker && !monthPicker.classList.contains("hidden") && monthPicker.value) {
    const [y, m] = monthPicker.value.split("-");
    if (y && m) monthAnchor = new Date(Number(y), Number(m) - 1, 1);
  }

  const frag = document.createDocumentFragment();
  const selectAll = $("#selectAll");
  if (selectAll) selectAll.checked = false;
  tbody.innerHTML = "";

  let renderedCount = 0;
  let filteredCount = 0;

  for (const row of allData.rows || []) {
    const dt = parseISODate(row.date);
    const isPotential = !row.date;

    console.log(`renderTable() - Processing meal: "${row.name}", date: ${row.date}, isPotential: ${isPotential}`);

    // Hide past week (only scheduled items)
    if (hidePast && !isPotential && isInPastWeek(dt, weekStart)) {
      console.log(`  -> Filtered out (past week)`);
      filteredCount++;
      continue;
    }

    // Filters
    if (filterType === "week") {
      if (!isPotential && !isInSameWeek(dt, weekAnchor, weekStart)) {
        console.log(`  -> Filtered out (not in selected week)`);
        filteredCount++;
        continue;
      }
      if (isPotential) {
        console.log(`  -> Filtered out (potential meal when week filter active)`);
        filteredCount++;
        continue;
      }
    } else if (filterType === "month") {
      if (!isPotential && !isInSameMonth(dt, monthAnchor)) {
        console.log(`  -> Filtered out (not in selected month)`);
        filteredCount++;
        continue;
      }
      if (isPotential) {
        console.log(`  -> Filtered out (potential meal when month filter active)`);
        filteredCount++;
        continue;
      }
    }

    console.log(`  -> Rendering meal to table`);
    renderedCount++;

    const tr = document.createElement("tr");
    if (isPotential) tr.classList.add("is-potential"); // grey background via your CSS

    // [0] checkbox
    const tdCheck = document.createElement("td");
    tdCheck.className = "narrow";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "row-select";
    cb.dataset.id = row.id;
    tdCheck.appendChild(cb);
    tr.appendChild(tdCheck);

    // [1] Name
    const tdName = document.createElement("td");
    tdName.append(document.createTextNode(row.name || ""));
    const editBtn = document.createElement("button");
    editBtn.className = "icon-edit";
    editBtn.title = "Edit";
    editBtn.dataset.id = row.id;
    editBtn.textContent = "✎";
    tdName.append(" ", editBtn);
    tr.appendChild(tdName);

    // [2] Meal Time
    const tdMeal = document.createElement("td");
    tdMeal.textContent = isPotential ? "—" : (row.meal_time || "Dinner");
    tr.appendChild(tdMeal);

    // [3] Date
    const tdDate = document.createElement("td");
    tdDate.textContent = isPotential ? "—" : (row.date || "—");
    tr.appendChild(tdDate);

    // [4] Recipe → button if link exists
    const tdRecipe = document.createElement("td");
    if (row.recipe_url && String(row.recipe_url).trim()) {
      const btn = document.createElement("button");
      btn.className = "linkbtn";
      btn.dataset.href = row.recipe_url;
      btn.textContent = "Open";
      tdRecipe.appendChild(btn);
    } else {
      tdRecipe.textContent = "—";
    }
    tr.appendChild(tdRecipe);

    // [5] Notes
    const tdNotes = document.createElement("td");
    tdNotes.textContent = row.notes || "—";
    tr.appendChild(tdNotes);

    frag.appendChild(tr);
  }

  tbody.appendChild(frag);
  console.log(`renderTable() - Complete! Rendered: ${renderedCount}, Filtered: ${filteredCount}, Total: ${(allData.rows || []).length}`);
  updateBulkUI();
}

// =====================
// Datalist from library
// =====================
function populateDatalist() {
  const dl = document.getElementById("meal_options");
  if (!dl) return;
  dl.innerHTML = "";
  const names = new Set();
  for (const m of allData.library || []) {
    const n = (m.name || "").trim();
    if (!n || names.has(n.toLowerCase())) continue;
    names.add(n.toLowerCase());
    const opt = document.createElement("option");
    opt.value = n;
    dl.appendChild(opt);
  }
}

// =====================
// Modal handlers
// =====================
function openAddModal() {
  const m = document.getElementById("modal");
  if (m) m.classList.remove("hidden");
}
function closeAddModal() {
  const m = document.getElementById("modal");
  if (m) m.classList.add("hidden");
}


// =====================
// Actions
// =====================
async function saveMeal() {
  console.log("saveMeal() called");

  // Hyphenated IDs (as in your HTML)
  const nameEl = document.getElementById("meal-name");
  const dateEl = document.getElementById("meal-date");
  const timeEl = document.getElementById("meal-time");
  const linkEl = document.getElementById("meal-recipe");
  const notesEl = document.getElementById("meal-notes");

  console.log("Form elements found:", { nameEl, dateEl, timeEl, linkEl, notesEl });

  const name = (nameEl?.value || "").trim();
  if (!name) {
    alert("Please enter a meal name.");
    nameEl?.focus();
    return;
  }

  const date = (dateEl?.value || "");
  const meal = (timeEl?.value || "Dinner");
  const recipe = (linkEl?.value || "");
  const notes = (notesEl?.value || "");

  console.log("Saving meal:", { name, date, meal, recipe, notes });

  const btn = document.getElementById("save");
  if (btn) btn.disabled = true;

  try {
    if (currentEditId) {
      console.log("Updating existing meal:", currentEditId);
      // Try true update (name/meal/date/recipe/notes). If backend lacks it, fallback to bulk date/time.
      try {
        await haWS({
          type: "meal_planner/update",
          row_id: currentEditId,
          name, meal_time: meal, date, recipe_url: recipe, notes
        });
      } catch (e) {
        const msg = (e && (e.code || e.message) || "") + "";
        if (/unknown/i.test(msg)) {
          await haWS({ type: "meal_planner/bulk", action: "assign_date", ids: [currentEditId], date, meal_time: meal });
          // NOTE: fallback won't change name/recipe/notes (add backend update later to support that)
        } else {
          throw e;
        }
      }
      currentEditId = null;
    } else {
      // Add new
      console.log("Adding new meal via WebSocket");
      const response = await haWS({
        type: "meal_planner/add",
        name, meal_time: meal, date, recipe_url: recipe, notes
      });
      console.log("WebSocket response:", response);
    }

    closeAddModal();

    // reset fields for next time
    if (nameEl) nameEl.value = "";
    if (dateEl) dateEl.value = "";
    if (timeEl) timeEl.value = "Dinner";
    if (linkEl) linkEl.value = "";
    if (notesEl) notesEl.value = "";

    console.log("Loading meals after save...");
    await loadMeals();
    console.log("Meals reloaded successfully");
  } catch (err) {
    console.error("Save failed", err);
    alert("Unable to save meal: " + ((err && (err.message || err.code || err.error)) || String(err)));
  } finally {
    if (btn) btn.disabled = false;
  }
}

function getSelectedIds() {
  return Array.from(document.querySelectorAll(".row-select:checked"))
    .map((el) => el.dataset.id)
    .filter(Boolean);
}

async function applyBulk() {
  const action = $("#bulkAction")?.value || "";
  const ids = getSelectedIds();
  if (!action || ids.length === 0) {
    alert("Select an action and at least one row.");
    return;
  }

  // Show confirmation for delete action
  if (action === "delete") {
    await showDeleteConfirmation(ids);
    return;
  }

  const body = { action, ids };

  if (action === "assign_date") {
    const dateEl = $("#bulkDate");
    const timeEl = $("#bulkTime");
    const dateVal = dateEl?.value || "";
    const timeVal = (timeEl?.value || "").trim();
    if (!dateVal) {
      alert("Choose a date for 'Assign date'.");
      return;
    }
    body.date = dateVal;
    if (timeVal) body.meal_time = timeVal;
  }

  try {
    await haWS({ type: "meal_planner/bulk", ...body });
    await loadMeals();
  } catch (err) {
    console.error("Bulk action failed", err);
    alert("Bulk action failed: " + ((err && (err.message || err.code || err.error)) || String(err)));
  } finally {
    // reset bulk UI
    if ($("#bulkAction")) $("#bulkAction").value = "";
    if ($("#bulkDate")) { $("#bulkDate").value = ""; $("#bulkDate").classList.add("hidden"); }
    if ($("#bulkTime")) { $("#bulkTime").classList.add("hidden"); }
  }
}

async function showDeleteConfirmation(ids) {
  const count = ids.length;
  const message = count === 1
    ? "Are you sure you want to delete this meal?"
    : `Are you sure you want to delete ${count} meals?`;

  const confirmMsg = document.getElementById("confirm-message");
  if (confirmMsg) confirmMsg.textContent = message;

  const modal = document.getElementById("modal-confirm");
  if (modal) modal.classList.remove("hidden");

  // Wait for user response
  return new Promise((resolve) => {
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    const cleanup = () => {
      if (modal) modal.classList.add("hidden");
      yesBtn?.removeEventListener("click", handleYes);
      noBtn?.removeEventListener("click", handleNo);
    };

    const handleYes = async () => {
      cleanup();
      try {
        await haWS({ type: "meal_planner/bulk", action: "delete", ids });
        await loadMeals();
        // Reset bulk UI
        if ($("#bulkAction")) $("#bulkAction").value = "";
      } catch (err) {
        console.error("Delete failed", err);
        alert("Delete failed: " + ((err && (err.message || err.code || err.error)) || String(err)));
      }
      resolve();
    };

    const handleNo = () => {
      cleanup();
      resolve();
    };

    yesBtn?.addEventListener("click", handleYes);
    noBtn?.addEventListener("click", handleNo);
  });
}

function updateBulkUI() {
  const action = document.getElementById("bulkAction")?.value || "";
  const anySelected = !!document.querySelector(".row-select:checked");
  const needsDate = (action === "assign_date");
  const hasDate = !!document.getElementById("bulkDate")?.value;

  // Ensure date/time pickers visibility matches the action
  if (needsDate) {
    document.getElementById("bulkDate")?.classList.remove("hidden");
    document.getElementById("bulkTime")?.classList.remove("hidden");
  } else {
    document.getElementById("bulkDate")?.classList.add("hidden");
    document.getElementById("bulkTime")?.classList.add("hidden");
  }

  const apply = document.getElementById("btn-apply");
  if (apply) apply.disabled = !action || !anySelected || (needsDate && !hasDate);
}

// =====================
// UI wiring
// =====================
function updateFilterVisibility() {
  const filterType = (document.getElementById("filterType")?.value || "none");
  const weekPicker = document.getElementById("weekPicker");
  const monthPicker = document.getElementById("monthPicker");
  if (weekPicker && monthPicker) {
    if (filterType === "week") {
      weekPicker.classList.remove("hidden");
      monthPicker.classList.add("hidden");
    } else if (filterType === "month") {
      monthPicker.classList.remove("hidden");
      weekPicker.classList.add("hidden");
    } else {
      weekPicker.classList.add("hidden");
      monthPicker.classList.add("hidden");
    }
  }
}

function wireUI() {
  // Add / Cancel / Save / Settings
  $("#btn-add")?.addEventListener("click", openAddModal);
  $("#btn-settings")?.addEventListener("click", () => alert("Settings coming soon"));
  document.getElementById("cancel")?.addEventListener("click", () => { currentEditId = null; closeAddModal(); });
  const saveBtn = $("#save");
  if (saveBtn && !saveBtn.onclick) saveBtn.addEventListener("click", saveMeal);

  // Hide past & filters
  $("#hidePast")?.addEventListener("change", renderTable);
  $("#filterType")?.addEventListener("change", () => {
    updateFilterVisibility();
    renderTable();
  });
  $("#weekPicker")?.addEventListener("change", renderTable);
  $("#monthPicker")?.addEventListener("change", renderTable);
  $("#btn-showall")?.addEventListener("click", () => {
    if ($("#filterType")) $("#filterType").value = "none";
    updateFilterVisibility();
    renderTable();
  });

  // Bulk UI
  $("#bulkAction")?.addEventListener("change", (e) => {
    const v = e.target.value;
    if (v === "assign_date") {
      $("#bulkDate")?.classList.remove("hidden");
      $("#bulkTime")?.classList.remove("hidden");
    } else {
      $("#bulkDate")?.classList.add("hidden");
      $("#bulkTime")?.classList.add("hidden");
    }
  });
  // Bulk UI helpers
  $("#bulkAction")?.addEventListener("change", updateBulkUI);
  $("#bulkDate")?.addEventListener("input", updateBulkUI);
  $("#selectAll")?.addEventListener("change", updateBulkUI);
  $("#btn-apply")?.addEventListener("click", applyBulk);

  // Select all
  $("#selectAll")?.addEventListener("change", (e) => {
    const on = e.target.checked;
    document.querySelectorAll(".row-select").forEach((cb) => (cb.checked = on));
    updateBulkUI();
  });

  // Event delegation for row checkboxes (prevents memory leak)
  const tbody = document.querySelector("#allTable tbody");
  if (tbody) {
    tbody.addEventListener("change", (e) => {
      if (e.target.classList.contains("row-select")) {
        updateBulkUI();
      }
    });
  }
}

// Click pencil to edit a single row
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".icon-edit");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const row = (allData?.rows || []).find(r => r.id === id);
  if (!row) return;

  currentEditId = id;
  $("#meal-name").value = row.name || "";
  $("#meal-date").value = row.date || "";
  $("#meal-time").value = row.meal_time || "Dinner";
  $("#meal-recipe").value = row.recipe_url || "";
  $("#meal-notes").value = row.notes || "";

  openAddModal();
});

// Open recipe links from buttons
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".linkbtn");
  if (!btn) return;
  const href = btn.getAttribute("data-href");
  if (href) window.open(href, "_blank", "noopener,noreferrer");
});


// =====================
// Event subscription (live refresh)
// =====================
async function subscribeToUpdates() {
  try {
    const hc = await window.parent.hassConnection;
    const conn = hc.conn ?? hc;
    conn.subscribeEvents(() => loadMeals(), "meal_planner_updated");
  } catch (_) { /* not in HA shell */ }
}


// =====================
// Boot
// =====================
window.addEventListener("DOMContentLoaded", async () => {
  wireUI();
  updateFilterVisibility();
  await loadMeals();
  subscribeToUpdates();

  // Handle refresh properly in iframe context
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "r") {
      e.preventDefault();
      console.log("Refresh requested - reloading data...");
      loadMeals();
    }
  });
});
