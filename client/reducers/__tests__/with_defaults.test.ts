import {withDefaults} from '../with_defaults';

const initialState = {
	a: 1,
	b: null as string | null,
	list: [] as number[],
};

describe('withDefaults', () => {
	it('returns the same reference when every initial key is present', () => {
		const state = {a: 5, b: 'x', list: [1, 2]};

		expect(withDefaults(state, initialState)).toBe(state);
	});

	it('counts a key holding null or undefined as present', () => {
		const state = {a: 5, b: null, list: undefined};

		expect(withDefaults(state, initialState)).toBe(state);
	});

	it('fills a missing key from the initial state and keeps the rest', () => {
		const state = {a: 5, b: 'x'} as typeof initialState;

		const result = withDefaults(state, initialState);

		expect(result).not.toBe(state);
		expect(result).toEqual({a: 5, b: 'x', list: []});
		// The incoming state is not patched in place.
		expect(state).toEqual({a: 5, b: 'x'});
	});

	it('keeps keys the initial state does not know about', () => {
		const state = {a: 5, extra: true} as any;

		expect(withDefaults(state, initialState)).toEqual({a: 5, b: null, list: [], extra: true});
	});

	it('returns a copy of the initial state for a missing slice', () => {
		const result = withDefaults(null, initialState);

		expect(result).toEqual(initialState);
		expect(result).not.toBe(initialState);
	});

	it('returns the state as-is for an initial state with no keys', () => {
		const state = {anything: 1};

		expect(withDefaults<object>(state, {})).toBe(state);
	});
});
