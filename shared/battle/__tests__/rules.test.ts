import {
	abandonCooldownSec,
	acceptedScrambleMs,
	addPenalties,
	effectiveTimeMs,
	forfeitWinner,
	inspectionPenalty,
	isOverCutoff,
	isPairRated,
	matchProgress,
	pairKey,
	queueWindow,
	plusTwoCount,
	roundWinner,
	scramblePenalty,
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

	it('scramble: 20 s fine, longer +2', () => {
		expect(scramblePenalty(0)).toBeNull();
		expect(scramblePenalty(20000)).toBeNull();
		expect(scramblePenalty(20001)).toBe('PLUS_TWO');
		expect(scramblePenalty(39000)).toBe('PLUS_TWO');
	});

	it('takes the client scramble time only within 1 s under the server interval', () => {
		// Honest: the server interval also holds the settle delay and the network.
		expect(acceptedScrambleMs(20400, 19800)).toBe(19800);
		// Forged low: no more than the slack is gained.
		expect(acceptedScrambleMs(25000, 3000)).toBe(24000);
		// Claimed longer than the server could have seen: capped at the server interval.
		expect(acceptedScrambleMs(12000, 15000)).toBe(12000);
		// Old client without a measure.
		expect(acceptedScrambleMs(21500, null)).toBe(20500);
		expect(acceptedScrambleMs(400, undefined)).toBe(0);
	});

	it('keeps the heavier of two calls on the same thing', () => {
		expect(worsePenalty(null, null)).toBeNull();
		expect(worsePenalty('PLUS_TWO', null)).toBe('PLUS_TWO');
		expect(worsePenalty('PLUS_TWO', 'PLUS_TWO')).toBe('PLUS_TWO');
		expect(worsePenalty('PLUS_TWO', 'DNF')).toBe('DNF');
	});

	it('stacks penalties from separate causes', () => {
		expect(addPenalties(null, null)).toBeNull();
		expect(addPenalties('PLUS_TWO', null)).toBe('PLUS_TWO');
		expect(addPenalties(null, 'PLUS_TWO')).toBe('PLUS_TWO');
		expect(addPenalties('PLUS_TWO', 'PLUS_TWO')).toBe('PLUS_FOUR');
		expect(addPenalties('PLUS_TWO', 'DNF')).toBe('DNF');
		expect(plusTwoCount('PLUS_FOUR')).toBe(2);
		expect(plusTwoCount('DNF')).toBe(0);
	});

	it('adds the penalty to the time and has no time for DNF', () => {
		expect(effectiveTimeMs({ timeMs: 10000, penalty: null })).toBe(10000);
		expect(effectiveTimeMs({ timeMs: 10000, penalty: 'PLUS_TWO' })).toBe(12000);
		expect(effectiveTimeMs({ timeMs: 10000, penalty: 'PLUS_FOUR' })).toBe(14000);
		expect(effectiveTimeMs({ timeMs: 10000, penalty: 'DNF' })).toBeNull();
		expect(effectiveTimeMs({ timeMs: null, penalty: null })).toBeNull();
	});

	it('applies the 60 s cutoff with the penalties included', () => {
		expect(isOverCutoff(60000, null)).toBe(false);
		expect(isOverCutoff(60001, null)).toBe(true);
		expect(isOverCutoff(59000, 'PLUS_TWO')).toBe(true);
		expect(isOverCutoff(56000, 'PLUS_FOUR')).toBe(false);
		expect(isOverCutoff(56001, 'PLUS_FOUR')).toBe(true);
	});
});

describe('roundWinner', () => {
	it('lower time wins', () => {
		expect(roundWinner({ timeMs: 9000, penalty: null }, { timeMs: 9500, penalty: null })).toBe('A');
		expect(roundWinner({ timeMs: 9900, penalty: null }, { timeMs: 9500, penalty: null })).toBe('B');
	});

	it('compares times with penalties', () => {
		expect(roundWinner({ timeMs: 9000, penalty: 'PLUS_TWO' }, { timeMs: 10500, penalty: null })).toBe('B');
		expect(roundWinner({ timeMs: 9000, penalty: 'PLUS_FOUR' }, { timeMs: 12500, penalty: null })).toBe('B');
		expect(roundWinner({ timeMs: 9000, penalty: 'PLUS_FOUR' }, { timeMs: 10500, penalty: 'PLUS_TWO' })).toBe('B');
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
	it('three round wins take the match', () => {
		expect(matchProgress(['A', 'A'])).toMatchObject({ finished: false, score: { a: 2, b: 0 } });
		expect(matchProgress(['A', 'A', 'A'])).toMatchObject({ finished: true, winner: 'A', score: { a: 3, b: 0 } });
		expect(matchProgress(['A', 'B', 'B', 'A', 'B'])).toMatchObject({ finished: true, winner: 'B', score: { a: 2, b: 3 } });
	});

	it('drawn rounds are replayed and do not score', () => {
		expect(matchProgress(['DRAW', 'A', 'DRAW', 'A'])).toMatchObject({ finished: false, roundsPlayed: 4, score: { a: 2, b: 0 } });
		expect(matchProgress(['DRAW', 'A', 'DRAW', 'A', 'A'])).toMatchObject({ finished: true, winner: 'A' });
	});

	it('seven rounds without a third win end in a draw', () => {
		expect(matchProgress(Array(7).fill('DRAW'))).toMatchObject({ finished: true, winner: 'DRAW', roundsPlayed: 7 });
		expect(matchProgress(['A', 'B', 'A', 'B', 'DRAW', 'DRAW', 'DRAW'])).toMatchObject({ finished: true, winner: 'DRAW' });
		expect(matchProgress(['A', 'A', 'DRAW', 'DRAW', 'DRAW', 'DRAW', 'DRAW'])).toMatchObject({ finished: true, winner: 'DRAW' });
		expect(matchProgress(['A', 'B', 'A', 'B', 'DRAW', 'DRAW'])).toMatchObject({ finished: false });
	});

	it('ignores rounds after the match ended', () => {
		expect(matchProgress(['A', 'A', 'A', 'B'])).toMatchObject({ roundsPlayed: 3, winner: 'A' });
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
