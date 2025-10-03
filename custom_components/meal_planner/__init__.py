
from __future__ import annotations

import logging
from homeassistant.components.http import StaticPathConfig
from pathlib import Path
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import Optional
import uuid

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.storage import Store
from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.entity_component import EntityComponent

from .const import DOMAIN, STORAGE_FILE, STORAGE_DIR, EVENT_UPDATED

_LOGGER = logging.getLogger(__name__)

DEFAULT_DATA = {
    "settings": {"week_start": "Sunday"},
    "scheduled": [],  # list of entries with id, name, meal_time, date, recipe_url, notes
    "library": []     # list of {name, recipe_url, notes}
}

MEAL_TIME_ORDER = {"Breakfast": 0, "Lunch": 1, "Dinner": 2}

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
    key = name.strip().lower()
    lib = data.setdefault("library", [])
    for item in lib:
        if item.get("name","").strip().lower() == key:
            if recipe_url: item["recipe_url"] = recipe_url
            if notes: item["notes"] = notes
            return
    lib.append({"name": name.strip(), "recipe_url": recipe_url, "notes": notes})

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True

class PotentialMealsSensor(SensorEntity):
    _attr_name = "Meal Planner Potential Meals"
    _attr_icon = "mdi:lightbulb-outline"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, store: Store, data: dict, entry_id: str):
        self.hass = hass
        self.store = store
        self.data = data
        self._attr_unique_id = f"{entry_id}_meal_planner_potential"
        self._recalc()
    ...

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
    ...


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store_dir = Path(hass.config.path(STORAGE_DIR))
    store_dir.mkdir(parents=True, exist_ok=True)

    store = Store(hass, 1, f"{STORAGE_DIR}/{STORAGE_FILE}")
    data = await store.async_load()
    if not isinstance(data, dict):
        data = DEFAULT_DATA.copy()

    if "settings" not in data: data["settings"] = {"week_start": "Sunday"}
    if "scheduled" not in data: data["scheduled"] = []
    if "library" not in data: data["library"] = []
    for m in data["scheduled"]:
        if not m.get("id"): m["id"] = uuid.uuid4().hex
        m.setdefault("recipe_url",""); m.setdefault("notes","")
        m.setdefault("meal_time","Dinner"); m.setdefault("date","")

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {"store": store, "data": data, "sensor": None}

    # Register sensors
    pot_sensor = PotentialMealsSensor(hass, store, data, entry.entry_id)
    week_sensor = WeeklyMealsSensor(hass, store, data, entry.entry_id)
    try:
        comp = EntityComponent(_LOGGER, "sensor", hass)
        await comp.async_add_entities([pot_sensor, week_sensor], True)
    except Exception as e:
        _LOGGER.debug("Sensor registration fallback: %s", e)

    async def _save_and_notify():
        await store.async_save(data)
        await pot_sensor.async_update_from_data()
        await week_sensor.async_update_from_data()
        hass.bus.async_fire(EVENT_UPDATED)

    # Services
    async def svc_add(call: ServiceCall):
        name = (call.data.get("name") or "").strip()
        meal_time = (call.data.get("meal_time") or "Dinner").strip().title()
        date_str = (call.data.get("date") or "").strip()
        recipe_url = (call.data.get("recipe_url") or "").strip()
        notes = (call.data.get("notes") or "").strip()
        if not name:
            return
        _upsert_library(data, name, recipe_url, notes)
        data["scheduled"].append({
            "id": uuid.uuid4().hex, "name": name, "meal_time": meal_time,
            "date": date_str, "recipe_url": recipe_url, "notes": notes
        })
        await _save_and_notify()
    hass.services.async_register(DOMAIN, "add", svc_add)

    async def svc_bulk(call: ServiceCall):
        action = (call.data.get("action") or "").lower()
        ids = list(call.data.get("ids") or [])
        date_str = (call.data.get("date") or "").strip()
        meal_time = (call.data.get("meal_time") or "").strip().title() or None
        if action not in ("convert_to_potential","assign_date","delete"):
            return
        idset = set(ids)
        new = []
        for m in data["scheduled"]:
            if m["id"] not in idset:
                new.append(m); continue
            if action == "convert_to_potential":
                m["date"] = ""; new.append(m)
            elif action == "assign_date":
                if date_str: m["date"] = date_str
                if meal_time: m["meal_time"] = meal_time
                new.append(m)
            elif action == "delete":
                pass
        data["scheduled"] = new
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
            dt = _parse_date(m.get("date",""))
            if dt and start <= dt <= end:
                continue
            kept.append(m)
        data["scheduled"] = kept
        await _save_and_notify()
    hass.services.async_register(DOMAIN, "clear_week", svc_clear_week)

    async def svc_promote_future(call: ServiceCall):
        hass.bus.async_fire(EVENT_UPDATED)
    hass.services.async_register(DOMAIN, "promote_future_to_week", svc_promote_future)

    # Websocket for admin panel
    from homeassistant.components import websocket_api

    @websocket_api.websocket_command({"type": f"{DOMAIN}/get"})
    def ws_get(hass, connection, msg):
        connection.send_result(msg["id"], {
            "settings": data.get("settings", {"week_start": "Sunday"}),
            "rows": data.get("scheduled", []),
            "library": data.get("library", [])
        })

    @websocket_api.websocket_command({"type": f"{DOMAIN}/add", "name": str, "meal_time": str, "date": str, "recipe_url": str, "notes": str})
    def ws_add(hass, connection, msg):
        hass.async_create_task(hass.services.async_call(DOMAIN, "add", {
            "name": msg.get("name",""),
            "meal_time": msg.get("meal_time","Dinner"),
            "date": msg.get("date",""),
            "recipe_url": msg.get("recipe_url",""),
            "notes": msg.get("notes","")
        }))
        connection.send_result(msg["id"], {"queued": True})

    @websocket_api.websocket_command({"type": f"{DOMAIN}/bulk", "action": str, "ids": list, "date": str, "meal_time": str})
    def ws_bulk(hass, connection, msg):
        hass.async_create_task(hass.services.async_call(DOMAIN, "bulk", {
            "action": msg.get("action",""),
            "ids": msg.get("ids",[]),
            "date": msg.get("date",""),
            "meal_time": msg.get("meal_time","")
        }))
        connection.send_result(msg["id"], {"queued": True})

    # Serve static admin panel
    panel_dir = Path(__file__).parent / "panel"
    hass.http.async_register_static_paths([
    StaticPathConfig(
        url_path="/meal-planner",
        path=str(panel_dir),
        cache_headers=True,  # ok to keep True for panel assets
    )
])

    # Sidebar toggle (default ON)
    add_sidebar = entry.options.get("add_sidebar", True)
    panel_id = "meal-planner"
    if add_sidebar:
        try:
            await hass.components.frontend.async_register_built_in_panel(
                component_name="iframe",
                sidebar_title="Meal Planner",
                sidebar_icon="mdi:silverware-fork-knife",
                frontend_url_path="meal-planner",
                config={"url": "/meal-planner"},
                require_admin=False,
            )
        except Exception as e:
            _LOGGER.debug("Sidebar register error: %s", e)
    else:
        try:
            await hass.components.frontend.async_remove_panel(panel_id)
        except Exception:
            pass

    _LOGGER.info("Meal Planner panel served at /meal-planner")
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Attempt to remove panel on unload
    try:
        await hass.components.frontend.async_remove_panel("meal-planner")
    except Exception:
        pass
    hass.data.pop(DOMAIN, None)
    return True
