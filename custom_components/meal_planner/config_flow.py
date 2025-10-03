from homeassistant.config_entries import ConfigEntry, ConfigFlow
from homeassistant.data_entry_flow import FlowResult
import voluptuous as vol
from .const import DOMAIN

class MealPlannerConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1
    async def async_step_user(self, user_input=None) -> FlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")
        if user_input is not None:
            return self.async_create_entry(title="Basic Meal Planner", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
