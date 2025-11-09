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
        items = [
            (m.get("name") or "")
            for m in self.data.get("scheduled", [])
            if m.get("potential") == True
        ]
        items = [i for i in items if i]
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
        week_start = self.data.get("settings", {}).get("week_start", "Sunday")
        start, end = _current_week_bounds(today, week_start)

        days_order = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        day_labels = {
            "sun": "Sun", "mon": "Mon", "tue": "Tue", "wed": "Wed",
            "thu": "Thu", "fri": "Fri", "sat": "Sat",
        }
        grid = {
            k: {"label": day_labels[k], "breakfast": "", "lunch": "", "dinner": "", "snack": "", "date": ""}
            for k in days_order
        }

        # Add date numbers to labels
        for i, day_key in enumerate(days_order):
            day_date = start + timedelta(days=i)
            grid[day_key]["label"] = f"{day_labels[day_key]} {day_date.day}"
            grid[day_key]["date"] = day_date.isoformat()

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
        """Update sensor from data changes."""
        self._recalc()
        self.async_write_ha_state()
