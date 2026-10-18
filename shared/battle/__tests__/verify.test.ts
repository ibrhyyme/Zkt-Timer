import {
	checkCubeClock,
	checkInspection,
	checkProgress,
	checkReplay,
	isSuspiciousSpeed,
	movesToSolved,
	replayState,
	scrambleFaceletsMatch,
	verifySolve,
	wallclockVerdict,
} from '../verify';
import { BattleMove } from '../types';
import { startStateFromScramble } from '../../util/solve/start_state';
import { buildSolve, FIXTURE_SCRAMBLE, honestInput, honestProgress } from '../testing/fixtures';

describe('check 1: scramble facelets', () => {
	it('accepts the cube state the scramble produces', () => {
		expect(scrambleFaceletsMatch(FIXTURE_SCRAMBLE, startStateFromScramble(FIXTURE_SCRAMBLE))).toBe(true);
	});

	it('rejects a cube one move off, a solved cube and garbage', () => {
		const offByOne = startStateFromScramble(FIXTURE_SCRAMBLE.replace(/ F'$/, ''));
		expect(scrambleFaceletsMatch(FIXTURE_SCRAMBLE, offByOne)).toBe(false);
		expect(scrambleFaceletsMatch(FIXTURE_SCRAMBLE, startStateFromScramble(''))).toBe(false);
		expect(scrambleFaceletsMatch(FIXTURE_SCRAMBLE, 'nope')).toBe(false);
		expect(scrambleFaceletsMatch(FIXTURE_SCRAMBLE, null)).toBe(false);
	});
});

describe('honest solves', () => {
	it.each(['gan', 'qiyi'] as const)('a clean %s solve passes with no flags', (cube) => {
		const solve = buildSolve({ cube });
		const result = verifySolve(honestInput(solve));
		expect(result.flags).toEqual([]);
		expect(result.penalty).toBeNull();
		expect(result.dnfReason).toBeNull();
		expect(result.timeMs).toBe(solve.timeMs);
		expect(result.serverTimeMs).toBe(solve.timeMs);
		// QiYi truncates its clock (raw / 1.6), so allow a millisecond.
		expect(Math.abs(result.inspectionMs - solve.inspectionMs)).toBeLessThanOrEqual(1);
		// Sanity: a realistic solve, not a fixture that trips the speed check by accident.
		expect(solve.timeMs).toBeGreaterThan(6000);
	});

	it('the fit removes cube clock drift: a fast cube clock still gives the phone-clock time', () => {
		const solve = buildSolve({ drift: 1.002 });
		const cubeSpan = solve.moves[solve.moves.length - 1].c! - solve.moves[0].c!;
		expect(solve.timeMs).toBeLessThan(cubeSpan);
		expect(verifySolve(honestInput(solve)).flags).toEqual([]);
	});

	it('facelets-grace with the final move dropped is valid (replay_gap)', () => {
		const solve = buildSolve();
		const moves = solve.moves.slice(0, -1);
		// The engine ends the solve at the facelets stamp, after the last move it holds,
		// and reports the difference as timeCorrectionMs.
		const fitted = verifySolve(honestInput(solve, { moves, source: 'facelets-grace' })).serverTimeMs;
		const correction = solve.timeMs - fitted + 150;
		const clientTime = fitted + correction;
		const result = verifySolve(
			honestInput(solve, {
				moves,
				source: 'facelets-grace',
				clientTimeMs: clientTime,
				timeCorrectionMs: correction,
				progress: honestProgress(solve.scramble, moves),
			})
		);
		expect(result.dnfReason).toBeNull();
		expect(result.penalty).toBeNull();
		expect(result.flags).toEqual(['replay_gap']);
		expect(result.timeMs).toBe(clientTime);
	});

	// A dropped packet recovered from a GAN Gen4 cube's history arrives without a cube stamp.
	// Measured on real cubes: 1 such move in 83-98, on honest solves. Not worth a flag.
	it('one unstamped move in the middle is valid and not flagged', () => {
		const solve = buildSolve();
		const moves = solve.moves.map((m, i) => (i === 7 ? { ...m, c: null } : m));
		const result = verifySolve(honestInput(solve, { moves }));
		expect(result.dnfReason).toBeNull();
		expect(result.flags).not.toContain('missing_cube_ts');
		expect(result.flags).not.toContain('time_mismatch');
	});

	it('many unstamped moves (over 5 %, under the 20 % DNF line) are valid but flagged', () => {
		const solve = buildSolve();
		const last = solve.moves.length - 1;
		const moves = solve.moves.map((m, i) => (i > 0 && i < last && i % 8 === 0 ? { ...m, c: null } : m));
		const ratio = moves.filter((m) => m.c == null).length / moves.length;
		expect(ratio).toBeGreaterThan(0.05);
		expect(ratio).toBeLessThanOrEqual(0.2);
		const result = verifySolve(honestInput(solve, { moves }));
		expect(result.dnfReason).toBeNull();
		expect(result.flags).toContain('missing_cube_ts');
	});

	it('a solve with timeCorrectionMs added on a recovery path keeps the corrected time', () => {
		const solve = buildSolve();
		const result = verifySolve(
			honestInput(solve, { source: 'facelets-poll', timeCorrectionMs: 640, clientTimeMs: solve.timeMs + 640 })
		);
		expect(result.dnfReason).toBeNull();
		expect(result.flags).toEqual([]);
		expect(result.timeMs).toBe(solve.timeMs + 640);
	});
});

describe('check 2: replay', () => {
	const solve = buildSolve();
	const moves = solve.moves.map((m) => m.t);

	it('measures how far a state is from solved', () => {
		const start = startStateFromScramble(FIXTURE_SCRAMBLE)!;
		expect(movesToSolved(replayState(start, moves)!)).toBe(0);
		expect(movesToSolved(replayState(start, moves.slice(0, -1))!)).toBe(1);
		// The solution ends ... U R' F': two moves short is two face turns, three is too many.
		expect(movesToSolved(replayState(start, moves.slice(0, -2))!)).toBe(2);
		expect(movesToSolved(replayState(start, moves.slice(0, -3))!)).toBeNull();
	});

	it('a tracker solve whose log does not solve the cube is DNF', () => {
		expect(checkReplay(FIXTURE_SCRAMBLE, solve.moves.slice(0, -1), 'tracker').ok).toBe(false);
		const result = verifySolve(honestInput(solve, { moves: solve.moves.slice(0, -1) }));
		expect(result.penalty).toBe('DNF');
		expect(result.dnfReason).toBe('replay_not_solved');
	});

	it('a recovery path more than two moves short is DNF', () => {
		const result = verifySolve(honestInput(solve, { moves: solve.moves.slice(0, -3), source: 'facelets-poll' }));
		expect(result.dnfReason).toBe('replay_not_solved');
	});

	it('a log for a different scramble is DNF', () => {
		const result = verifySolve(honestInput(solve, { scramble: "R U R' U'" }));
		expect(result.dnfReason).toBe('replay_not_solved');
	});
});

describe('check 3: cube clock', () => {
	const solve = buildSolve();

	it('needs stamps on the first and the last move', () => {
		const noFirst = solve.moves.map((m, i) => (i === 0 ? { ...m, c: null } : m));
		const noLast = solve.moves.map((m, i) => (i === solve.moves.length - 1 ? { ...m, c: null } : m));
		expect(checkCubeClock(noFirst).ok).toBe(false);
		expect(checkCubeClock(noLast).ok).toBe(false);
		expect(verifySolve(honestInput(solve, { moves: noFirst })).dnfReason).toBe('no_cube_clock');
	});

	it('allows at most 20% of moves without a stamp', () => {
		const n = solve.moves.length;
		const allowed = Math.floor(n * 0.2);
		const holes = (count: number): BattleMove[] =>
			solve.moves.map((m, i) => (i > 0 && i <= count && i < n - 1 ? { ...m, c: null } : m));
		expect(checkCubeClock(holes(allowed)).ok).toBe(true);
		expect(checkCubeClock(holes(allowed + 1)).ok).toBe(false);
	});

	it('rejects stamps that go backwards', () => {
		const swapped = solve.moves.slice();
		swapped[5] = { ...swapped[5], c: swapped[3].c! - 10 };
		expect(checkCubeClock(swapped).ok).toBe(false);
	});

	it('rejects an empty log', () => {
		expect(checkCubeClock([]).ok).toBe(false);
		expect(verifySolve(honestInput(solve, { moves: [] })).penalty).toBe('DNF');
	});
});

describe('check 4: server time', () => {
	const solve = buildSolve();

	it('a client claiming a faster time than its moves gets the server time and a flag', () => {
		const result = verifySolve(honestInput(solve, { clientTimeMs: solve.timeMs - 2000 }));
		expect(result.flags).toContain('time_mismatch');
		expect(result.timeMs).toBe(solve.timeMs);
	});

	it('tolerates 50 ms', () => {
		const result = verifySolve(honestInput(solve, { clientTimeMs: solve.timeMs - 50 }));
		expect(result.flags).not.toContain('time_mismatch');
		expect(result.timeMs).toBe(solve.timeMs - 50);
	});

	it('caps the tail correction at 1000 ms', () => {
		const result = verifySolve(
			honestInput(solve, { source: 'facelets-grace', timeCorrectionMs: 2500, clientTimeMs: solve.timeMs + 2500 })
		);
		expect(result.flags).toContain('time_mismatch');
		expect(result.timeMs).toBe(solve.timeMs + 1000);
	});

	it('ignores a correction on the clean path', () => {
		const result = verifySolve(honestInput(solve, { timeCorrectionMs: 800, clientTimeMs: solve.timeMs + 800 }));
		expect(result.timeMs).toBe(solve.timeMs);
		expect(result.flags).toContain('time_mismatch');
	});
});

describe('check 5: wall clock', () => {
	const solve = buildSolve();

	it('maps the excess to ok / flag / dnf', () => {
		expect(wallclockVerdict(0)).toBe('ok');
		expect(wallclockVerdict(1000)).toBe('ok');
		expect(wallclockVerdict(1001)).toBe('flag');
		expect(wallclockVerdict(3000)).toBe('flag');
		expect(wallclockVerdict(3001)).toBe('dnf');
	});

	it('a scramble_done held back by 2 s is flagged', () => {
		const result = verifySolve(honestInput(solve, { scrambleDoneServerAt: solve.scrambleDoneServerAt + 2200 }));
		expect(result.flags).toContain('wallclock_short');
		expect(result.dnfReason).toBeNull();
	});

	it('held back by 4 s is DNF', () => {
		const result = verifySolve(honestInput(solve, { scrambleDoneServerAt: solve.scrambleDoneServerAt + 4200 }));
		expect(result.dnfReason).toBe('wallclock');
	});

	it('network delay only makes the interval longer', () => {
		const result = verifySolve(honestInput(solve, { solveDoneServerAt: solve.solveDoneServerAt + 5000 }));
		expect(result.flags).toEqual([]);
	});

	it('is skipped without server arrival times (client preview)', () => {
		const result = verifySolve(honestInput(solve, { scrambleDoneServerAt: null, solveDoneServerAt: null }));
		expect(result.flags).toEqual([]);
	});
});

describe('check 6: inspection', () => {
	it('decides +2 and DNF from the cube clock', () => {
		expect(verifySolve(honestInput(buildSolve({ inspectionMs: 16000 }))).penalty).toBe('PLUS_TWO');
		const dnf = verifySolve(honestInput(buildSolve({ inspectionMs: 18000 })));
		expect(dnf.penalty).toBe('DNF');
		expect(dnf.dnfReason).toBe('inspection');
	});

	it('flags a client inspection that disagrees by more than 300 ms and uses the cube', () => {
		const solve = buildSolve({ inspectionMs: 16500 });
		const result = verifySolve(honestInput(solve, { clientInspectionMs: 14000 }));
		expect(result.flags).toContain('inspection_mismatch');
		expect(result.inspectionMs).toBe(16500);
		expect(result.penalty).toBe('PLUS_TWO');
	});

	it('flags a long pause before the last scramble move', () => {
		const result = verifySolve(honestInput(buildSolve({ scramblePauseMs: 9000 })));
		expect(result.flags).toContain('scramble_pause');
	});

	it('falls back to the client value without a cube stamp for the scramble end', () => {
		const check = checkInspection([null, null], 1000, 7000);
		expect(check).toEqual({ inspectionMs: 7000, verified: false, flags: ['inspection_unverified'] });
	});

	it('does not trust a cube clock that went backwards', () => {
		const check = checkInspection([100, 5000], 4000, 6000);
		expect(check.verified).toBe(false);
		expect(check.flags).toContain('inspection_mismatch');
	});
});

describe('check 7: progress', () => {
	const solve = buildSolve();
	const progress = honestProgress(solve.scramble, solve.moves);

	const at = (step: string) => progress.find((p) => p.step === step)!.atMs;

	it('rebuilds every CFOP step, each one complete no earlier than the one before', () => {
		expect(progress.map((p) => p.step)).toEqual(['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll']);
		for (let i = 1; i < progress.length; i++) {
			expect(progress[i].atMs).toBeGreaterThanOrEqual(progress[i - 1].atMs);
		}
		// The fixture's OLL (Sune) and PLL (T perm) complete well apart.
		expect(at('oll')).toBeGreaterThan(at('f2l_4'));
		expect(at('pll')).toBeGreaterThan(at('oll') + 2000);
		expect(at('pll')).toBe(solve.timeMs);
	});

	it('accepts the honest progress, a partial list and an empty one', () => {
		expect(checkProgress(solve.scramble, solve.moves, progress, solve.timeMs)).toBe(true);
		expect(checkProgress(solve.scramble, solve.moves, progress.slice(0, 3), solve.timeMs)).toBe(true);
		expect(checkProgress(solve.scramble, solve.moves, [], solve.timeMs)).toBe(true);
	});

	it('tolerates live timing up to a second off', () => {
		const shifted = progress.map((p) => ({ ...p, atMs: p.atMs + 400 }));
		expect(checkProgress(solve.scramble, solve.moves, shifted, solve.timeMs)).toBe(true);
	});

	it('flags a step reported long before the log completes it', () => {
		const early = progress.map((p) => (p.step === 'oll' ? { ...p, atMs: at('oll') - 2500 } : p));
		expect(checkProgress(solve.scramble, solve.moves, early, solve.timeMs)).toBe(false);
	});

	it('flags a step the log never reaches, unless on a recovery path', () => {
		const short = solve.moves.slice(0, -2);
		expect(checkProgress(solve.scramble, short, progress, solve.timeMs, 'tracker')).toBe(false);
		expect(checkProgress(solve.scramble, short, progress, solve.timeMs, 'facelets-grace')).toBe(true);
	});

	it('flags steps out of order, unknown or repeated', () => {
		const swapped = progress.map((p) =>
			p.step === 'oll' ? { ...p, atMs: at('pll') } : p.step === 'pll' ? { ...p, atMs: at('oll') } : p
		);
		expect(checkProgress(solve.scramble, solve.moves, swapped, solve.timeMs)).toBe(false);
		expect(checkProgress(solve.scramble, solve.moves, [{ step: 'lse', atMs: 10 }], solve.timeMs)).toBe(false);
		expect(
			checkProgress(
				solve.scramble,
				solve.moves,
				[
					{ step: 'cross', atMs: 10 },
					{ step: 'cross', atMs: 20 },
				],
				solve.timeMs
			)
		).toBe(false);
		const result = verifySolve(honestInput(solve, { progress: [{ step: 'pll', atMs: 100 }, { step: 'cross', atMs: 200 }] }));
		expect(result.flags).toContain('progress_mismatch');
		expect(result.dnfReason).toBeNull();
	});

	it('flags a step reported after the solve ended', () => {
		expect(checkProgress(solve.scramble, solve.moves, [{ step: 'cross', atMs: solve.timeMs + 5000 }], solve.timeMs)).toBe(false);
	});
});

describe('check 8: speed', () => {
	it('flags a sub-5 s solve but keeps the result', () => {
		const solve = buildSolve({ minGapMs: 80, maxGapMs: 120, halfTurnGapMs: 40, inspectionMs: 5000 });
		expect(solve.timeMs).toBeLessThan(5000);
		const result = verifySolve(honestInput(solve));
		expect(result.flags).toContain('suspicious_speed');
		expect(result.dnfReason).toBeNull();
	});

	it('flags many sub-30 ms gaps between different faces', () => {
		const solve = buildSolve();
		let c = solve.moves[0].c!;
		const robot = solve.moves.map((m, i) => {
			if (i > 0) c += i % 2 === 0 ? 20 : 900;
			return { ...m, c };
		});
		expect(isSuspiciousSpeed(20000, robot)).toBe(true);
	});

	it('does not count the two halves of a half turn', () => {
		const solve = buildSolve({ halfTurnGapMs: 15 });
		expect(isSuspiciousSpeed(solve.timeMs, solve.moves)).toBe(false);
	});
});

describe('cutoff and client DNF', () => {
	it('a solve over 120 s is DNF', () => {
		const solve = buildSolve({ minGapMs: 3000, maxGapMs: 4000 });
		expect(solve.timeMs).toBeGreaterThan(120000);
		expect(verifySolve(honestInput(solve)).dnfReason).toBe('cutoff');
	});

	it('the client may always DNF itself', () => {
		const result = verifySolve(honestInput(buildSolve(), { clientPenalty: 'DNF' }));
		expect(result.penalty).toBe('DNF');
		expect(result.dnfReason).toBe('client');
	});

	it('a client +2 stands even when the cube says inspection was fine', () => {
		expect(verifySolve(honestInput(buildSolve(), { clientPenalty: 'PLUS_TWO' })).penalty).toBe('PLUS_TWO');
	});
});
