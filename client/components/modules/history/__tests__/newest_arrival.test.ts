import { detectNewestArrival, NewestArrivalState } from '../newest_arrival';

describe('detectNewestArrival', () => {
	it('does not animate on the initial load', () => {
		const { arrivalId, next } = detectNewestArrival(null, 'solve-1', '{}');
		expect(arrivalId).toBeNull();
		expect(next).toEqual({ topId: 'solve-1', filterKey: '{}' });
	});

	it('flags a new solve landing on top under the same filter', () => {
		const prev: NewestArrivalState = { topId: 'solve-1', filterKey: '{}' };
		const { arrivalId, next } = detectNewestArrival(prev, 'solve-2', '{}');
		expect(arrivalId).toBe('solve-2');
		expect(next).toEqual({ topId: 'solve-2', filterKey: '{}' });
	});

	it('does not flag anything when the top id is unchanged', () => {
		const prev: NewestArrivalState = { topId: 'solve-1', filterKey: '{}' };
		const { arrivalId, next } = detectNewestArrival(prev, 'solve-1', '{}');
		expect(arrivalId).toBeNull();
		expect(next).toEqual({ topId: 'solve-1', filterKey: '{}' });
	});

	// A different solve landing "on top" only because a different bucket is now
	// being viewed is not an arrival — it re-baselines silently instead.
	it('re-baselines without animating when the filter changed', () => {
		const prev: NewestArrivalState = { topId: 'solve-1', filterKey: '{"cube_type":"333"}' };
		const { arrivalId, next } = detectNewestArrival(prev, 'solve-9', '{"cube_type":"222"}');
		expect(arrivalId).toBeNull();
		expect(next).toEqual({ topId: 'solve-9', filterKey: '{"cube_type":"222"}' });
	});

	it('does not flag anything once the list becomes empty', () => {
		const prev: NewestArrivalState = { topId: 'solve-1', filterKey: '{}' };
		const { arrivalId, next } = detectNewestArrival(prev, null, '{}');
		expect(arrivalId).toBeNull();
		expect(next).toEqual({ topId: null, filterKey: '{}' });
	});

	// Once a re-render has been read as "nothing new" (e.g. a scroll-triggered
	// re-render with an unchanged list), a later call with the SAME unchanged top id
	// must stay quiet — this is what keeps react-list's scroll recycling from
	// replaying the entrance on a row that scrolls back into view.
	it('stays quiet across repeated calls with an unchanged top id', () => {
		let state: NewestArrivalState | null = null;
		let result = detectNewestArrival(state, 'solve-1', '{}');
		state = result.next;
		expect(result.arrivalId).toBeNull();

		result = detectNewestArrival(state, 'solve-2', '{}');
		state = result.next;
		expect(result.arrivalId).toBe('solve-2');

		// Simulated scroll-triggered re-renders: top id still 'solve-2'.
		result = detectNewestArrival(state, 'solve-2', '{}');
		state = result.next;
		expect(result.arrivalId).toBeNull();

		result = detectNewestArrival(state, 'solve-2', '{}');
		expect(result.arrivalId).toBeNull();
	});
});
