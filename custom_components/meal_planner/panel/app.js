
async function getWS() {
  if (window.hassConnection) {
    const { conn } = await window.hassConnection;
    return conn;
  }
  const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/api/websocket";
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => reject(new Error("Open this from the HA sidebar so authentication is handled."));
    ws.onerror = (e) => reject(e);
  });
}

async function callWS(type, payload={}) {
  const conn = await getWS();
  const resp = await conn.sendMessagePromise({type, ...payload});
  return resp;
}

function el(tag, attrs={}, ...children) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.substring(2), v);
    else n.setAttribute(k, v);
  });
  for (const c of children) n.append(c);
  return n;
}

function textOrDash(t){ return t && t.trim() ? t : "—"; }
function linkOrDash(url){ if(!url) return "—"; const a = document.createElement("a"); a.href=url; a.target="_blank"; a.textContent="Link"; return a; }

function weekBoundsFromInput(val, weekStart="Sunday"){
  try {
    const [yearPart, weekPart] = val.split("-W");
    const year = parseInt(yearPart,10); const week = parseInt(weekPart,10);
    const simple = new Date(Date.UTC(year,0,4));
    const dayOfWeek = simple.getUTCDay() || 7;
    const isoWeek1 = new Date(simple);
    isoWeek1.setUTCDate(simple.getUTCDate() + (1 - dayOfWeek));
    const start = new Date(isoWeek1);
    start.setUTCDate(isoWeek1.getUTCDate() + (week-1)*7);
    let s = start;
    if ((weekStart||"Sunday").toLowerCase()==="sunday"){
      const dow = s.getUTCDay();
      s = new Date(s); s.setUTCDate(s.getUTCDate() - ((dow+0)%7));
    }
    const e = new Date(s); e.setUTCDate(s.getUTCDate()+6);
    return [s.toISOString().slice(0,10), e.toISOString().slice(0,10)];
  } catch(e) { return [null,null]; }
}

