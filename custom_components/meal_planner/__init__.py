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
from homeassistant.core import callback

from .const import (
    DOMAIN,
    STORAGE_FILE,
    STORAGE_DIR,
    EVENT_UPDATED,
    MAX_NAME_LENGTH,
    MAX_NOTES_LENGTH,
    MAX_URL_LENGTH,
    MAX_LIBRARY_SIZE,
    MAX_SCHEDULED_SIZE,
)

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

    # Enforce library size limit
    if len(lib) >= MAX_LIBRARY_SIZE:
        # Remove oldest entry if at limit
        lib.pop(0)

    for item in lib:
        if (item.get("name", "").strip().lower()) == key:
            if recipe_url:
                item["recipe_url"] = recipe_url
            if notes:
                item["notes"] = notes
            return
    lib.append({"name": name.strip(), "recipe_url": recipe_url, "notes": notes})


def _validate_date(date_str: str) -> Optional[str]:
    """Validate ISO date format (YYYY-MM-DD). Returns validated string or None."""
    if not date_str or not date_str.strip():
        return None
    try:
        parsed = datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
        return parsed.isoformat()
    except (ValueError, TypeError):
        _LOGGER.warning("Invalid date format: %s (expected YYYY-MM-DD)", date_str)
        return None


def _validate_url(url: str) -> str:
    """Validate and sanitize URL. Returns sanitized URL or empty string."""
    url = (url or "").strip()
    if not url:
        return ""
    if len(url) > MAX_URL_LENGTH:
        _LOGGER.warning("URL too long (%d chars), truncating to %d", len(url), MAX_URL_LENGTH)
        url = url[:MAX_URL_LENGTH]
    if not url.startswith(("http://", "https://")):
        _LOGGER.warning("Invalid URL protocol (must be http/https): %s", url[:50])
        return ""
    # Remove null bytes
    url = url.replace("\x00", "")
    return url


def _sanitize_string(value: str, max_length: int, field_name: str = "field") -> str:
    """Sanitize and truncate string input."""
    value = (value or "").strip()
    # Remove null bytes
    value = value.replace("\x00", "")
    if len(value) > max_length:
        _LOGGER.warning("%s too long (%d chars), truncating to %d", field_name, len(value), max_length)
        value = value[:max_length]
    return value


