from __future__ import annotations

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
import voluptuous as vol

from .const import DOMAIN

class MealPlannerConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")
        if user_input is not None:
            return self.async_create_entry(title="Basic Meal Planner", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

    @staticmethod
    def async_get_options_flow(config_entry: ConfigEntry) -> MealPlannerOptionsFlow:
        return MealPlannerOptionsFlow()

class MealPlannerOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input=None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        schema = vol.Schema({
            vol.Optional(
                "add_sidebar",
                default=self.config_entry.options.get("add_sidebar", True)
            ): bool
        })
        return self.async_show_form(step_id="init", data_schema=schema)
