/**
 * hub_rules: pure rules of the trainer shell (trainer-sets 2.2, 2.3, 2.4): which views a
 * signed-out visitor may open, where the study mode switch sits, and what a tap on the switch
 * does. React free so the rules are testable in node.
 */
import type {StudyMode, TrainerView} from '../types';

/**
 * Views a signed-out visitor may open (2.4): the hub, the Trainers page, the Community Sets list
 * and a shared set's page (read only; its Study and Save buttons ask for a login themselves).
 */
export function isPublicTrainerView(view: TrainerView): boolean {
	return view === 'landing' || view === 'modes' || view === 'community' || view === 'set';
}

/** Text of the sign-in screen for a view that needs an account. */
export function accountRequiredKey(view: TrainerView): string {
	return view === 'sets' || view === 'set-add' ? 'account_required.trainer_sets' : 'account_required.trainer';
}

/**
 * Where the study mode switch is drawn (2.2):
 * - `header`: full switch in the header (desktop: the selector and training).
 * - `row`: full width switch under the header (mobile selector).
 * - `chip`: small chip in the header (mobile training).
 * - null: not drawn here. The set lists have no mode, the set page draws its own next to
 *   "Study", the picker has none.
 */
export type StudySwitchPlacement = 'header' | 'row' | 'chip';

export function studySwitchPlacement(view: TrainerView, mobile: boolean): StudySwitchPlacement | null {
	switch (view) {
		case 'selection':
			return mobile ? 'row' : 'header';
		case 'training':
			return mobile ? 'chip' : 'header';
		default:
			return null;
	}
}

/**
 * What a tap on one side of the switch does (2.3):
 * - `noop`: already in that mode, or the timer is running (the switch is locked then).
 * - `upsell`: Smart Cube is locked for this user; the Pro screen opens and the mode stays.
 * - `switch`: SET_STUDY_MODE.
 */
export type StudySwitchOutcome = 'noop' | 'upsell' | 'switch';

export function studySwitchOutcome(
	current: StudyMode,
	target: StudyMode,
	smartAllowed: boolean,
	timerRunning: boolean
): StudySwitchOutcome {
	if (timerRunning || current === target) return 'noop';
	if (target === 'smart' && !smartAllowed) return 'upsell';
	return 'switch';
}
