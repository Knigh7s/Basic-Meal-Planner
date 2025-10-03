from __future__ import annotations

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult
import voluptuous as vol

from .const import DOMAIN

class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None) -> FlowResult:
        # Single instance
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")

        if user_input is not None:
            # Create the entry with empty data; options come from OptionsFlow
            return self.async_create_entry(title="Basic Meal Planner", data={})

        # No fields needed on initial create
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))


class OptionsFlowHandler(config_entries.OptionsFlow):
    def __init__(self, entry: config_entries.ConfigEntry) -> None:
        self.entry = entry

    async def async_step_init(self, user_input=None) -> FlowResult:
        if user_input is not None:
            # Save options
            return self.async_create_entry(title="", data=user_input)

        # Default ON
        schema = vol.Schema({
            vol.Optional("add_sidebar", default=self.entry.options.get("add_sidebar", True)): bool
        })
        return self.async_show_form(step_id="init", data_schema=schema)


async def async_get_options_flow(config_entry):
    return OptionsFlowHandler(config_entry)
