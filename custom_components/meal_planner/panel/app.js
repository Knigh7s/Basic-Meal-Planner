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

const $ = (sel) => document.querySelector(sel);

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
  const isMonday = (weekStart || "Sunday").toLowerCase() === " monday".trim();
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
  const resp = await haWS({ type: "meal_planner/get" });
  // resp = { settings, rows, library }
  allData = resp || allData;
  renderTable();
  populateDatalist();
}

function renderTable() {
  const tbody = $("#allTable tbody");
  if (!tbody) return;

  const hidePast = $("#hidePast")?.checked;
  const filterType = $("#filterType")?.value || "none";
  const weekPicker = $("#weekPicker");
  const monthPicker = $("#monthPicker");
  const weekStart = (allData.settings?.week_start || "Sunday");

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

  for (const row of allData.rows || []) {
    const dt = parseISODate(row.date);
    const isPotential = !row.date;

    // Hide past week (only scheduled items)
    if (hidePast && !isPotential && isInPastWeek(dt, weekStart)) continue;

    // Filters
    if (filterType === "week") {
      if (!isPotential && !isInSameWeek(dt, weekAnchor, weekStart)) continue;
      if (isPotential) continue;
    } else if (filterType === "month") {
      if (!isPotential && !isInSameMonth(dt, monthAnchor)) continue;
      if (isPotential) continue;
    }

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

  document.querySelectorAll(".row-select")
  .forEach(cb => cb.addEventListener("change", updateBulkUI));
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
  $("#modal")?.classList.remove("hidden");
}
function closeAddModal() {
  $("#modal")?.classList.add("hidden");
}

// =====================
// Actions
// =====================
async function saveMeal() {
  // Hyphenated IDs (as in your HTML)
  const nameEl  = document.getElementById("meal-name");
  const dateEl  = document.getElementById("meal-date");
  const timeEl  = document.getElementById("meal-time");
  const linkEl  = document.getElementById("meal-recipe");
  const notesEl = document.getElementById("meal-notes");

  const name = (nameEl?.value || "").trim();
  if (!name) { alert("Please enter a meal name."); nameEl?.focus(); return; }

  const date  = (dateEl?.value || "");
  const meal  = (timeEl?.value || "Dinner");
  const recipe= (linkEl?.value || "");
  const notes = (notesEl?.value || "");

  const btn = document.getElementById("save");
  if (btn) btn.disabled = true;

  try {
    if (currentEditId) {
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
          // NOTE: fallback won’t change name/recipe/notes (add backend update later to support that)
        } else {
          throw e;
        }
      }
      currentEditId = null;
    } else {
      // Add new
      await haWS({
        type: "meal_planner/add",
        name, meal_time: meal, date, recipe_url: recipe, notes
      });
    }

    closeAddModal();

    // reset fields for next time
    if (nameEl) nameEl.value = "";
    if (dateEl) dateEl.value = "";
    if (timeEl) timeEl.value = "Dinner";
    if (linkEl) linkEl.value = "";
    if (notesEl) notesEl.value = "";

    await loadMeals();
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
  const filterType = $("#filterType")?.value || "none";
  const weekPicker = $("#weekPicker");
  const monthPicker = $("#monthPicker");
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
  // Add / Cancel / Save
  $("#btn-add")?.addEventListener("click", openAddModal);
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
  });
}

// Click pencil to edit a single row
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".icon-edit");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const row = (allData?.rows || []).find(r => r.id === id);
  if (!row) return;

  currentEditId = id;
  $("#meal-name").value   = row.name || "";
  $("#meal-date").value   = row.date || "";
  $("#meal-time").value   = row.meal_time || "Dinner";
  $("#meal-recipe").value = row.recipe_url || "";
  $("#meal-notes").value  = row.notes || "";

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
});
