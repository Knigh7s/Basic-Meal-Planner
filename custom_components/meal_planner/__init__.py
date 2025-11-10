from __future__ import annotations

import logging
from pathlib import Path
from datetime import datetime, timedelta, date
from typing import Optional
import uuid

import voluptuous as vol

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
    _LOGGER.info("=" * 80)
    _LOGGER.info("MEAL PLANNER: Starting async_setup_entry")
    _LOGGER.info("=" * 80)

    # New structure: 3 separate files in config/meal_planner/
    import json
    from homeassistant.util import json as hass_json

    storage_base = Path(hass.config.path(STORAGE_DIR))  # config/meal_planner/
    library_path = storage_base / "meal_library.json"
    scheduled_path = storage_base / "scheduled.json"
    settings_path = storage_base / "settings.json"

    # Old location for migration
    old_storage_base = Path(hass.config.path(".storage")) / STORAGE_DIR
    old_path = old_storage_base / STORAGE_FILE  # .storage/meal_planner/meals.json

    # Ensure directory exists
    storage_base.mkdir(parents=True, exist_ok=True)

    # Initialize data structure
    data = {
        "library": [],     # List of {id, name, recipe_url, notes}
        "scheduled": [],   # List of {id, library_id, date, meal_time, potential}
        "settings": {"week_start": "Sunday", "days_after_today": 3}
    }

    # Try loading new format first
    needs_migration = False
    if library_path.exists() and scheduled_path.exists():
        _LOGGER.info("Loading from new 3-file structure")
        try:
            def load_json_file(path):
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)

            data["library"] = await hass.async_add_executor_job(load_json_file, library_path)
            data["scheduled"] = await hass.async_add_executor_job(load_json_file, scheduled_path)
            if settings_path.exists():
                data["settings"] = await hass.async_add_executor_job(load_json_file, settings_path)

            _LOGGER.info("Loaded: %d library meals, %d scheduled", len(data["library"]), len(data["scheduled"]))
        except Exception as e:
            _LOGGER.error("Failed to load new structure: %s", e, exc_info=True)
            needs_migration = True
    else:
        needs_migration = True

    # Migration from old format
    if needs_migration and old_path.exists():
        _LOGGER.info("Migrating from old meals.json format...")
        try:
            def load_old_data(path):
                with open(path, "r", encoding="utf-8") as f:
                    contents = json.load(f)
                    return contents.get("data", contents) if "data" in contents else contents

            old_data = await hass.async_add_executor_job(load_old_data, old_path)

            # Migrate settings
            data["settings"] = old_data.get("settings", data["settings"])

            # Migrate library - extract unique meals by name
            old_library = old_data.get("library", [])
            library_map = {}  # name -> library entry
            for lib_meal in old_library:
                name = lib_meal.get("name", "").strip()
                if name and name not in library_map:
                    library_map[name] = {
                        "id": uuid.uuid4().hex,
                        "name": name,
                        "recipe_url": lib_meal.get("recipe_url", ""),
                        "notes": lib_meal.get("notes", "")
                    }

            # Migrate scheduled - create library entries for any unique meals
            old_scheduled = old_data.get("scheduled", [])
            for sched_meal in old_scheduled:
                name = sched_meal.get("name", "").strip()
                if name and name not in library_map:
                    # Create library entry from scheduled meal
                    library_map[name] = {
                        "id": uuid.uuid4().hex,
                        "name": name,
                        "recipe_url": sched_meal.get("recipe_url", ""),
                        "notes": sched_meal.get("notes", "")
                    }

            data["library"] = list(library_map.values())

            # Convert scheduled to references
            for sched_meal in old_scheduled:
                name = sched_meal.get("name", "").strip()
                if name in library_map:
                    data["scheduled"].append({
                        "id": sched_meal.get("id", uuid.uuid4().hex),
                        "library_id": library_map[name]["id"],
                        "date": sched_meal.get("date", ""),
                        "meal_time": sched_meal.get("meal_time", "Dinner"),
                        "potential": sched_meal.get("potential", False)
                    })

            _LOGGER.info("Migration complete: %d library, %d scheduled", len(data["library"]), len(data["scheduled"]))

            # Save in new format
            def save_json_file(path, content):
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(content, f, indent=2, ensure_ascii=False)

            await hass.async_add_executor_job(save_json_file, library_path, data["library"])
            await hass.async_add_executor_job(save_json_file, scheduled_path, data["scheduled"])
            await hass.async_add_executor_job(save_json_file, settings_path, data["settings"])

            # Backup old file
            backup_path = storage_base / "meals.json.backup"
            await hass.async_add_executor_job(lambda: old_path.rename(backup_path))
            _LOGGER.info("Backed up old meals.json to meals.json.backup")

        except Exception as e:
            _LOGGER.error("Migration failed: %s", e, exc_info=True)
            data = DEFAULT_DATA.copy()

    _LOGGER.info("Final data: Library=%d, Scheduled=%d", len(data["library"]), len(data["scheduled"]))

    # Normalize - ensure IDs exist
    for m in data["library"]:
        m.setdefault("id", uuid.uuid4().hex)
    for m in data["scheduled"]:
        m.setdefault("id", uuid.uuid4().hex)
        m.setdefault("library_id", "")
        m.setdefault("meal_time", "Dinner")
        m.setdefault("date", "")
        m.setdefault("potential", False)

    # Save handles and paths
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].update({
        "data": data,
        "paths": {
            "library": library_path,
            "scheduled": scheduled_path,
            "settings": settings_path
        }
    })

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

    async def _save_and_notify(save_library=False, save_scheduled=False, save_settings=False):
        # Save to appropriate files based on what changed
        import json

        def save_json_file(path, content):
            with open(path, "w", encoding="utf-8") as f:
                json.dump(content, f, indent=2, ensure_ascii=False)

        paths = hass.data[DOMAIN]["paths"]

        try:
            if save_library:
                await hass.async_add_executor_job(save_json_file, paths["library"], data["library"])
                _LOGGER.info("Library saved: %d meals", len(data["library"]))

            if save_scheduled:
                await hass.async_add_executor_job(save_json_file, paths["scheduled"], data["scheduled"])
                _LOGGER.info("Scheduled saved: %d entries", len(data["scheduled"]))

            if save_settings:
                await hass.async_add_executor_job(save_json_file, paths["settings"], data["settings"])
                _LOGGER.info("Settings saved")

        except Exception as e:
            _LOGGER.error("Failed to save data: %s", e, exc_info=True)

        # Update sensors
        sensors = hass.data[DOMAIN].get("sensors", {})
        if "potential" in sensors:
            await sensors["potential"].async_update_from_data()
        if "week" in sensors:
            await sensors["week"].async_update_from_data()
        hass.bus.async_fire(EVENT_UPDATED)

    # ---------- Services ----------
    async def svc_add(call: ServiceCall):
        """Add a meal - creates library entry and scheduled entry."""
        # Validate and sanitize inputs
        name = _sanitize_string(call.data.get("name", ""), MAX_NAME_LENGTH, "meal name")
        if not name:
            _LOGGER.warning("Meal name is required")
            return

        recipe_url = _validate_url(call.data.get("recipe_url", ""))
        notes = _sanitize_string(call.data.get("notes", ""), MAX_NOTES_LENGTH, "notes")

        # Find or create library entry
        library_entry = None
        for lib_meal in data["library"]:
            if lib_meal.get("name", "").lower() == name.lower():
                library_entry = lib_meal
                # Update library entry with latest recipe/notes
                library_entry["recipe_url"] = recipe_url
                library_entry["notes"] = notes
                break

        if not library_entry:
            # Create new library entry
            library_entry = {
                "id": uuid.uuid4().hex,
                "name": name,
                "recipe_url": recipe_url,
                "notes": notes
            }
            data["library"].append(library_entry)
            if len(data["library"]) > MAX_LIBRARY_SIZE:
                data["library"] = data["library"][-MAX_LIBRARY_SIZE:]

        # Validate schedule info
        meal_time = (call.data.get("meal_time") or "Dinner").strip().title()
        if meal_time not in ("Breakfast", "Lunch", "Dinner", "Snack"):
            meal_time = "Dinner"

        date_str = call.data.get("date", "")
        if date_str:
            validated_date = _validate_date(date_str)
            date_str = validated_date if validated_date else ""

        potential = call.data.get("potential", False)

        # Create scheduled entry
        data["scheduled"].append({
            "id": uuid.uuid4().hex,
            "library_id": library_entry["id"],
            "meal_time": meal_time,
            "date": date_str,
            "potential": potential,
        })

        # Enforce limits
        if len(data["scheduled"]) > MAX_SCHEDULED_SIZE:
            data["scheduled"] = data["scheduled"][-MAX_SCHEDULED_SIZE:]

        await _save_and_notify(save_library=True, save_scheduled=True)

    hass.services.async_register(DOMAIN, "add", svc_add)

    async def svc_update(call: ServiceCall):
        """Update a scheduled meal - updates library and/or scheduled entry."""
        row_id = (call.data.get("row_id") or "").strip()
        if not row_id:
            return

        # Find the scheduled entry
        scheduled_entry = None
        for m in data["scheduled"]:
            if m.get("id") == row_id:
                scheduled_entry = m
                break

        if not scheduled_entry:
            _LOGGER.warning("Scheduled entry not found: %s", row_id)
            return

        save_library = False
        save_scheduled = False

        # Handle name change (requires library update)
        if "name" in call.data:
            new_name = _sanitize_string(call.data.get("name", ""), MAX_NAME_LENGTH, "meal name")
            if new_name:
                # Find current library entry
                current_lib = None
                for lib in data["library"]:
                    if lib.get("id") == scheduled_entry.get("library_id"):
                        current_lib = lib
                        break

                # Check if name is changing
                if not current_lib or current_lib.get("name", "").lower() != new_name.lower():
                    # Find or create library entry with new name
                    new_lib = None
                    for lib in data["library"]:
                        if lib.get("name", "").lower() == new_name.lower():
                            new_lib = lib
                            break

                    if not new_lib:
                        # Create new library entry
                        new_lib = {
                            "id": uuid.uuid4().hex,
                            "name": new_name,
                            "recipe_url": call.data.get("recipe_url", "") if "recipe_url" in call.data else (current_lib.get("recipe_url", "") if current_lib else ""),
                            "notes": call.data.get("notes", "") if "notes" in call.data else (current_lib.get("notes", "") if current_lib else "")
                        }
                        data["library"].append(new_lib)
                        save_library = True

                    # Update scheduled entry to reference new library entry
                    scheduled_entry["library_id"] = new_lib["id"]
                    save_scheduled = True
                    save_library = True

        # Update library entry (recipe_url, notes)
        library_entry = None
        for lib in data["library"]:
            if lib.get("id") == scheduled_entry.get("library_id"):
                library_entry = lib
                break

        if library_entry:
            if "recipe_url" in call.data:
                library_entry["recipe_url"] = _validate_url(call.data.get("recipe_url", ""))
                save_library = True
            if "notes" in call.data:
                library_entry["notes"] = _sanitize_string(call.data.get("notes", ""), MAX_NOTES_LENGTH, "notes")
                save_library = True

        # Update scheduled entry (date, meal_time, potential)
        valid_times = ("Breakfast", "Lunch", "Dinner", "Snack")
        if "meal_time" in call.data:
            mt = (call.data.get("meal_time") or "").strip().title()
            if mt in valid_times:
                scheduled_entry["meal_time"] = mt
                save_scheduled = True

        if "date" in call.data:
            date_str = call.data.get("date", "")
            if date_str:
                validated_date = _validate_date(date_str)
                scheduled_entry["date"] = validated_date if validated_date else ""
            else:
                scheduled_entry["date"] = ""
            save_scheduled = True

        if "potential" in call.data:
            scheduled_entry["potential"] = bool(call.data.get("potential", False))
            save_scheduled = True

        if save_library or save_scheduled:
            await _save_and_notify(save_library=save_library, save_scheduled=save_scheduled)

    hass.services.async_register(DOMAIN, "update", svc_update)
    
    async def svc_bulk(call: ServiceCall):
        """Bulk operations on scheduled entries."""
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
        await _save_and_notify(save_scheduled=True)

    hass.services.async_register(DOMAIN, "bulk", svc_bulk)

    async def svc_clear_potential(call: ServiceCall):
        """Clear all potential (unscheduled) meals."""
        data["scheduled"] = [m for m in data["scheduled"] if (m.get("date") or "").strip()]
        await _save_and_notify(save_scheduled=True)

    hass.services.async_register(DOMAIN, "clear_potential", svc_clear_potential)

    async def svc_clear_week(call: ServiceCall):
        """Clear current week's scheduled meals."""
        today = datetime.now().date()
        start, end = _current_week_bounds(today, data["settings"]["week_start"])
        kept = []
        for m in data["scheduled"]:
            dt = _parse_date(m.get("date", ""))
            if dt and start <= dt <= end:
                continue
            kept.append(m)
        data["scheduled"] = kept
        await _save_and_notify(save_scheduled=True)

    hass.services.async_register(DOMAIN, "clear_week", svc_clear_week)

    async def svc_promote_future(call: ServiceCall):
        """Fire update event."""
        hass.bus.async_fire(EVENT_UPDATED)

    hass.services.async_register(DOMAIN, "promote_future_to_week", svc_promote_future)

    async def svc_update_settings(call: ServiceCall):
        """Update settings."""
        settings_data = dict(call.data)
        data["settings"].update(settings_data)
        await _save_and_notify(save_settings=True)

    hass.services.async_register(DOMAIN, "update_settings", svc_update_settings)

    # ---------- WebSocket commands (register BEFORE returning) ----------
    _LOGGER.info("About to register WebSocket commands...")
    from homeassistant.components import websocket_api

    @websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get"})
    @callback
    def ws_get(hass, connection, msg):
        """Get data - merges library + scheduled for frontend compatibility."""
        # Build library lookup
        library_map = {lib.get("id"): lib for lib in data.get("library", [])}

        # Merge scheduled with library data for frontend
        merged_scheduled = []
        for sched in data.get("scheduled", []):
            library_entry = library_map.get(sched.get("library_id"))
            merged_meal = {
                "id": sched.get("id", ""),
                "name": library_entry.get("name", "") if library_entry else "",
                "date": sched.get("date", ""),
                "meal_time": sched.get("meal_time", "Dinner"),
                "recipe_url": library_entry.get("recipe_url", "") if library_entry else "",
                "notes": library_entry.get("notes", "") if library_entry else "",
                "potential": sched.get("potential", False),
            }
            merged_scheduled.append(merged_meal)

        # Build library list with unique names for frontend
        unique_library = []
        seen_names = set()
        for lib in data.get("library", []):
            name = lib.get("name", "").lower()
            if name and name not in seen_names:
                seen_names.add(name)
                unique_library.append({
                    "name": lib.get("name", ""),
                    "recipe_url": lib.get("recipe_url", ""),
                    "notes": lib.get("notes", "")
                })

        connection.send_result(msg["id"], {
            "settings": data.get("settings", {"week_start": "Sunday"}),
            "scheduled": merged_scheduled,
            "library": unique_library,
        })

    @websocket_api.websocket_command({
        vol.Required("type"): f"{DOMAIN}/add",
        vol.Required("name"): str,
        vol.Optional("meal_time"): str,
        vol.Optional("date"): str,
        vol.Optional("recipe_url"): str,
        vol.Optional("notes"): str,
        vol.Optional("potential"): bool,
    })
    async def ws_add(hass, connection, msg):
        await hass.services.async_call(DOMAIN, "add", {
            "name": msg.get("name",""),
            "meal_time": msg.get("meal_time","Dinner"),
            "date": msg.get("date",""),
            "recipe_url": msg.get("recipe_url",""),
            "notes": msg.get("notes",""),
            "potential": msg.get("potential", False),
        })
        connection.send_result(msg["id"], {"success": True})

    @websocket_api.websocket_command({
        vol.Required("type"): f"{DOMAIN}/update",
        vol.Required("row_id"): str,
        vol.Optional("name"): str,
        vol.Optional("meal_time"): str,
        vol.Optional("date"): str,
        vol.Optional("recipe_url"): str,
        vol.Optional("notes"): str,
        vol.Optional("potential"): bool,
    })
    async def ws_update(hass, connection, msg):
        try:
            _LOGGER.info("=" * 80)
            _LOGGER.info("WS UPDATE CALLED!")
            _LOGGER.info("Message: %s", msg)
            _LOGGER.info("=" * 80)

            payload = {
                "row_id": msg.get("row_id", ""),
            }
            for k in ("name", "meal_time", "date", "recipe_url", "notes"):
                if k in msg:
                    payload[k] = msg.get(k, "")
            if "potential" in msg:
                payload["potential"] = msg.get("potential", False)

            _LOGGER.info("Calling update service with payload: %s", payload)
            await hass.services.async_call(DOMAIN, "update", payload)
            _LOGGER.info("Update service completed, sending result")
            connection.send_result(msg["id"], {"success": True})
        except Exception as e:
            _LOGGER.error("WS UPDATE ERROR: %s", e, exc_info=True)
            connection.send_error(msg["id"], "update_failed", str(e))

    @websocket_api.websocket_command({
        vol.Required("type"): f"{DOMAIN}/bulk",
        vol.Required("action"): str,
        vol.Required("ids"): list,
        vol.Optional("date"): str,
        vol.Optional("meal_time"): str,
    })
    async def ws_bulk(hass, connection, msg):
        await hass.services.async_call(DOMAIN, "bulk", {
            "action": msg.get("action",""),
            "ids": msg.get("ids",[]),
            "date": msg.get("date",""),
            "meal_time": msg.get("meal_time",""),
        })
        connection.send_result(msg["id"], {"success": True})

    @websocket_api.websocket_command({
        vol.Required("type"): f"{DOMAIN}/update_settings",
        vol.Optional("week_start"): str,
        vol.Optional("days_after_today"): int,
    })
    async def ws_update_settings(hass, connection, msg):
        settings_data = {}
        if "week_start" in msg:
            settings_data["week_start"] = msg.get("week_start")
        if "days_after_today" in msg:
            settings_data["days_after_today"] = msg.get("days_after_today")

        await hass.services.async_call(DOMAIN, "update_settings", settings_data)
        connection.send_result(msg["id"], {"success": True})

    # Test command - simple ping
    @websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/ping"})
    @callback
    def ws_ping(hass, connection, msg):
        _LOGGER.info("PING RECEIVED!")
        connection.send_result(msg["id"], {"pong": True})

    _LOGGER.info("Registering websocket commands")
    try:
        websocket_api.async_register_command(hass, ws_ping)
        _LOGGER.info("Registered: ping")
        websocket_api.async_register_command(hass, ws_get)
        _LOGGER.info("Registered: get")
        websocket_api.async_register_command(hass, ws_add)
        _LOGGER.info("Registered: add")
        websocket_api.async_register_command(hass, ws_update)
        _LOGGER.info("Registered: update")
        websocket_api.async_register_command(hass, ws_bulk)
        _LOGGER.info("Registered: bulk")
        websocket_api.async_register_command(hass, ws_update_settings)
        _LOGGER.info("Registered: update_settings")
    except Exception as e:
        _LOGGER.error("Failed to register websocket commands: %s", e, exc_info=True)
    _LOGGER.info("Websocket commands registered successfully")

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

    _LOGGER.info("=" * 80)
    _LOGGER.info("MEAL PLANNER: async_setup_entry completed successfully!")
    _LOGGER.info("=" * 80)
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



