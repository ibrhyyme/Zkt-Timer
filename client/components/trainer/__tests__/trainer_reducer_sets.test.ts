/**
 * Trainer reducer: set study, the study mode switch and `category::name` card identity
 * (trainer-sets 2.3, 6.1, 6.2, 6.5).
 */
jest.mock('../hooks/useAlgorithmData', () => ({
	getBestTime: () => null,
	getFailCount: () => 0,
}));

import {createTrainerState, trainerReducer} from '../trainer_reducer';
import {DEFAULT_TRAINER_OPTIONS} from '../../../util/trainer/trainer_options_sync';
import {checkedKey, filterForMode, setRowsToChecked, type SetStudyRow} from '../../../util/trainer/set_queue';
import type {CheckedAlgorithm, StartSetStudyPayload, TrainerAction, TrainerSessionState} from '../types';

const Y_PERM = "F (R U' R' U') (R U R' F') (R U R' U') (R' F R F')";

const ROWS: SetStudyRow[] = [
	{category: 'PLL', case_name: 'Y perm', subset: 'Diag corners', algorithm: Y_PERM, position: 0},
	{category: '2x2 CLL', case_name: 'CLL AS 1', subset: 'Antisune', algorithm: "U R U2 R' U' R U' R'", position: 1},
	{category: '2-Look PLL', case_name: 'No Matching (aka No Headlights)', subset: 'Corners', algorithm: Y_PERM, position: 2},
	{category: 'Pyraminx L4E', case_name: 'Sune', subset: 'Default', algorithm: "(R U R') U (R U R')", position: 3},
];

const CARDS = setRowsToChecked(ROWS);

const SET = {id: 'set-1', code: 'AbCdEfGhIj', name: 'Karışık', owner_name: 'owner', is_owner: true};

const PAYLOAD: StartSetStudyPayload = {set: SET, items: CARDS};

// Deterministic queue: set order, no sorting.
const OPTIONS = {...DEFAULT_TRAINER_OPTIONS, randomOrder: false, prioritizeSlow: false, prioritizeFailed: false};

function base(mode: 'standard' | 'smart' = 'standard'): TrainerSessionState {
	return createTrainerState(OPTIONS, {mode, view: 'selection'});
}

function run(state: TrainerSessionState, ...actions: TrainerAction[]): TrainerSessionState {
	return actions.reduce(trainerReducer, state);
}

const keys = (cards: CheckedAlgorithm[]) => cards.map(checkedKey);

describe('START_SET_STUDY', () => {
	it('opens the training view with the whole set in set order (Standard)', () => {
		const s = run(base(), {type: 'START_SET_STUDY', payload: PAYLOAD});
		expect(s.view).toBe('training');
		expect(s.activeSet).toEqual({...SET, items: CARDS});
		expect(keys(s.checkedAlgorithms)).toEqual(keys(CARDS));
		expect(keys(s.algorithmQueue)).toEqual(keys(CARDS));
		expect(s.currentAlgorithm && checkedKey(s.currentAlgorithm)).toBe(checkedKey(CARDS[0]));
		// A set study has no selector category; the toolbar reads the card's own category.
		expect(s.selectedCategory).toBe('');
		expect(s.pendingSetCode).toBeNull();
	});

	it('queues only the 3x3 rows in Smart Cube mode, but keeps every row in activeSet', () => {
		const s = run(base('smart'), {type: 'START_SET_STUDY', payload: PAYLOAD});
		expect(s.checkedAlgorithms.map((c) => c.category)).toEqual(['PLL', '2-Look PLL']);
		expect(s.activeSet?.items).toHaveLength(4);
	});

	it('replaces a selector selection and a pending set load', () => {
		const selected = run(
			base(),
			{type: 'SET_CATEGORY', payload: 'OLL'},
			{type: 'SET_PENDING_SET', payload: SET.code}
		);
		expect(selected.view).toBe('training');
		expect(selected.pendingSetCode).toBe(SET.code);
		const s = trainerReducer(selected, {type: 'START_SET_STUDY', payload: PAYLOAD});
		expect(s.pendingSetCode).toBeNull();
		expect(s.selectedCategory).toBe('');
		expect(s.checkedAlgorithms).toHaveLength(4);
	});
});

