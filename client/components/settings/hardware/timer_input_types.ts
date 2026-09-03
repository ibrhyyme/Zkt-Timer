/**
 * The timer inputs a solve can be recorded with, mapped to the i18n key for each name.
 *
 * Its own module, with no imports, so the help page can list the inputs without pulling
 * the settings UI and the local settings database into a server-rendered page.
 * `HardwareSettings` re-exports it, so its existing importers did not have to change.
 *
 * Manual entry is deliberately absent: it is a mode you toggle, not a `timer_type`.
 */
export const TIMER_INPUT_TYPE_KEYS = {
	keyboard: 'timer_settings.input_keyboard',
	stackmat: 'timer_settings.input_stackmat',
	smart: 'timer_settings.input_smart',
	gantimer: 'timer_settings.input_gantimer',
	qiyitimer: 'timer_settings.input_qiyitimer',
	qiyiwired: 'timer_settings.input_qytoys',
};
