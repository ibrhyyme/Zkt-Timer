import {resultReadyToNotify} from '../result_notify_ready';

const att = (...values: number[]) => values.map((result) => ({result}));
const live = {finished: false, numberOfAttempts: 5};

describe('"your result is in" waits for a full ZKT card (phone times land attempt by attempt, 2026-11-14)', () => {
	it('a ZKT result with some attempts in waits', () => {
		expect(resultReadyToNotify({best: 1000, attempts: att(1000, 0, 0, 0, 0)}, live, true)).toBe(false);
		expect(resultReadyToNotify({best: 1000, attempts: att(1000, 1100)}, live, true)).toBe(false);
	});

	it('goes once the card is full, or the round finished (a missed cutoff never fills it)', () => {
		expect(resultReadyToNotify({best: 900, attempts: att(1000, 1100, 900, -1, 1200)}, live, true)).toBe(true);
		expect(resultReadyToNotify({best: 4000, attempts: att(4000, 4100, 0, 0, 0)}, {...live, finished: true}, true)).toBe(true);
	});

	it('WCA keeps the first result with a best', () => {
		expect(resultReadyToNotify({best: 1000, attempts: att(1000, 0, 0, 0, 0)}, live, false)).toBe(true);
	});

	it('never for a result without a best (all DNF / DNS, or nothing)', () => {
		expect(resultReadyToNotify({best: -1, attempts: att(-1, -1, -1, -1, -1)}, live, true)).toBe(false);
		expect(resultReadyToNotify({best: 0, attempts: []}, {...live, finished: true}, false)).toBe(false);
	});
});
