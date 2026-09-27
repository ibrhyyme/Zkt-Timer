/**
 * smartPickUpTime: from the timer start to the first turn of the solve.
 *
 * When the cube starts the timer, the move that started it is stamped with the start
 * itself, so there is no pick-up: it stays 0. When the keyboard starts it
 * (use_space_with_smart_cube) the stream still holds the scramble turns, and the old
 * "stream is empty" test meant the pick-up was never recorded at all.
 */

import timer from '../timer';

const START = 50_000;

function running(smartTurns: any[]) {
	const initial = timer(undefined, { type: '@@INIT' });
	return { ...initial, timeStartedAt: new Date(START), smartTurns, smartPickUpTime: 0 };
}

function batch(state: any, completedAt: number) {
	return timer(state, {
		type: 'TURN_SMART_CUBE_BATCH',
		payload: { moves: [{ turn: 'R', completedAt }], facelets: null },
	});
}

describe('smartPickUpTime', () => {
	it('stays 0 when the cube started the timer (its move carries the start stamp)', () => {
		const state = running([{ turn: 'U', completedAt: START }]);
		expect(batch(state, START + 400).smartPickUpTime).toBe(0);
	});

	it('is recorded for a keyboard start, with the scramble turns still in the stream', () => {
		const state = running([
			{ turn: 'R', completedAt: START - 8_000 },
			{ turn: 'U', completedAt: START - 7_000 },
		]);
		expect(batch(state, START + 650).smartPickUpTime).toBe(0.65);
	});

	it('is taken once, from the first turn after the start', () => {
		let state: any = running([{ turn: 'R', completedAt: START - 8_000 }]);
		state = batch(state, START + 650);
		state = batch(state, START + 1_900);
		expect(state.smartPickUpTime).toBe(0.65);
	});
});
