import {
	abandonCooldownSec,
	effectiveTimeMs,
	forfeitWinner,
	inspectionPenalty,
	isOverCutoff,
	isPairRated,
	matchProgress,
	pairKey,
	queueWindow,
	roundWinner,
	withinQueueWindow,
	worsePenalty,
} from '../rules';

describe('inspection and penalties', () => {
	it('follows WCA inspection: 15 s fine, up to 17 s +2, beyond DNF', () => {
		expect(inspectionPenalty(0)).toBeNull();
		expect(inspectionPenalty(15000)).toBeNull();
		expect(inspectionPenalty(15001)).toBe('PLUS_TWO');
		expect(inspectionPenalty(17000)).toBe('PLUS_TWO');
		expect(inspectionPenalty(17001)).toBe('DNF');
	});

	it('keeps the heavier penalty', () => {
		expect(worsePenalty(null, null)).toBeNull();
		expect(worsePenalty('PLUS_TWO', null)).toBe('PLUS_TWO');
		expect(worsePenalty('PLUS_TWO', 'DNF')).toBe('DNF');
	});

	it('adds 2 s for +2 and has no time for DNF', () => {
		expect(effectiveTimeMs({ timeMs: 10000, penalty: null })).toBe(10000);
		expect(effectiveTimeMs({ timeMs: 10000, penalty: 'PLUS_TWO' })).toBe(12000);
		expect(effectiveTimeMs({ timeMs: 10000, penalty: 'DNF' })).toBeNull();
		expect(effectiveTimeMs({ timeMs: null, penalty: null })).toBeNull();
	});

	it('applies the 120 s cutoff with the +2 included', () => {
		expect(isOverCutoff(120000, null)).toBe(false);
		expect(isOverCutoff(119000, 'PLUS_TWO')).toBe(true);
	});
});

describe('roundWinner', () => {
	it('lower time wins', () => {
		expect(roundWinner({ timeMs: 9000, penalty: null }, { timeMs: 9500, penalty: null })).toBe('A');
		expect(roundWinner({ timeMs: 9900, penalty: null }, { timeMs: 9500, penalty: null })).toBe('B');
	});

	it('compares +2 times', () => {
		expect(roundWinner({ timeMs: 9000, penalty: 'PLUS_TWO' }, { timeMs: 10500, penalty: null })).toBe('B');
	});

	it('DNF loses to any time, two DNFs draw', () => {
		expect(roundWinner({ timeMs: 9000, penalty: 'DNF' }, { timeMs: 100000, penalty: null })).toBe('B');
		expect(roundWinner({ timeMs: 9000, penalty: 'DNF' }, { timeMs: null, penalty: 'DNF' })).toBe('DRAW');
		expect(roundWinner(null, { timeMs: 50000, penalty: null })).toBe('B');
	});

	it('equal to the centisecond is a draw', () => {
		expect(roundWinner({ timeMs: 9001, penalty: null }, { timeMs: 9009, penalty: null })).toBe('DRAW');
		expect(roundWinner({ timeMs: 9009, penalty: null }, { timeMs: 9010, penalty: null })).toBe('A');
	});
});

describe('matchProgress', () => {
	it('two round wins take the match', () => {
		expect(matchProgress(['A', 'A'])).toMatchObject({ finished: true, winner: 'A', score: { a: 2, b: 0 } });
		expect(matchProgress(['A', 'B', 'B'])).toMatchObject({ finished: true, winner: 'B', score: { a: 1, b: 2 } });
	});

	it('drawn rounds are replayed and do not score', () => {
		expect(matchProgress(['DRAW', 'A', 'DRAW'])).toMatchObject({ finished: false, roundsPlayed: 3, score: { a: 1, b: 0 } });
		expect(matchProgress(['DRAW', 'A', 'DRAW', 'A'])).toMatchObject({ finished: true, winner: 'A' });
	});

	it('five rounds without a second win end in a draw', () => {
		expect(matchProgress(['DRAW', 'DRAW', 'DRAW', 'DRAW', 'DRAW'])).toMatchObject({ finished: true, winner: 'DRAW' });
		expect(matchProgress(['A', 'B', 'DRAW', 'DRAW', 'DRAW'])).toMatchObject({ finished: true, winner: 'DRAW' });
		expect(matchProgress(['A', 'DRAW', 'DRAW', 'DRAW', 'DRAW'])).toMatchObject({ finished: true, winner: 'DRAW' });
	});

	it('ignores rounds after the match ended', () => {
		expect(matchProgress(['A', 'A', 'B'])).toMatchObject({ roundsPlayed: 2, winner: 'A' });
	});

	it('is open with no rounds yet', () => {
		expect(matchProgress([])).toMatchObject({ finished: false, winner: null, roundsPlayed: 0 });
	});

	it('a forfeit goes to the other side', () => {
		expect(forfeitWinner('A')).toBe('B');
		expect(forfeitWinner('B')).toBe('A');
	});
});

describe('pair limit and abandons', () => {
	it('rates at most three matches per pair per day', () => {
		expect(isPairRated(0)).toBe(true);
		expect(isPairRated(2)).toBe(true);
		expect(isPairRated(3)).toBe(false);
	});

	it('pair key does not depend on order', () => {
		expect(pairKey('u2', 'u1')).toBe(pairKey('u1', 'u2'));
	});

	it('escalates the queue cooldown 60 / 300 / 900', () => {
		expect(abandonCooldownSec(0)).toBe(0);
		expect(abandonCooldownSec(1)).toBe(60);
		expect(abandonCooldownSec(2)).toBe(300);
		expect(abandonCooldownSec(3)).toBe(900);
		expect(abandonCooldownSec(7)).toBe(900);
	});
});

describe('queue window', () => {
	it('grows 100 + 10 per second and opens fully at 30 s', () => {
		expect(queueWindow(0)).toBe(100);
		expect(queueWindow(20)).toBe(300);
		expect(queueWindow(29)).toBe(390);
		expect(queueWindow(30)).toBeNull();
	});

	it('uses the larger of the two windows', () => {
		// Newcomer (window 100) and someone who waited 25 s (window 350), 300 apart.
		expect(withinQueueWindow(1500, 0, 1800, 25)).toBe(true);
		expect(withinQueueWindow(1500, 0, 1800, 5)).toBe(false);
	});

	it('pairs anyone once one side waited 30 s', () => {
		expect(withinQueueWindow(1200, 31, 2200, 0)).toBe(true);
	});
});
