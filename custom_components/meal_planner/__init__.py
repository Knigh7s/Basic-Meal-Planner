from __future__ import annotations

import logging
from pathlib import Path
from datetime import datetime, timedelta, date
from typing import Optional
import uuid

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.frontend import (
    async_register_built_in_panel,
    async_remove_panel,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.storage import Store
from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.entity_component import EntityComponent
from homeassistant.core import callback

from .const import DOMAIN, STORAGE_FILE, STORAGE_DIR, EVENT_UPDATED

_LOGGER = logging.getLogger(__name__)

# ----------------------------
# In-memory defaults / helpers
# ----------------------------

DEFAULT_DATA = {
    "settings": {"week_start": "Sunday"},
    "scheduled": [],  # list of entries with id, name, meal_time, date, recipe_url, notes
    "library": [],    # list of {name, recipe_url, notes}
}

MEAL_TIME_ORDER = {"Breakfast": 0, "Lunch": 1, "Dinner": 2, "Snack": 3}


def _current_week_bounds(today: date, week_start: str) -> tuple[date, date]:
    week_start = (week_start or "Sunday").title()
    if week_start == "Monday":
        start = today - timedelta(days=today.weekday())
    else:
        start = today - timedelta(days=(today.weekday() + 1) % 7)
    end = start + timedelta(days=6)
    return start, end


def _parse_date(s: str) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def _upsert_library(data: dict, name: str, recipe_url: str, notes: str):
    key = (name or "").strip().lower()
    if not key:
        return
    lib = data.setdefault("library", [])
    for item in lib:
        if (item.get("name", "").strip().lower()) == key:
            if recipe_url:
                item["recipe_url"] = recipe_url
            if notes:
                item["notes"] = notes
            return
    lib.append({"name": name.strip(), "recipe_url": recipe_url, "notes": notes})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True


# --------------
# Sensor entities
# --------------

class PotentialMealsSensor(SensorEntity):
    _attr_name = "Meal Planner Potential Meals"
    _attr_icon = "mdi:lightbulb-outline"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, store: Store, data: dict, entry_id: str):
        self.hass = hass
        self.store = store
        self.data = data
        # unique per config entry to avoid collisions
        self._attr_unique_id = f"{entry_id}_meal_planner_potential"
        self._recalc()

    def _recalc(self) -> None:
        items = [
            (m.get("name") or "")
            for m in self.data.get("scheduled", [])
            if not (m.get("date") or "").strip()
        ]
        items = [i for i in items if i]
        self._attr_native_value = len(items)
        self._attr_extra_state_attributes = {
            "items": sorted(items, key=lambda s: s.lower())
        }

    async def async_update_from_data(self) -> None:
        self._recalc()
        self.async_write_ha_state()


