import { eventAgeMs, eventMonotonicTime, eventWallTime, MAX_EVENT_AGE_MS } from '../event-time';

describe('event time', () => {
	// The performance clock 600 ms behind the wall clock, as on an Android page kept open
	// across a screen lock: timeOrigin + performance.now() = wall - 600.
	const timeOrigin = 1_700_000_000_000;
	const drift = 600;

	function solve(startPerf: number, stopPerf: number, handlerLag: number) {
		const wallAt = (perf: number) => timeOrigin + perf + drift;
		const start = eventWallTime(startPerf, wallAt(startPerf + handlerLag), startPerf + handlerLag);
		const stop = eventWallTime(stopPerf, wallAt(stopPerf + handlerLag), stopPerf + handlerLag);
		return { start, stop, wallAt };
	}

	it('starts the solve on the wall clock despite the drift, so the running digits match', () => {
		const { start, wallAt } = solve(10_000, 17_000, 8);
		// The running display shows Date.now() - start. At the moment of the stop press
		// it must read the real 7 s, not 7.6 s.
		expect(wallAt(17_000) - start).toBe(7000);
	});

	it('records the real duration', () => {
		const { start, stop } = solve(10_000, 17_000, 8);
		expect(stop - start).toBe(7000);
	});

	it('backdates by the input lag', () => {
		expect(eventWallTime(1000, 50_000, 1030)).toBe(50_000 - 30);
		expect(eventMonotonicTime(1000, 1030)).toBe(1000);
	});

	it('never lands after now when the stamp is later than the handler (iOS IPC)', () => {
		expect(eventAgeMs(1050, 1030)).toBe(0);
		expect(eventWallTime(1050, 50_000, 1030)).toBe(50_000);
		expect(eventMonotonicTime(1050, 1030)).toBe(1030);
	});

	it('ignores a stamp on another base or implausibly old', () => {
		// An epoch-based timeStamp from an old WebView.
		expect(eventAgeMs(timeOrigin, 1030)).toBe(0);
		expect(eventAgeMs(0, MAX_EVENT_AGE_MS + 1)).toBe(0);
		expect(eventAgeMs(NaN, 1030)).toBe(0);
	});
});
