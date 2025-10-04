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
    // input type=week format: "YYYY-W##"
    const [y, w] = weekPicker.value.split("-W");
    if (y && w) {
      // ISO week approximation: set to Thursday of that week, then compute startOfWeek
      const jan4 = new Date(Number(y), 0, 4);
      const dayOfWeek = jan4.getDay() || 7;
      const thurs = new Date(jan4);
      thurs.setDate(jan4.getDate() - dayOfWeek + 1 + (Number(w) - 1) * 7);
      weekAnchor = thurs;
    }
  }

  let monthAnchor = new Date();
  if (monthPicker && !monthPicker.classList.contains("hidden") && monthPicker.value) {
    // input type=month format: "YYYY-MM"
    const [y, m] = monthPicker.value.split("-");
    if (y && m) monthAnchor = new Date(Number(y), Number(m) - 1, 1);
  }

  // Build rows
  const frag = document.createDocumentFragment();

  // Reset "select all"
  const selectAll = $("#selectAll");
  if (selectAll) selectAll.checked = false;

  // Clear tbody
  tbody.innerHTML = "";

  for (const row of allData.rows || []) {
    const dt = parseISODate(row.date);
    const isPotential = !row.date;

    // Hide past week if requested (applies only to scheduled)
    if (hidePast && !isPotential && isInPastWeek(dt, weekStart)) {
      continue;
    }

    // Filters
    if (filterType === "week") {
      if (!isPotential && !isInSameWeek(dt, weekAnchor, weekStart)) continue;
      if (isPotential) continue; // potentials hidden in week filter
    } else if (filterType === "month") {
      if (!isPotential && !isInSameMonth(dt, monthAnchor)) continue;
      if (isPotential) continue; // potentials hidden in month filter
    }

    const tr = document.createElement("tr");
    if (isPotential) tr.classList.add("is-potential"); // style: grey background

    // checkbox
    const tdCheck = document.createElement("td");
    tdCheck.className = "narrow";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "row-select";
    cb.dataset.id = row.id;
    tdCheck.appendChild(cb);
    tr.appendChild(tdCheck);

    // name
    const tdName = document.createElement("td");
    tdName.textContent = row.name || "";
    tr.appendChild(tdName);

    // status
    const tdStatus = document.createElement("td");
    if (isPotential) {
      tdStatus.textContent = "Potential";
    } else {
      tdStatus.textContent = `${row.meal_time || "Dinner"} — ${row.date}`;
    }
    tr.appendChild(tdStatus);

    // recipe
    const tdRecipe = document.createElement("td");
    if (row.recipe_url) {
      const a = document.createElement("a");
      a.href = row.recipe_url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Open";
      tdRecipe.appendChild(a);
    } else {
      tdRecipe.textContent = "—";
    }
    tr.appendChild(tdRecipe);

    // notes
    const tdNotes = document.createElement("td");
    tdNotes.textContent = row.notes || "—";
    tr.appendChild(tdNotes);

    frag.appendChild(tr);
  }

  tbody.appendChild(frag);
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
  // Hyphenated IDs (as you standardized in your HTML)
  const nameEl  = document.getElementById("meal-name");
  const dateEl  = document.getElementById("meal-date");
  const timeEl  = document.getElementById("meal-time");
  const linkEl  = document.getElementById("meal-recipe");
  const notesEl = document.getElementById("meal-notes");

  const name = (nameEl?.value || "").trim();
  if (!name) {
    alert("Please enter a meal name.");
    nameEl?.focus();
    return;
  }

  const payload = {
    type: "meal_planner/add",
    name,
    meal_time: (timeEl?.value || "Dinner"),
    date: (dateEl?.value || ""),           // blank → Potential
    recipe_url: (linkEl?.value || ""),
    notes: (notesEl?.value || ""),
  };

  const btn = document.getElementById("save");
  if (btn) btn.disabled = true;

  try {
    await haWS(payload);
    closeAddModal();
    // optionally clear fields for next time
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
  $("#cancel")?.addEventListener("click", closeAddModal);
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
  $("#btn-apply")?.addEventListener("click", applyBulk);

  // Select all
  $("#selectAll")?.addEventListener("change", (e) => {
    const on = e.target.checked;
    document.querySelectorAll(".row-select").forEach((cb) => (cb.checked = on));
  });
}

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
