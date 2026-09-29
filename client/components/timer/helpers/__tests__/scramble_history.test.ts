import {
	appendScramble,
	canGoPrevious,
	EMPTY_SCRAMBLE_HISTORY,
	hasNextInHistory,
	MAX_HISTORY_BACK_STEPS,
	ScrambleHistory,
} from '../scramble_history';

function build(...scrambles: string[]): ScrambleHistory {
	return scrambles.reduce(appendScramble, EMPTY_SCRAMBLE_HISTORY);
}

describe('appendScramble', () => {
	it('adds each new scramble and points at it', () => {
		expect(build('A', 'B')).toEqual({history: ['A', 'B'], index: 1});
	});

	it('keeps only the newest scrambles Previous can reach', () => {
		const state = build('A', 'B', 'C', 'D', 'E');
		expect(state.history).toEqual(['C', 'D', 'E']);
		expect(state.history.length).toBe(MAX_HISTORY_BACK_STEPS + 1);
		expect(state.index).toBe(2);
	});

	it('does not add the scramble already shown', () => {
		// The other layout mounting after a tablet rotation sees the same scramble again
		const state = build('A', 'B');
		expect(appendScramble(state, 'B')).toBe(state);
	});

	it('does not add the scramble the user navigated back to', () => {
		const back = {...build('A', 'B', 'C'), index: 1};
		expect(appendScramble(back, 'B')).toBe(back);
	});

	it('drops forward history when a new scramble arrives after going back', () => {
		const back = {...build('A', 'B', 'C'), index: 1};
		expect(appendScramble(back, 'D')).toEqual({history: ['A', 'B', 'D'], index: 2});
	});

	it('ignores the empty placeholder shown while a scramble generates', () => {
		const state = build('A');
		expect(appendScramble(state, '')).toBe(state);
	});
});

describe('canGoPrevious', () => {
	it('is false with nothing behind the current scramble', () => {
		expect(canGoPrevious(EMPTY_SCRAMBLE_HISTORY)).toBe(false);
		expect(canGoPrevious(build('A'))).toBe(false);
	});

	it('is true until the oldest kept scramble', () => {
		const state = build('A', 'B', 'C');
		expect(canGoPrevious(state)).toBe(true);
		expect(canGoPrevious({...state, index: 1})).toBe(true);
		expect(canGoPrevious({...state, index: 0})).toBe(false);
	});
});

describe('hasNextInHistory', () => {
	it('steps forward only after going back', () => {
		const state = build('A', 'B', 'C');
		expect(hasNextInHistory(state)).toBe(false);
		expect(hasNextInHistory({...state, index: 1})).toBe(true);
	});
});
