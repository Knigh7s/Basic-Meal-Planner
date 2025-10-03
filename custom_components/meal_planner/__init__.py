from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.storage import Store
from homeassistant.helpers.entity_component import EntityComponent
from homeassistant.components.sensor import SensorEntity
from .const import DOMAIN, STORAGE_FILE, STORAGE_DIR, EVENT_UPDATED
from datetime import datetime, timedelta, date
from pathlib import Path
import uuid

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True

class PotentialMealsSensor(SensorEntity):
    _attr_name = "Meal Planner Potential Meals"
    _attr_icon = "mdi:lightbulb-outline"
    _attr_should_poll = False
    def __init__(self, hass, store, data): self.hass=hass; self.store=store; self.data=data; self._attr_unique_id="meal_planner_potential"; self._attr_native_value=0; self._attr_extra_state_attributes={"items":[]}
    async def async_update_from_data(self): self.async_write_ha_state()

class WeeklyMealsSensor(SensorEntity):
    _attr_name = "Meal Planner Weekly View"
    _attr_icon = "mdi:calendar-week"
    _attr_should_poll = False
    def __init__(self, hass, store, data): self.hass=hass; self.store=store; self.data=data; self._attr_unique_id="meal_planner_week"; self._attr_native_value=""; self._attr_extra_state_attributes={"days":{}}
    async def async_update_from_data(self): self.async_write_ha_state()

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = Store(hass, 1, f"{STORAGE_DIR}/{STORAGE_FILE}")
    data = await store.async_load() or {"settings":{"week_start":"Sunday"},"scheduled":[],"library":[]}
    comp = EntityComponent(None, "sensor", hass)
    await comp.async_add_entities([PotentialMealsSensor(hass, store, data), WeeklyMealsSensor(hass, store, data)], True)

    hass.http.register_static_path("/meal-planner", str(Path(__file__).parent / "panel"), True)
    add_sidebar = entry.options.get("add_sidebar", True)
    if add_sidebar:
        try:
            await hass.components.frontend.async_register_built_in_panel(component_name="iframe", sidebar_title="Meal Planner", sidebar_icon="mdi:silverware-fork-knife", frontend_url_path="meal-planner", config={"url":"/meal-planner"}, require_admin=False)
        except Exception:
            pass
    else:
        try:
            await hass.components.frontend.async_remove_panel("meal-planner")
        except Exception:
            pass
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    try:
        await hass.components.frontend.async_remove_panel("meal-planner")
    except Exception:
        pass
    return True
