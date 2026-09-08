/**
 * The timer inputs a solve can be recorded with, mapped to the i18n key for each name.
 *
 * Its own module, with no imports, so the help page can list the inputs without pulling
 * the settings UI and the local settings database into a server-rendered page.
 *
 * Manual entry is deliberately absent: it is a mode you toggle, not a `timer_type`.
 */
export const TIMER_INPUT_TYPE_KEYS = {
	keyboard: 'timer_settings.input_keyboard',
	virtual: 'timer_settings.input_virtual',
	// StackMat and QYtoys are one input: same 1200 Hz protocol on the same audio
	// jack, same stored device id. They were two values that differed only by label.
	stackmat: 'timer_settings.input_wired',
	smart: 'timer_settings.input_smart',
	gantimer: 'timer_settings.input_gantimer',
	qiyitimer: 'timer_settings.input_qiyitimer',
};

/** Every `timer_type` value, in the order the pickers should offer them. */
export const TIMER_INPUT_TYPES = Object.keys(TIMER_INPUT_TYPE_KEYS) as Array<
	keyof typeof TIMER_INPUT_TYPE_KEYS
>;
