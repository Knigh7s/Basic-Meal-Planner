"""Sensor platform for Meal Planner."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


def _current_week_bounds(today, week_start: str):
    """Get the start and end dates of the current week."""
    day_idx = today.weekday()
    if week_start == "Monday":
        start = today - timedelta(days=day_idx)
        end = start + timedelta(days=6)
    else:  # Sunday
        days_since_sunday = (day_idx + 1) % 7
        start = today - timedelta(days=days_since_sunday)
        end = start + timedelta(days=6)
    return start, end


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Meal Planner sensors."""
    store = hass.data[DOMAIN]["store"]
    data = hass.data[DOMAIN]["data"]

    sensors = [
        PotentialMealsSensor(hass, store, data, entry.entry_id),
        WeeklyMealsSensor(hass, store, data, entry.entry_id),
    ]

    async_add_entities(sensors, True)

    # Store references for updates
    hass.data[DOMAIN]["sensors"] = {
        "potential": sensors[0],
        "week": sensors[1],
    }


class PotentialMealsSensor(SensorEntity):
    """Sensor for potential meals."""

    _attr_has_entity_name = False
    _attr_name = "Meal Planner Potential"
    _attr_icon = "mdi:lightbulb-outline"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, store: Store, data: dict, entry_id: str):
        """Initialize the sensor."""
        self.hass = hass
        self.store = store
        self.data = data
        self._attr_unique_id = f"{entry_id}_meal_planner_potential"
        self._attr_suggested_object_id = "meal_planner_potential"
        self._recalc()

    def _recalc(self) -> None:
        """Recalculate sensor state and attributes."""
        # Build library lookup
        library_map = {lib.get("id"): lib for lib in self.data.get("library", [])}

        # Get potential meal names
        items = []
        for m in self.data.get("scheduled", []):
            if m.get("potential") == True:
                library_entry = library_map.get(m.get("library_id"))
                if library_entry:
                    name = library_entry.get("name", "")
                    if name:
                        items.append(name)

        self._attr_native_value = len(items)
        self._attr_extra_state_attributes = {
            "items": sorted(items, key=lambda s: s.lower())
        }

    async def async_update_from_data(self) -> None:
        """Update sensor from data changes."""
        self._recalc()
        self.async_write_ha_state()


class WeeklyMealsSensor(SensorEntity):
    """Sensor for weekly meals."""

    _attr_has_entity_name = False
    _attr_name = "Meal Planner Week"
    _attr_icon = "mdi:calendar-week"
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, store: Store, data: dict, entry_id: str):
        """Initialize the sensor."""
        self.hass = hass
        self.store = store
        self.data = data
        self._attr_unique_id = f"{entry_id}_meal_planner_week"
        self._attr_suggested_object_id = "meal_planner_week"
        self._recalc()

    def _recalc(self) -> None:
        """Recalculate sensor state and attributes."""
        today = datetime.now().date()
        days_after = self.data.get("settings", {}).get("days_after_today", 3)

        # Calculate days before to maintain 7 day total
        # Cap days_after at 6 to prevent exceeding 7 total
        days_after = min(days_after, 6)
        days_before = 6 - days_after
        total_days = 7  # Always 7 days

        start = today - timedelta(days=days_before)
        end = today + timedelta(days=days_after)

        # Build library lookup
        library_map = {lib.get("id"): lib for lib in self.data.get("library", [])}

        # Build grid for rolling days
        grid = {}
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

        for i in range(total_days):
            day_date = start + timedelta(days=i)
            day_key = f"day{i}"
            day_name = day_names[day_date.weekday()]

            grid[day_key] = {
                "label": f"{day_name} {day_date.day}",
                "date": day_date.isoformat(),
                "breakfast": "",
                "lunch": "",
                "dinner": "",
                "snack": ""
            }

        # Populate meals
        for m in self.data.get("scheduled", []):
            ds = (m.get("date") or "").strip()
            if not ds:
                continue
            try:
                d = datetime.strptime(ds, "%Y-%m-%d").date()
            except Exception:
                continue

            if start <= d <= end:
                # Find which day index this is
                days_diff = (d - start).days
                if 0 <= days_diff < total_days:
                    day_key = f"day{days_diff}"
                    slot = (m.get("meal_time") or "Dinner").strip().lower()
                    if slot in ("breakfast", "lunch", "dinner", "snack"):
                        # Look up meal name from library
                        library_entry = library_map.get(m.get("library_id"))
                        if library_entry:
                            grid[day_key][slot] = library_entry.get("name", "")

        self._attr_native_value = f"{start.isoformat()} to {end.isoformat()}"
        self._attr_extra_state_attributes = {
            "days_after_today": days_after,
            "days_before_today": days_before,
            "total_days": total_days,
            "today_index": days_before,  # today is at index = days_before
            "start": start.isoformat(),
            "end": end.isoformat(),
            "days": grid,
        }

    async def async_update_from_data(self) -> None:
        """Update sensor from data changes."""
        self._recalc()
        self.async_write_ha_state()
