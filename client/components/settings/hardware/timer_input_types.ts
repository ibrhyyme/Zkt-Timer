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
	smart: 'timer_settings.input_smart',
	// Native app only, Pro (timer_type 'magnet').
	magnet: 'timer_settings.input_magnet',
	virtual: 'timer_settings.input_virtual',
	gantimer: 'timer_settings.input_gantimer',
	qiyitimer: 'timer_settings.input_qiyitimer',
	// StackMat and the QiYi wired timer are one engine (timer_type 'stackmat'): same 1200 Hz
	// protocol on the same audio jack, same stored device id. Desktop web lists them as two
	// options (S-1); `wired_timer_brand` only says which one the user picked.
	stackmat: 'timer_settings.input_stackmat',
};

/** Every `timer_type` value, in the owner's order (timer_type_catalog.ts decides per device). */
export const TIMER_INPUT_TYPES = Object.keys(TIMER_INPUT_TYPE_KEYS) as Array<
	keyof typeof TIMER_INPUT_TYPE_KEYS
>;
