from homeassistant import config_entries
import voluptuous as vol
from .const import DOMAIN

class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION=1
    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")
        if user_input is not None:
            return self.async_create_entry(title="Basic Meal Planner", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

class OptionsFlowHandler(config_entries.OptionsFlow):
    def __init__(self, entry):
        self.entry=entry
    async def async_step_init(self, user_input=None):
        import voluptuous as vol
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        return self.async_show_form(step_id="init", data_schema=vol.Schema({vol.Optional("add_sidebar", default=True): bool}))

async def async_get_options_flow(config_entry):
    return OptionsFlowHandler(config_entry)
