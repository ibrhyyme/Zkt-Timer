import {judgedOnPhone, resultReadyToNotify} from '../result_notify_ready';

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

describe('judgedOnPhone (owner, 2026-11-15)', () => {
	const round = {liveEntries: [{personLiveId: '12'}, {personLiveId: '30'}]};
	it('a competitor with a phone card: the unofficial push stands in for "your result is in"', () => {
		expect(judgedOnPhone({personLiveId: '12'}, round)).toBe(true);
	});
	it('no card, no live view (desk-only competition, finished round): the old notice', () => {
		expect(judgedOnPhone({personLiveId: '7'}, round)).toBe(false);
		expect(judgedOnPhone({personLiveId: '12'}, {})).toBe(false);
		expect(judgedOnPhone({personLiveId: ''}, round)).toBe(false);
	});
});