class WeeklyMealsSensor(SensorEntity):
    _attr_name = "Meal Planner Weekly View"
    _attr_icon = "mdi:calendar-week"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, store: Store, data: dict, entry_id: str):
        self.hass = hass
        self.store = store
        self.data = data
        self._attr_unique_id = f"{entry_id}_meal_planner_week"
        self._recalc()

    def _recalc(self) -> None:
        today = datetime.now().date()
        week_start = self.data.get("settings", {}).get("week_start", "Sunday")
        start, end = _current_week_bounds(today, week_start)

        days_order = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        day_labels = {
            "sun": "Sun", "mon": "Mon", "tue": "Tue", "wed": "Wed",
            "thu": "Thu", "fri": "Fri", "sat": "Sat",
        }
        grid = {
            k: {"label": day_labels[k], "breakfast": "", "lunch": "", "dinner": "", "snack": ""}
            for k in days_order
        }

        for m in self.data.get("scheduled", []):
            ds = (m.get("date") or "").strip()
            if not ds:
                continue
            try:
                d = datetime.strptime(ds, "%Y-%m-%d").date()
            except Exception:
                continue

            if start <= d <= end:
                mapping = {6: "sun", 0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat"}
                k = mapping[d.weekday()]
                slot = (m.get("meal_time") or "Dinner").strip().lower()
                if slot in ("breakfast", "lunch", "dinner", "snack"):
                    grid[k][slot] = m.get("name", "")

        self._attr_native_value = f"{start.isoformat()} to {end.isoformat()}"
        self._attr_extra_state_attributes = {
            "week_start": week_start,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "days": grid,
        }

    async def async_update_from_data(self) -> None:
        self._recalc()
        self.async_write_ha_state()


# -------------------
# Config entry setup
# -------------------

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Ensure storage dir
    store_dir = Path(hass.config.path(STORAGE_DIR))
    store_dir.mkdir(parents=True, exist_ok=True)

    # Load data
    store = Store(hass, 1, f"{STORAGE_DIR}/{STORAGE_FILE}")
    data = await store.async_load()
    if not isinstance(data, dict):
        data = DEFAULT_DATA.copy()

    # Normalize
    data.setdefault("settings", {"week_start": "Sunday"})
    data.setdefault("scheduled", [])
    data.setdefault("library", [])
    for m in data["scheduled"]:
        m.setdefault("id", uuid.uuid4().hex)
        m.setdefault("recipe_url", "")
        m.setdefault("notes", "")
        m.setdefault("meal_time", "Dinner")
        m.setdefault("date", "")

    # Save handles
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].update({"store": store, "data": data})

    # ---------- Sensors (guard against re-adding) ----------
    sensors_added = hass.data[DOMAIN].get("sensors_added", False)
    if not sensors_added:
        pot_sensor = PotentialMealsSensor(hass, store, data, entry.entry_id)
        week_sensor = WeeklyMealsSensor(hass, store, data, entry.entry_id)
        try:
            comp = EntityComponent(_LOGGER, "sensor", hass)
            await comp.async_add_entities([pot_sensor, week_sensor], True)
            hass.data[DOMAIN]["sensors"] = {"potential": pot_sensor, "week": week_sensor}
            hass.data[DOMAIN]["sensors_added"] = True
        except Exception as e:
            _LOGGER.debug("Sensor registration error: %s", e)
    else:
        # Update existing sensors' view of data
        sensors = hass.data[DOMAIN].get("sensors", {})
        if "potential" in sensors:
            await sensors["potential"].async_update_from_data()
        if "week" in sensors:
            await sensors["week"].async_update_from_data()

    async def _save_and_notify():
        await store.async_save(data)
        sensors = hass.data[DOMAIN].get("sensors", {})
        if "potential" in sensors:
            await sensors["potential"].async_update_from_data()
        if "week" in sensors:
            await sensors["week"].async_update_from_data()
        hass.bus.async_fire(EVENT_UPDATED)

    # ---------- Services ----------
    async def svc_add(call: ServiceCall):
        name = (call.data.get("name") or "").strip()
        meal_time = (call.data.get("meal_time") or "Dinner").strip().title()
        if meal_time not in ("Breakfast", "Lunch", "Dinner", "Snack"):
            meal_time = "Dinner"
        date_str = (call.data.get("date") or "").strip()
        recipe_url = (call.data.get("recipe_url") or "").strip()
        notes = (call.data.get("notes") or "").strip()
        if not name:
            return
        _upsert_library(data, name, recipe_url, notes)
        data["scheduled"].append({
            "id": uuid.uuid4().hex,
            "name": name,
            "meal_time": meal_time,
            "date": date_str,
            "recipe_url": recipe_url,
            "notes": notes,
        })
        await _save_and_notify()

    hass.services.async_register(DOMAIN, "add", svc_add)

    async def svc_bulk(call: ServiceCall):
        action = (call.data.get("action") or "").lower()
        ids = list(call.data.get("ids") or [])
        date_str = (call.data.get("date") or "").strip()
        meal_time_in = (call.data.get("meal_time") or "").strip().title() or None

        if action not in ("convert_to_potential", "assign_date", "delete"):
            return

        idset = set(ids)
        new_list = []

        for m in data["scheduled"]:
            if m["id"] not in idset:
                new_list.append(m)
                continue

            if action == "convert_to_potential":
                m["date"] = ""
                new_list.append(m)

            elif action == "assign_date":
                if date_str:
                    m["date"] = date_str
                if meal_time_in in ("Breakfast", "Lunch", "Dinner", "Snack"):
                    m["meal_time"] = meal_time_in
                new_list.append(m)

            elif action == "delete":
                # drop this row
                pass

        data["scheduled"] = new_list
        await _save_and_notify()

    hass.services.async_register(DOMAIN, "bulk", svc_bulk)

    async def svc_clear_potential(call: ServiceCall):
        data["scheduled"] = [m for m in data["scheduled"] if (m.get("date") or "").strip()]
        await _save_and_notify()

    hass.services.async_register(DOMAIN, "clear_potential", svc_clear_potential)

    async def svc_clear_week(call: ServiceCall):
        today = datetime.now().date()
        start, end = _current_week_bounds(today, data["settings"]["week_start"])
        kept = []
        for m in data["scheduled"]:
            dt = _parse_date(m.get("date", ""))
            if dt and start <= dt <= end:
                continue
            kept.append(m)
        data["scheduled"] = kept
        await _save_and_notify()

    hass.services.async_register(DOMAIN, "clear_week", svc_clear_week)

    async def svc_promote_future(call: ServiceCall):
        hass.bus.async_fire(EVENT_UPDATED)

    hass.services.async_register(DOMAIN, "promote_future_to_week", svc_promote_future)

    # ---------- WebSocket commands (register BEFORE returning) ----------
    from homeassistant.components import websocket_api

    @websocket_api.websocket_command({"type": f"{DOMAIN}/get"})
    @callback
    def ws_get(hass, connection, msg):
        connection.send_result(msg["id"], {
            "settings": data.get("settings", {"week_start": "Sunday"}),
            "rows": data.get("scheduled", []),
            "library": data.get("library", []),
        })

    @websocket_api.websocket_command({"type": f"{DOMAIN}/add", "name": str, "meal_time": str, "date": str, "recipe_url": str, "notes": str})
    @callback
    def ws_add(hass, connection, msg):
        hass.async_create_task(hass.services.async_call(DOMAIN, "add", {
            "name": msg.get("name",""),
            "meal_time": msg.get("meal_time","Dinner"),
            "date": msg.get("date",""),
            "recipe_url": msg.get("recipe_url",""),
            "notes": msg.get("notes",""),
        }))
        connection.send_result(msg["id"], {"queued": True})

    @websocket_api.websocket_command({"type": f"{DOMAIN}/bulk", "action": str, "ids": list, "date": str, "meal_time": str})
    @callback
    def ws_bulk(hass, connection, msg):
        hass.async_create_task(hass.services.async_call(DOMAIN, "bulk", {
            "action": msg.get("action",""),
            "ids": msg.get("ids",[]),
            "date": msg.get("date",""),
            "meal_time": msg.get("meal_time",""),
        }))
        connection.send_result(msg["id"], {"queued": True})

    websocket_api.async_register_command(hass, ws_get)
    websocket_api.async_register_command(hass, ws_add)
    websocket_api.async_register_command(hass, ws_bulk)

    # ---------- Serve static admin panel (no cache) ----------
    panel_dir = Path(__file__).parent / "panel"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                url_path="/meal-planner",
                path=str(panel_dir),
                cache_headers=False,  # avoid stale JS/CSS after HACS updates
            )
        ]
    )
    _LOGGER.info("Meal Planner: static panel served at /meal-planner from %s", panel_dir)

    # ---------- Sidebar (iframe → reliable & simple) ----------
    panel_id = "meal-planner"
    add_sidebar = entry.options.get("add_sidebar", True)

    try:
        await async_remove_panel(hass, panel_id)  # safe if not present
    except Exception:
        pass

    if add_sidebar:
        try:
            # NOTE: registrar is synchronous → do NOT 'await'
            async_register_built_in_panel(
                hass,
                component_name="iframe",
                sidebar_title="Meal Planner",
                sidebar_icon="mdi:silverware-fork-knife",
                frontend_url_path=panel_id,                  # /meal-planner
                config={"url": "/meal-planner/index.html"},  # file served above
                require_admin=False,
            )
            _LOGGER.info("Meal Planner: iframe panel '%s' registered", panel_id)
        except Exception as e:
            _LOGGER.error("Meal Planner: failed to register iframe panel: %s", e)
    else:
        _LOGGER.info("Meal Planner: sidebar option disabled; panel not registered")

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    try:
        await async_remove_panel(hass, "meal-planner")
    except Exception:
        pass
    hass.data.pop(DOMAIN, None)
    return True