function monthBoundsFromInput(val){
  try {
    const [y,m] = val.split("-").map(Number);
    const start = new Date(Date.UTC(y, m-1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return [start.toISOString().slice(0,10), end.toISOString().slice(0,10)];
  } catch(e){ return [null,null]; }
}

function applyFilters(rawRows, opts){
  let rows = [...rawRows];
  const today = new Date(); today.setHours(0,0,0,0);
  if (opts.hidePast) {
    const dow = today.getDay();
    const lastSat = new Date(today); lastSat.setDate(today.getDate() - (dow+1));
    const cutoff = lastSat;
    rows = rows.filter(r => {
      if (!r.date) return true;
      const d = new Date(r.date + "T00:00:00Z");
      return d >= cutoff;
    });
  }
  if (opts.type === "week" && opts.weekVal){
    const [s,e] = weekBoundsFromInput(opts.weekVal, opts.weekStart);
    if (s && e){ rows = rows.filter(r => r.date && r.date >= s && r.date <= e); } else { rows = []; }
  }
  if (opts.type === "month" && opts.monthVal){
    const [s,e] = monthBoundsFromInput(opts.monthVal);
    if (s && e){ rows = rows.filter(r => r.date && r.date >= s && r.date <= e); } else { rows = []; }
  }
  return rows;
}

function renderTable(tbody, rawRows, opts){
  tbody.innerHTML = "";
  const uns = rawRows.filter(r => !r.date);
  const sch = rawRows.filter(r => r.date)
    .sort((a,b)=> (a.date===b.date ? (a.meal_time||"").localeCompare(b.meal_time) : a.date.localeCompare(b.date)) );

  function row(r){
    const tr = el("tr", {class: !r.date ? "unscheduled" : ""});
    const tdSel = el("td", {class:"narrow"});
    const cb = el("input", {type:"checkbox", "data-id": r.id, onChange: updateApplyState});
    tdSel.append(cb);
    const tdName = el("td", {}, r.name);
    const tdStatus = el("td", {});
    tdStatus.textContent = r.date ? `${r.date} ${r.meal_time}` : "Potential Meals";
    if (!r.date) tdStatus.classList.add("status--potential");
    const tdRecipe = el("td"); tdRecipe.append(linkOrDash(r.recipe_url));
    const tdNotes = el("td", {}, textOrDash(r.notes||""));
    tr.append(tdSel, tdName, tdStatus, tdRecipe, tdNotes);
    return tr;
  }

  [...uns.map(row), ...sch.map(row)].forEach(tr => tbody.append(tr));
}

let _data = {rows:[], library:[], settings:{week_start:"Sunday"}};
function updateApplyState(){
  const anySelected = !!document.querySelector('#allTable tbody input[type="checkbox"]:checked');
  const action = document.getElementById("bulkAction").value;
  const apply = document.getElementById("btn-apply");
  apply.disabled = !anySelected || !action || (action==="assign_date" && !document.getElementById("bulkDate").value);
}

async function refresh(){
  const payload = await callWS("meal_planner/get");
  _data = payload;
  const dl = document.getElementById("meal_options");
  dl.innerHTML = "";
  (_data.library||[]).sort((a,b)=>a.name.localeCompare(b.name)).forEach(i=>{
    const opt = document.createElement("option"); opt.value=i.name; dl.append(opt);
  });

  const tbody = document.querySelector("#allTable tbody");
  const hidePast = document.getElementById("hidePast").checked;
  const filterType = document.getElementById("filterType").value;
  const weekVal = document.getElementById("weekPicker").value;
  const monthVal = document.getElementById("monthPicker").value;

  const rows = applyFilters(_data.rows, {
    hidePast, type: filterType, weekVal, monthVal, weekStart: _data.settings?.week_start || "Sunday"
  });
  renderTable(tbody, rows, {});

  const selectAll = document.getElementById("selectAll");
  selectAll.checked = false;
  selectAll.onchange = () => {
    document.querySelectorAll('#allTable tbody input[type="checkbox"]').forEach(cb=>cb.checked=selectAll.checked);
    updateApplyState();
  };
  document.querySelectorAll('#allTable tbody input[type="checkbox"]').forEach(cb=>cb.addEventListener('change', updateApplyState));

  updateApplyState();
}

async function addMeal(payload){ await callWS("meal_planner/add", payload); }
async function bulkAction(payload){ await callWS("meal_planner/bulk", payload); }

window.addEventListener("DOMContentLoaded", async () => {
  const btnAdd = document.getElementById("btn-add");
  const btnShowAll = document.getElementById("btn-showall");
  const hidePast = document.getElementById("hidePast");
  const filterType = document.getElementById("filterType");
  const weekPicker = document.getElementById("weekPicker");
  const monthPicker = document.getElementById("monthPicker");
  const bulkActionSel = document.getElementById("bulkAction");
  const bulkDate = document.getElementById("bulkDate");
  const bulkTime = document.getElementById("bulkTime");
  const btnApply = document.getElementById("btn-apply");

  btnAdd.addEventListener("click", ()=> document.getElementById("modal").classList.remove("hidden"));
  btnShowAll.addEventListener("click", ()=>{
    hidePast.checked = false;
    filterType.value = "none";
    weekPicker.value = ""; monthPicker.value = "";
    refresh();
  });
  hidePast.addEventListener("change", refresh);
  filterType.addEventListener("change", ()=>{
    const v = filterType.value;
    weekPicker.classList.toggle("hidden", v!=="week");
    monthPicker.classList.toggle("hidden", v!=="month");
    refresh();
  });
  weekPicker.addEventListener("change", refresh);
  monthPicker.addEventListener("change", refresh);

  bulkActionSel.addEventListener("change", ()=>{
    const v = bulkActionSel.value;
    const needsDate = v==="assign_date";
    bulkDate.classList.toggle("hidden", !needsDate);
    bulkTime.classList.toggle("hidden", !needsDate);
    updateApplyState();
  });

  btnApply.addEventListener("click", async ()=>{
    const action = bulkActionSel.value;
    if (!action) return;
    const ids = Array.from(document.querySelectorAll('#allTable tbody input[type="checkbox"]:checked')).map(cb=>cb.getAttribute("data-id"));
    const payload = {action, ids};
    if (action==="assign_date"){
      if (!bulkDate.value){ alert("Pick a date"); return; }
      payload.date = bulkDate.value;
      payload.meal_time = bulkTime.value;
    }
    await bulkAction(payload);
    await refresh();
  });

  document.getElementById("cancel").addEventListener("click", ()=> document.getElementById("modal").classList.add("hidden"));
  document.getElementById("save").addEventListener("click", async ()=>{
    const name = document.getElementById("meal-name").value.trim();
    const date = document.getElementById("meal-date").value;
    const time = document.getElementById("meal-time").value;
    const recipe = document.getElementById("meal-recipe").value.trim();
    const notes = document.getElementById("meal-notes").value.trim();
    if (!name){ alert("Please enter a meal name."); return; }
    await addMeal({name, date, meal_time: time, recipe_url: recipe, notes});
    document.getElementById("meal-name").value="";
    document.getElementById("meal-date").value="";
    document.getElementById("meal-time").value="Dinner";
    document.getElementById("meal-recipe").value="";
    document.getElementById("meal-notes").value="";
    document.getElementById("modal").classList.add("hidden");
    await refresh();
  });

  if (window.hassConnection) {
    const { conn } = await window.hassConnection;
    conn.subscribeEvents(()=>refresh(), "meal_planner_updated");
  }

  await refresh();
});