def _enforce_scheduled_limits(data: dict):
    """Enforce max scheduled meals limit. Remove oldest entries if needed."""
    scheduled = data.get("scheduled", [])
    if len(scheduled) <= MAX_SCHEDULED_SIZE:
        return

    # Sort by date (oldest first), potential meals (no date) go to end
    def sort_key(m):
        dt = _parse_date(m.get("date", ""))
        return dt if dt else date.max

    scheduled.sort(key=sort_key)
    # Keep only the most recent MAX_SCHEDULED_SIZE entries
    data["scheduled"] = scheduled[-MAX_SCHEDULED_SIZE:]
    _LOGGER.info("Scheduled meals limit reached, removed %d oldest entries", len(scheduled) - MAX_SCHEDULED_SIZE)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True


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
        m.setdefault("potential", False)

    # Save handles
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].update({"store": store, "data": data})

    # Clean up any duplicate/old entity registrations
    from homeassistant.helpers import entity_registry as er
    entity_reg = er.async_get(hass)

    # Remove any old duplicate entities
    for entity_id in list(entity_reg.entities):
        entity_entry = entity_reg.entities[entity_id]
        if entity_entry.config_entry_id == entry.entry_id and entity_entry.platform == DOMAIN:
            # Old entities were registered with platform=DOMAIN, new ones use platform="sensor"
            _LOGGER.info(f"Removing old entity registration: {entity_id}")
            entity_reg.async_remove(entity_id)

    # Forward to sensor platform
    await hass.config_entries.async_forward_entry_setups(entry, ["sensor"])

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
        # Validate and sanitize inputs
        name = _sanitize_string(call.data.get("name", ""), MAX_NAME_LENGTH, "meal name")
        if not name:
            _LOGGER.warning("Meal name is required")
            return

        meal_time = (call.data.get("meal_time") or "Dinner").strip().title()
        if meal_time not in ("Breakfast", "Lunch", "Dinner", "Snack"):
            meal_time = "Dinner"

        # Validate date format
        date_str = call.data.get("date", "")
        if date_str:
            validated_date = _validate_date(date_str)
            date_str = validated_date if validated_date else ""

        recipe_url = _validate_url(call.data.get("recipe_url", ""))
        notes = _sanitize_string(call.data.get("notes", ""), MAX_NOTES_LENGTH, "notes")

        _upsert_library(data, name, recipe_url, notes)
        potential = call.data.get("potential", False)
        data["scheduled"].append({
            "id": uuid.uuid4().hex,
            "name": name,
            "meal_time": meal_time,
            "date": date_str,
            "recipe_url": recipe_url,
            "notes": notes,
            "potential": potential,
        })

        # Enforce limits
        _enforce_scheduled_limits(data)
        await _save_and_notify()

    hass.services.async_register(DOMAIN, "add", svc_add)

    async def svc_update(call: ServiceCall):
        row_id = (call.data.get("row_id") or "").strip()
        if not row_id:
            return

        valid_times = ("Breakfast", "Lunch", "Dinner", "Snack")
        updated = False
        for m in data["scheduled"]:
            if m.get("id") == row_id:
                # Update only provided fields with validation
                if "name" in call.data:
                    name = _sanitize_string(call.data.get("name", ""), MAX_NAME_LENGTH, "meal name")
                    if name:
                        m["name"] = name
                        updated = True
                if "meal_time" in call.data:
                    mt = (call.data.get("meal_time") or "").strip().title()
                    if mt in valid_times:
                        m["meal_time"] = mt
                        updated = True
                if "date" in call.data:
                    date_str = call.data.get("date", "")
                    if date_str:
                        validated_date = _validate_date(date_str)
                        m["date"] = validated_date if validated_date else ""
                    else:
                        m["date"] = ""
                    updated = True
                if "recipe_url" in call.data:
                    m["recipe_url"] = _validate_url(call.data.get("recipe_url", ""))
                    updated = True
                if "notes" in call.data:
                    m["notes"] = _sanitize_string(call.data.get("notes", ""), MAX_NOTES_LENGTH, "notes")
                    updated = True
                if "potential" in call.data:
                    m["potential"] = bool(call.data.get("potential", False))
                    updated = True
                break

        if updated:
            await _save_and_notify()

    hass.services.async_register(DOMAIN, "update", svc_update)
    
    async def svc_bulk(call: ServiceCall):
        action = (call.data.get("action") or "").lower()
        ids = list(call.data.get("ids") or [])
        date_str = call.data.get("date", "")
        meal_time_in = (call.data.get("meal_time") or "").strip().title() or None

        if action not in ("convert_to_potential", "assign_date", "delete"):
            return

        # Validate date if provided for assign_date action
        if action == "assign_date" and date_str:
            validated_date = _validate_date(date_str)
            if not validated_date:
                _LOGGER.warning("Invalid date for bulk assign: %s", date_str)
                return
            date_str = validated_date

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
            "scheduled": data.get("scheduled", []),  # Returns list of meal objects
            "library": data.get("library", []),
        })

    @websocket_api.websocket_command({"type": f"{DOMAIN}/add", "name": str, "meal_time": str, "date": str, "recipe_url": str, "notes": str, "potential": bool})
    @callback
    def ws_add(hass, connection, msg):
        hass.async_create_task(hass.services.async_call(DOMAIN, "add", {
            "name": msg.get("name",""),
            "meal_time": msg.get("meal_time","Dinner"),
            "date": msg.get("date",""),
            "recipe_url": msg.get("recipe_url",""),
            "notes": msg.get("notes",""),
            "potential": msg.get("potential", False),
        }))
        connection.send_result(msg["id"], {"queued": True})

    @websocket_api.websocket_command({
        "type": f"{DOMAIN}/update",
        "row_id": str,
        # the rest are optional; only update what is provided
        "name": str,
        "meal_time": str,
        "date": str,
        "recipe_url": str,
        "notes": str,
        "potential": bool,
    })
    @callback
    def ws_update(hass, connection, msg):
        payload = {
            "row_id": msg.get("row_id", ""),
        }
        for k in ("name", "meal_time", "date", "recipe_url", "notes"):
            if k in msg:
                payload[k] = msg.get(k, "")
        if "potential" in msg:
            payload["potential"] = msg.get("potential", False)

        hass.async_create_task(
            hass.services.async_call(DOMAIN, "update", payload)
        )
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
    websocket_api.async_register_command(hass, ws_update)
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

    # ---------- Sidebar Panel ----------
    panel_id = "meal-planner"
    add_sidebar = entry.options.get("add_sidebar", True)

    try:
        await async_remove_panel(hass, panel_id)  # safe if not present
    except Exception:
        pass

    if add_sidebar:
        try:
            # Use iframe panel (reliable and simple)
            async_register_built_in_panel(
                hass,
                component_name="iframe",
                sidebar_title="Meal Planner",
                sidebar_icon="mdi:silverware-fork-knife",
                frontend_url_path=panel_id,
                config={"url": "/meal-planner/index.html"},
                require_admin=False,
            )
            _LOGGER.info("Meal Planner: iframe panel '%s' registered", panel_id)
        except Exception as e:
            _LOGGER.error("Meal Planner: failed to register iframe panel: %s", e)
    else:
        _LOGGER.info("Meal Planner: sidebar option disabled; panel not registered")

    # ---------- Register Custom Lovelace Cards ----------
    cards_dir = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                url_path="/meal_planner",
                path=str(cards_dir),
                cache_headers=False,
            )
        ]
    )

    # Auto-register cards in frontend (no manual resource registration needed!)
    from homeassistant.components.frontend import add_extra_js_url

    add_extra_js_url(hass, "/meal_planner/meal-planner-weekly-horizontal.js")
    add_extra_js_url(hass, "/meal_planner/meal-planner-weekly-vertical.js")
    add_extra_js_url(hass, "/meal_planner/meal-planner-potential-meals.js")

    _LOGGER.info("Meal Planner: custom cards auto-registered and served from %s", cards_dir)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    try:
        await async_remove_panel(hass, "meal-planner")
    except Exception:
        pass

    # Unload sensor platform
    unload_ok = await hass.config_entries.async_unload_platforms(entry, ["sensor"])

    if unload_ok:
        hass.data.pop(DOMAIN, None)

    return unload_ok



