import {
	computeReadiness,
	decideOnLift,
	dwellMsFor,
	isArmed,
	LiftContext,
	ReadinessInput,
} from '../controller';
import { startBlockReason, StartGuardInput } from '../start_guard';
import { ARM_FAR_MS, MAX_ONSET_AGE_MS, MIN_DWELL_MS } from '../config';

const NOW = 1_790_000_100_000;

function liftCtx(over: Partial<LiftContext> = {}): LiftContext {
	return {
		guard: null,
		inspectionEnabled: false,
		inInspection: false,
		dnfTime: false,
		solving: false,
		touchPriming: false,
		now: NOW,
		resumeAt: NOW - 60_000,
		armed: true,
		dwellMs: MIN_DWELL_MS,
		exceptBld: false,
		inspectionStartedAt: null,
		inspectionDelayMs: 15_000,
		...over,
	};
}

// A lift whose plateau rested 1 s and whose onset is 80 ms old (a normal confirmation).
const LIFT = { onset: NOW - 80, nearSince: NOW - 1080 };

describe('decideOnLift', () => {
	it('starts the solve from the backdated onset when idle with inspection off', () => {
		expect(decideOnLift(liftCtx(), LIFT)).toEqual({ kind: 'startTimer', onset: LIFT.onset });
	});

	it('starts inspection when idle with inspection on', () => {
		expect(decideOnLift(liftCtx({ inspectionEnabled: true }), LIFT)).toEqual({ kind: 'startInspection' });
	});

	it('goes straight to a backdated solve on blind subsets with "except BLD"', () => {
		expect(decideOnLift(liftCtx({ inspectionEnabled: true, exceptBld: true }), LIFT)).toEqual({
			kind: 'startTimer',
			onset: LIFT.onset,
		});
	});

	it('starts the solve during inspection without needing the arm rule', () => {
		const c = liftCtx({ inspectionEnabled: true, inInspection: true, armed: false, inspectionStartedAt: NOW - 9000 });
		expect(decideOnLift(c, LIFT)).toEqual({ kind: 'startTimer', onset: LIFT.onset, addTwo: false });
	});

	it('judges +2 by the onset, not by when the confirmation arrived', () => {
		// Onset 14.95 s into inspection: no +2 even though the decision lands after 15 s.
		const before = liftCtx({ inInspection: true, inspectionEnabled: true, inspectionStartedAt: LIFT.onset - 14_950 });
		expect(decideOnLift(before, LIFT)).toMatchObject({ kind: 'startTimer', addTwo: false });

		const after = liftCtx({ inInspection: true, inspectionEnabled: true, inspectionStartedAt: LIFT.onset - 15_000 });
		expect(decideOnLift(after, LIFT)).toMatchObject({ kind: 'startTimer', addTwo: true });
	});

	it('never starts after an inspection DNF', () => {
		const c = liftCtx({ inInspection: true, inspectionEnabled: true, dnfTime: true, inspectionStartedAt: NOW - 17_500 });
		expect(decideOnLift(c, LIFT)).toEqual({ kind: 'none', reason: 'dnf' });
	});

	it.each([
		['solving', { solving: true }],
		['touch_priming', { touchPriming: true }],
		['modal', { guard: 'modal' as const }],
		['test_mode', { guard: 'test_mode' as const }],
		['not_armed', { armed: false }],
	])('does nothing when %s', (reason, over) => {
		expect(decideOnLift(liftCtx(over), LIFT)).toEqual({ kind: 'none', reason });
	});

	it('refuses an onset the touch path would also refuse, or one from before the restart', () => {
		const old = { onset: NOW - MAX_ONSET_AGE_MS - 1, nearSince: NOW - MAX_ONSET_AGE_MS - 2000 };
		expect(decideOnLift(liftCtx(), old)).toEqual({ kind: 'none', reason: 'stale' });
		expect(decideOnLift(liftCtx({ resumeAt: LIFT.onset + 1 }), LIFT)).toEqual({ kind: 'none', reason: 'stale' });
	});

	it('refuses a lift before the rest time was up', () => {
		const quick = { onset: NOW - 80, nearSince: NOW - 80 - MIN_DWELL_MS + 1 };
		expect(decideOnLift(liftCtx(), quick)).toEqual({ kind: 'none', reason: 'not_ready' });
		const withFreeze = liftCtx({ dwellMs: 1000 });
		expect(decideOnLift(withFreeze, { onset: NOW - 80, nearSince: NOW - 900 })).toEqual({ kind: 'none', reason: 'not_ready' });
	});

	it('never starts in the future', () => {
		const future = { onset: NOW + 30, nearSince: NOW - 1000 };
		expect(decideOnLift(liftCtx(), future)).toEqual({ kind: 'startTimer', onset: NOW });
	});
});

