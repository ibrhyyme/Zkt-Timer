import {accountRequiredKey, isPublicTrainerView, studySwitchOutcome, studySwitchPlacement} from '../hub/hub_rules';
import type {TrainerView} from '../types';

const ALL_VIEWS: TrainerView[] = ['landing', 'modes', 'selection', 'training', 'sets', 'set', 'set-add', 'community'];

describe('signed-out access (2.4)', () => {
	it('opens the hub, the Trainers page, Community Sets and a set page to visitors', () => {
		const open = ALL_VIEWS.filter(isPublicTrainerView);
		expect(open.sort()).toEqual(['community', 'landing', 'modes', 'set']);
	});

	it('explains sets on My Sets and the picker, training elsewhere', () => {
		expect(accountRequiredKey('sets')).toBe('account_required.trainer_sets');
		expect(accountRequiredKey('set-add')).toBe('account_required.trainer_sets');
		expect(accountRequiredKey('selection')).toBe('account_required.trainer');
		expect(accountRequiredKey('training')).toBe('account_required.trainer');
	});
});

describe('study mode switch placement (2.2)', () => {
	it('desktop: in the header on the selector and in training', () => {
		expect(studySwitchPlacement('selection', false)).toBe('header');
		expect(studySwitchPlacement('training', false)).toBe('header');
	});

	it('never on the set lists, they are not part of the Algorithm Trainer', () => {
		for (const mobile of [false, true]) {
			expect(studySwitchPlacement('sets', mobile)).toBeNull();
			expect(studySwitchPlacement('community', mobile)).toBeNull();
		}
	});

	it('mobile: a row on the selector, a chip in training', () => {
		expect(studySwitchPlacement('selection', true)).toBe('row');
		expect(studySwitchPlacement('training', true)).toBe('chip');
	});

	it('never on the set page (it draws its own), the picker, the hub or the Trainers page', () => {
		for (const mobile of [false, true]) {
			expect(studySwitchPlacement('set', mobile)).toBeNull();
			expect(studySwitchPlacement('set-add', mobile)).toBeNull();
			expect(studySwitchPlacement('landing', mobile)).toBeNull();
			expect(studySwitchPlacement('modes', mobile)).toBeNull();
		}
	});
});

describe('study mode switch outcome (2.3)', () => {
	it('switches freely when Smart is allowed', () => {
		expect(studySwitchOutcome('standard', 'smart', true, false)).toBe('switch');
		expect(studySwitchOutcome('smart', 'standard', true, false)).toBe('switch');
	});

	it('opens the Pro screen instead of switching for a Basic user', () => {
		expect(studySwitchOutcome('standard', 'smart', false, false)).toBe('upsell');
	});

	it('always lets a user leave Smart, even when it is locked', () => {
		expect(studySwitchOutcome('smart', 'standard', false, false)).toBe('switch');
	});

	it('does nothing for the current mode or while the timer runs', () => {
		expect(studySwitchOutcome('smart', 'smart', true, false)).toBe('noop');
		expect(studySwitchOutcome('standard', 'standard', false, false)).toBe('noop');
		expect(studySwitchOutcome('standard', 'smart', true, true)).toBe('noop');
		expect(studySwitchOutcome('standard', 'smart', false, true)).toBe('noop');
	});
});