describe('SET_STUDY_MODE', () => {
	it('changes only the mode and remembers it as lastMode', () => {
		const study = run(base(), {type: 'START_SET_STUDY', payload: PAYLOAD});
		const s = trainerReducer(study, {type: 'SET_STUDY_MODE', payload: 'smart'});
		expect(s.mode).toBe('smart');
		expect(s.options.lastMode).toBe('smart');
		expect(s.view).toBe('training');
		// The queue filter is not the reducer's job (TrainerProvider applies filterForMode).
		expect(s.checkedAlgorithms).toBe(study.checkedAlgorithms);
		expect(s.algorithmQueue).toBe(study.algorithmQueue);
		expect(s.currentAlgorithm).toBe(study.currentAlgorithm);
	});

	it('remember=false (a link asked for the mode) leaves lastMode alone', () => {
		const s = trainerReducer(base(), {type: 'SET_STUDY_MODE', payload: 'smart', remember: false});
		expect(s.mode).toBe('smart');
		expect(s.options.lastMode).toBe('standard');
	});

	it('is locked while the timer runs', () => {
		const running = run(base(), {type: 'SET_TIMER_STATE', payload: 'RUNNING'});
		expect(trainerReducer(running, {type: 'SET_STUDY_MODE', payload: 'smart'})).toBe(running);
	});

	it('is a no-op when nothing changes', () => {
		const s = base();
		expect(trainerReducer(s, {type: 'SET_STUDY_MODE', payload: 'standard'})).toBe(s);
	});

	it('does not leave the selection view (unlike SET_MODE)', () => {
		const sets = run(base(), {type: 'SET_VIEW', payload: 'sets'});
		const s = trainerReducer(sets, {type: 'SET_STUDY_MODE', payload: 'smart'});
		expect(s.view).toBe('sets');
	});
});

describe('SET_STUDY_ROWS (mode filter applied by the provider)', () => {
	it('Smart drops the other puzzles and keeps the current 3x3 card', () => {
		const study = run(base(), {type: 'START_SET_STUDY', payload: PAYLOAD});
		const smart = run(study, {type: 'SET_STUDY_MODE', payload: 'smart'});
		const s = trainerReducer(smart, {type: 'SET_STUDY_ROWS', payload: filterForMode(smart.activeSet!.items, 'smart')});
		expect(s.checkedAlgorithms.map((c) => c.category)).toEqual(['PLL', '2-Look PLL']);
		expect(s.currentAlgorithm).toBe(smart.currentAlgorithm);
	});

	it('moves to the first card when the current one is filtered out, and back to Standard restores all', () => {
		const study = run(base(), {type: 'START_SET_STUDY', payload: PAYLOAD}, {type: 'ADVANCE_ALGORITHM'});
		expect(study.currentAlgorithm?.category).toBe('2x2 CLL');
		const smart = run(
			study,
			{type: 'SET_STUDY_MODE', payload: 'smart'},
			{type: 'SET_STUDY_ROWS', payload: filterForMode(CARDS, 'smart')}
		);
		expect(smart.currentAlgorithm?.category).toBe('PLL');
		const back = run(
			smart,
			{type: 'SET_STUDY_MODE', payload: 'standard'},
			{type: 'SET_STUDY_ROWS', payload: filterForMode(CARDS, 'standard')}
		);
		expect(back.checkedAlgorithms).toHaveLength(4);
		expect(back.currentAlgorithm?.category).toBe('PLL');
	});

	it('empty Smart queue: no current card (TrainingArea offers Standard)', () => {
		const onlyOthers: StartSetStudyPayload = {set: SET, items: CARDS.filter((c) => c.category === '2x2 CLL')};
		const s = run(base('smart'), {type: 'START_SET_STUDY', payload: onlyOthers});
		expect(s.checkedAlgorithms).toHaveLength(0);
		expect(s.currentAlgorithm).toBeNull();
		expect(s.activeSet?.items).toHaveLength(1);
	});

	it('does nothing outside a set study', () => {
		const s = base();
		expect(trainerReducer(s, {type: 'SET_STUDY_ROWS', payload: CARDS})).toBe(s);
	});
});