describe('computeReadiness', () => {
	function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
		return {
			guard: null,
			inspectionEnabled: false,
			inInspection: false,
			dnfTime: false,
			solving: false,
			touchPriming: false,
			phase: 'near',
			hint: 'none',
			nearSince: NOW - 1000,
			lastT: NOW,
			dwellMs: MIN_DWELL_MS,
			armed: true,
			...over,
		};
	}

	it('is orange while the cube settles and green once the rest time is up', () => {
		expect(computeReadiness(input({ nearSince: NOW - 100 }))).toEqual({ stage: 'dwelling', green: false, orange: true });
		expect(computeReadiness(input())).toEqual({ stage: 'ready_solve', green: true, orange: false });
	});

	it('tells idle-with-inspection apart from ready-to-solve', () => {
		expect(computeReadiness(input({ inspectionEnabled: true })).stage).toBe('ready_inspection');
		expect(computeReadiness(input({ inspectionEnabled: true, inInspection: true, armed: false })).stage).toBe('ready_solve');
	});

	it.each([
		['unsupported', { phase: 'unsupported' as const }],
		['unknown', { phase: 'unknown' as const }],
		['far', { phase: 'far' as const }],
		['closer', { phase: 'far' as const, hint: 'closer' as const }],
		['inspection_waiting', { phase: 'far' as const, inInspection: true }],
		['blocked', { guard: 'edit_scramble' as const }],
		['blocked', { touchPriming: true }],
		['blocked', { inInspection: true, dnfTime: true }],
		['not_armed', { armed: false }],
		['solving', { solving: true }],
	])('shows %s without a colour', (stage, over) => {
		expect(computeReadiness(input(over))).toEqual({ stage, green: false, orange: false });
	});
});

describe('arming and dwell', () => {
	it('needs the cube away for the whole arm window after the last reset', () => {
		const disarmedAt = 1000;
		expect(isArmed(2000, 2000 + ARM_FAR_MS, disarmedAt, ARM_FAR_MS)).toBe(true);
		expect(isArmed(2000, 2000 + ARM_FAR_MS - 1, disarmedAt, ARM_FAR_MS)).toBe(false);
		// Far since before the reset: only the part after the reset counts.
		expect(isArmed(0, disarmedAt + ARM_FAR_MS - 1, disarmedAt, ARM_FAR_MS)).toBe(false);
		expect(isArmed(0, disarmedAt + ARM_FAR_MS, disarmedAt, ARM_FAR_MS)).toBe(true);
		// Placed before the reset: this placement can never arm.
		expect(isArmed(0, disarmedAt - 1, disarmedAt, ARM_FAR_MS)).toBe(false);
		expect(isArmed(null, 10_000, disarmedAt, ARM_FAR_MS)).toBe(false);
	});

	it('uses freeze time as the rest time when it is longer', () => {
		expect(dwellMsFor(0.2, MIN_DWELL_MS)).toBe(MIN_DWELL_MS);
		expect(dwellMsFor(0.8, MIN_DWELL_MS)).toBe(800);
		expect(dwellMsFor(null, MIN_DWELL_MS)).toBe(MIN_DWELL_MS);
		expect(dwellMsFor(0, MIN_DWELL_MS)).toBe(MIN_DWELL_MS);
	});
});

describe('startBlockReason', () => {
	const ok: StartGuardInput = {
		timerType: 'keyboard',
		manualEntry: false,
		modalCount: 0,
		inModal: false,
		matchMode: false,
		startEnabled: true,
		timerDisabled: false,
		disabled: false,
		editScramble: false,
		validCubeType: true,
		visible: true,
		testMode: false,
	};

	it('lets the plain touch timer through', () => {
		expect(startBlockReason(ok)).toBeNull();
	});

	it.each([
		['test_mode', { testMode: true }],
		['hidden', { visible: false }],
		['timer_type', { timerType: 'smart' }],
		['timer_type', { timerType: 'stackmat' }],
		['timer_type', { timerType: 'virtual' }],
		['manual_entry', { manualEntry: true }],
		['in_modal', { inModal: true }],
		['match_mode', { matchMode: true }],
		['modal', { modalCount: 1 }],
		['start_disabled', { startEnabled: false }],
		['timer_disabled', { timerDisabled: true }],
		['disabled', { disabled: true }],
		['edit_scramble', { editScramble: true }],
		['cube_type', { validCubeType: false }],
	])('blocks with %s', (reason, over) => {
		expect(startBlockReason({ ...ok, ...over })).toBe(reason);
	});
});
