// Pure mirror of the conditions under which KeyWatcher refuses to start the timer
// (KeyWatcher.tsx keydownSpace guard and its cube type check), plus the conditions
// that are specific to a sensor that fires without the user touching the screen.
//
// Kept free of store and React imports so the controller tests can table-drive it.

export interface StartGuardInput {
	timerType: string;
	manualEntry: boolean;
	/** Open modal count (general.modals.length). */
	modalCount: number;
	inModal: boolean;
	matchMode: boolean;
	startEnabled: boolean;
	timerDisabled: boolean;
	disabled: boolean;
	editScramble: boolean;
	validCubeType: boolean;
	/** The page is visible (an event queued while backgrounded is never acted on). */
	visible: boolean;
	/** The settings panel is open and running the sensor in test mode. */
	testMode: boolean;
}

export type StartBlockReason =
	| 'timer_type'
	| 'manual_entry'
	| 'modal'
	| 'in_modal'
	| 'match_mode'
	| 'start_disabled'
	| 'timer_disabled'
	| 'disabled'
	| 'edit_scramble'
	| 'cube_type'
	| 'hidden'
	| 'test_mode';

export function startBlockReason(g: StartGuardInput): StartBlockReason | null {
	if (g.testMode) return 'test_mode';
	if (!g.visible) return 'hidden';
	// 'keyboard' is the touch/keyboard timer. Every other type (smart cube, virtual cube,
	// StackMat, GAN, QiYi) owns its own start.
	if (g.timerType !== 'keyboard') return 'timer_type';
	if (g.manualEntry) return 'manual_entry';
	if (g.inModal) return 'in_modal';
	if (g.matchMode) return 'match_mode';
	// Same rule KeyWatcher uses for `solveOpen`.
	if (g.modalCount > 1 || (!g.inModal && g.modalCount > 0)) return 'modal';
	if (!g.startEnabled) return 'start_disabled';
	if (g.timerDisabled) return 'timer_disabled';
	if (g.disabled) return 'disabled';
	if (g.editScramble) return 'edit_scramble';
	if (!g.validCubeType) return 'cube_type';
	return null;
}