describe('card identity category::name (two cases with the same algorithm text)', () => {
	const pll = CARDS[0];
	const twoLook = CARDS[2];

	it('the fixture really has two cards with one text', () => {
		expect(pll.algorithm).toBe(twoLook.algorithm);
	});

	it('REMOVE_CHECKED_ALGORITHM removes only the card with that key', () => {
		const s = run(base(), {type: 'SET_CHECKED_ALGORITHMS', payload: [pll, twoLook]}, {
			type: 'REMOVE_CHECKED_ALGORITHM',
			payload: checkedKey(pll),
		});
		expect(keys(s.checkedAlgorithms)).toEqual([checkedKey(twoLook)]);
		expect(s.currentAlgorithm && checkedKey(s.currentAlgorithm)).toBe(checkedKey(twoLook));
	});

	it('ADVANCE and PREVIOUS step between them instead of sticking on the first', () => {
		const s = run(base(), {type: 'SET_CHECKED_ALGORITHMS', payload: [pll, twoLook, CARDS[1]]});
		const next = trainerReducer(s, {type: 'ADVANCE_ALGORITHM'});
		expect(next.currentAlgorithm && checkedKey(next.currentAlgorithm)).toBe(checkedKey(twoLook));
		const next2 = trainerReducer(next, {type: 'ADVANCE_ALGORITHM'});
		expect(next2.currentAlgorithm?.category).toBe('2x2 CLL');
		const prev = trainerReducer(next2, {type: 'PREVIOUS_ALGORITHM'});
		expect(prev.currentAlgorithm && checkedKey(prev.currentAlgorithm)).toBe(checkedKey(twoLook));
	});

	it('SWAP_ALGORITHM changes only the current card, in the queue and in the set rows', () => {
		const study = run(base(), {type: 'START_SET_STUDY', payload: PAYLOAD});
		const s = trainerReducer(study, {type: 'SWAP_ALGORITHM', payload: {oldAlg: pll.algorithm, newAlg: "R U R' U'"}});
		expect(s.currentAlgorithm?.algorithm).toBe("R U R' U'");
		const byKey = (cards: CheckedAlgorithm[], card: CheckedAlgorithm) => cards.find((c) => checkedKey(c) === checkedKey(card))!;
		expect(byKey(s.checkedAlgorithms, pll).algorithm).toBe("R U R' U'");
		expect(byKey(s.checkedAlgorithms, twoLook).algorithm).toBe(pll.algorithm);
		expect(byKey(s.activeSet!.items, pll).algorithm).toBe("R U R' U'");
		expect(byKey(s.activeSet!.items, twoLook).algorithm).toBe(pll.algorithm);
	});
});

describe('when a set study ends', () => {
	const study = () => run(base(), {type: 'START_SET_STUDY', payload: PAYLOAD});

	it('leaving training (back to the set page, a tab, the selector) clears it', () => {
		for (const view of ['set', 'sets', 'community', 'selection'] as const) {
			const s = trainerReducer(study(), {type: 'SET_VIEW', payload: view});
			expect([view, s.activeSet, s.checkedAlgorithms.length, s.currentAlgorithm]).toEqual([view, null, 0, null]);
		}
	});

	it('the hub and the Trainers page clear it and the mode', () => {
		for (const view of ['landing', 'modes'] as const) {
			const s = trainerReducer(study(), {type: 'SET_VIEW', payload: view});
			expect([s.view, s.activeSet, s.mode]).toEqual([view, null, null]);
		}
	});

	it('a category change or another entry mode clears it', () => {
		expect(trainerReducer(study(), {type: 'SET_CATEGORY', payload: 'OLL'}).activeSet).toBeNull();
		expect(trainerReducer(study(), {type: 'SET_MODE', payload: 'recognition'}).activeSet).toBeNull();
	});

	it('staying in training keeps it', () => {
		const s = trainerReducer(study(), {type: 'SET_VIEW', payload: 'training'});
		expect(s.activeSet?.code).toBe(SET.code);
	});

	it('moving between the selector and the set tabs keeps what the selector had checked', () => {
		const picked = run(base(), {type: 'SET_CHECKED_ALGORITHMS', payload: [CARDS[0]]});
		const s = run(picked, {type: 'SET_VIEW', payload: 'sets'}, {type: 'SET_VIEW', payload: 'selection'});
		expect(keys(s.checkedAlgorithms)).toEqual([checkedKey(CARDS[0])]);
	});
});

describe('SET_PENDING_SET', () => {
	it('null drops a pending load without touching the view', () => {
		const pending = run(base(), {type: 'SET_PENDING_SET', payload: SET.code});
		const s = trainerReducer(pending, {type: 'SET_PENDING_SET', payload: null});
		expect(s.pendingSetCode).toBeNull();
		expect(s.view).toBe('training');
	});
});
