import {isTimerLinkConnected, trackTimerLink} from '../timer_link_state';

function fakeConnection() {
	let next: ((event: {state: number}) => void) | null = null;
	return {
		events$: {
			subscribe(fn: (event: {state: number}) => void) {
				next = fn;
				return {
					unsubscribe() {
						next = null;
					},
				};
			},
		},
		emit(state: number) {
			next?.({state});
		},
	};
}

describe('timer link state', () => {
	it('is connected from the moment a connection is tracked until it reports a disconnect', () => {
		const conn = fakeConnection();
		trackTimerLink('gantimer', conn);
		expect(isTimerLinkConnected('gantimer')).toBe(true);

		conn.emit(3);
		expect(isTimerLinkConnected('gantimer')).toBe(true);

		conn.emit(0);
		expect(isTimerLinkConnected('gantimer')).toBe(false);
	});

	it('keeps the two timers apart', () => {
		const conn = fakeConnection();
		trackTimerLink('qiyitimer', conn);
		expect(isTimerLinkConnected('gantimer')).toBe(false);
		expect(isTimerLinkConnected('qiyitimer')).toBe(true);
		conn.emit(0);
	});

	it('a late disconnect from an old connection does not clear a newer one', () => {
		const first = fakeConnection();
		const second = fakeConnection();
		trackTimerLink('gantimer', first);
		trackTimerLink('gantimer', second);

		first.emit(0);
		expect(isTimerLinkConnected('gantimer')).toBe(true);

		second.emit(0);
		expect(isTimerLinkConnected('gantimer')).toBe(false);
	});
});
