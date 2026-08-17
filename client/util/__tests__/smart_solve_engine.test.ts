import { SmartSolveEngine, SmartEngineEvent, computeTargetFacelets } from '../smart_cube';
import { DEFAULT_SOLVED_STATE } from '../smart_cube/facelets';
import { SmartTurn } from '../smart_scramble';
import Cube from 'cubejs';

const SCRAMBLE = 'R U F';

/** A turn as the BLE layer produces it: the cube's clock, not the browser's. */
function turn(move: string, at: number): SmartTurn {
	return { turn: move, completedAt: at, cubeTimestamp: at, localTimestamp: at } as any;
}

/** Facelets the cube would report after applying `moves` to a solved cube. */
function faceletsAfter(moves: string[]): string {
	const cube = new Cube();
	for (const m of moves) cube.move(m);
	return cube.asString();
}

/** Engines own real timers (grace commit, poll backstop); every one is disposed in afterEach. */
const liveEngines: SmartSolveEngine[] = [];

afterEach(() => {
	while (liveEngines.length) liveEngines.pop()!.dispose();
});

function harness(options?: ConstructorParameters<typeof SmartSolveEngine>[1]) {
	const events: SmartEngineEvent[] = [];
	const engine = new SmartSolveEngine((e) => events.push(e), options);
	liveEngines.push(engine);
	const of = <T extends SmartEngineEvent['type']>(type: T) =>
		events.filter((e) => e.type === type) as Extract<SmartEngineEvent, { type: T }>[];
	return { engine, events, of };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SmartSolveEngine — scramble phase', () => {
	it('completes the scramble once the moves match and the tracker agrees', () => {
		const { engine, of } = harness();
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);

		engine.pushTurns([turn('R', 1000), turn('U', 1100), turn('F', 1200)]);

		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(1);
		expect(of('SCRAMBLE_COMPLETE')[0].source).toBe('matcher');
		expect(engine.isReady).toBe(true);
	});

	it('completes from facelets when a move packet is lost', () => {
		const { engine, of } = harness();
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);

		// The middle move never reaches us, so the matcher can never succeed.
		engine.pushTurns([turn('R', 1000), turn('F', 1200)]);
		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(0);

		engine.pushFacelets(computeTargetFacelets(SCRAMBLE)!);

		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(1);
		expect(of('SCRAMBLE_COMPLETE')[0].source).toBe('facelets');
	});

	// The bug users hit in rooms: a wrong move produced a correction hint that kept
	// repeating after the correction was made, because the hint was recomputed from a
	// positional diff instead of the cumulative move stream.
	it('clears the correction hint once the wrong move is undone', () => {
		const { engine, of } = harness();
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);

		engine.pushTurns([turn('R', 1000), turn('D2', 1100)]);

		const hints = of('UNDO_MOVES');
		expect(hints[hints.length - 1].moves).toEqual(['D2']);

		// User performs the suggested correction.
		engine.pushTurns([turn('R', 1000), turn('D2', 1100), turn('D2', 1200)]);

		const afterFix = of('UNDO_MOVES');
		expect(afterFix[afterFix.length - 1].moves).toBeNull();
	});

	it('asks the user to solve the cube when too many wrong moves pile up', () => {
		const { engine, of } = harness();
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);

		const wrong = ['D', 'B', 'L', 'D', 'B', 'L', 'D', 'B'];
		engine.pushTurns(wrong.map((m, i) => turn(m, 1000 + i * 10)));

		const hints = of('UNDO_MOVES');
		expect(hints[hints.length - 1].moves).toEqual(['TOO_MANY']);
	});
});

describe('SmartSolveEngine — timer start', () => {
	it('starts on the first solve move and stamps it with the cube clock', () => {
		const { engine, of } = harness();
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);
		engine.pushTurns([turn('R', 1000), turn('U', 1100), turn('F', 1200)]);

		const scrambleEnd = of('SCRAMBLE_COMPLETE')[0].at;
		const firstSolveMove = scrambleEnd + 2000;
		engine.pushTurns([turn('R', 1000), turn('U', 1100), turn('F', 1200), turn('L', firstSolveMove)]);

		const starts = of('TIMER_START');
		expect(starts).toHaveLength(1);
		expect(starts[0].startedAt).toBe(firstSolveMove);
		expect(starts[0].inspectionMs).toBe(2000);
		expect(engine.isTiming).toBe(true);
	});

	// Measured on a GAN 12 UI: the last scramble move can arrive after a facelets packet
	// already completed the scramble, and it used to start the timer seconds early.
	it('drops a queued scramble move instead of starting the timer', () => {
		const { engine, of } = harness();
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);

		engine.pushTurns([turn('R', 1000), turn('U', 1100)]);
		engine.pushFacelets(computeTargetFacelets(SCRAMBLE)!);
		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(1);

		// The queued 'F' lands with a timestamp from before the scramble was declared done.
		const scrambleEnd = of('SCRAMBLE_COMPLETE')[0].at;
		engine.pushTurns([turn('R', 1000), turn('U', 1100), turn('F', scrambleEnd - 100)]);

		expect(of('TIMER_START')).toHaveLength(0);
		expect(of('LATE_SCRAMBLE_MOVE')).toHaveLength(1);
	});
});

describe('SmartSolveEngine — solve detection', () => {
	function scrambleAndStart(engine: SmartSolveEngine, events: SmartEngineEvent[]) {
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);
		engine.pushTurns([turn('R', 1000), turn('U', 1100), turn('F', 1200)]);
		const scrambleEnd = (events.find((e) => e.type === 'SCRAMBLE_COMPLETE') as any).at;
		const start = scrambleEnd + 1000;
		// Solving R U F means undoing it: F' U' R'
		engine.pushTurns([turn('R', 1000), turn('U', 1100), turn('F', 1200), turn("F'", start)]);
		return start;
	}

	it('commits when the tracker reaches the solved state', () => {
		const { engine, events, of } = harness();
		const start = scrambleAndStart(engine, events);

		engine.pushTurns([
			turn('R', 1000), turn('U', 1100), turn('F', 1200),
			turn("F'", start), turn("U'", start + 3000), turn("R'", start + 6000),
		]);

		const done = of('SOLVE_COMPLETE');
		expect(done).toHaveLength(1);
		expect(done[0].result.source).toBe('tracker');
		expect(done[0].result.turnCount).toBe(3);
		// End stamp comes from the final move, not from when detection happened.
		expect(done[0].result.endedAt).toBe(start + 6000);
		expect(done[0].result.timeMs).toBe(6000);
	});

	// The "timer never stopped" report from rooms: a dropped move packet leaves the
	// tracker short of solved forever, so facelets has to be able to finish the solve.
	// Jest's fake timers cannot install on this Node version (`performance` is read-only),
	// so the timing windows are shortened instead and the test waits for real time.
	it('commits from facelets after the grace window when a move is lost', async () => {
		const { engine, events, of } = harness({ graceMs: 40, pollMs: 10_000 });
		const start = scrambleAndStart(engine, events);

		// The final R' never arrives as a move, only as a facelets update.
		engine.pushTurns([
			turn('R', 1000), turn('U', 1100), turn('F', 1200),
			turn("F'", start), turn("U'", start + 3000),
		]);
		engine.pushFacelets(DEFAULT_SOLVED_STATE);

		expect(of('SOLVE_COMPLETE')).toHaveLength(0);
		await wait(120);

		const done = of('SOLVE_COMPLETE');
		expect(done).toHaveLength(1);
		expect(done[0].result.source).toBe('facelets-grace');
	});

	it('polls as a backstop for cubes that do not re-send facelets', async () => {
		// Grace is disabled by making it longer than the wait, leaving the poll as the
		// only path that can finish this solve.
		const { engine, events, of } = harness({ graceMs: 10_000, pollMs: 40 });
		const start = scrambleAndStart(engine, events);
		expect(engine.isTiming).toBe(true);

		engine.pushFacelets(DEFAULT_SOLVED_STATE);
		await wait(120);

		const done = of('SOLVE_COMPLETE');
		expect(done).toHaveLength(1);
		expect(done[0].result.source).toBe('facelets-poll');
		expect(start).toBeGreaterThan(0);
	});

	// Root cause of the 1.68s phantom solve on 2026-08-14: the tracker was never anchored
	// to the physical cube, so a cancelling pair looked like a finished solve.
	it('does not invent a solve when a reconnected cube is already scrambled', () => {
		const { engine, of } = harness();
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);

		// Cube was scrambled while disconnected; the first packet after reconnect is facelets.
		engine.pushFacelets(computeTargetFacelets(SCRAMBLE)!);
		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(1);

		const scrambleEnd = of('SCRAMBLE_COMPLETE')[0].at;
		// A cancelling pair must not read as a solve.
		engine.pushTurns([turn('R', scrambleEnd + 1000)]);
		engine.pushTurns([turn('R', scrambleEnd + 1000), turn("R'", scrambleEnd + 1100)]);

		expect(of('SOLVE_COMPLETE')).toHaveLength(0);
	});

	// The timer clears its turn stream the moment a scramble completes. The tracker must
	// come back on the scramble target, not on the displayed scramble — on the correction
	// path those are different, and rebuilding from the displayed one desynced the solve.
	it('keeps the tracker on target when the caller clears the stream', () => {
		const { engine, of } = harness();
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);
		engine.pushTurns([turn('R', 1000), turn('U', 1100), turn('F', 1200)]);
		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(1);

		engine.pushTurns([]);
		expect(engine.trackerState).toBe(computeTargetFacelets(SCRAMBLE));

		// A cancelling pair after the reset must still not read as a solve.
		const scrambleEnd = of('SCRAMBLE_COMPLETE')[0].at;
		engine.pushTurns([turn('L', scrambleEnd + 1000)]);
		engine.pushTurns([turn('L', scrambleEnd + 1000), turn("L'", scrambleEnd + 1100)]);
		expect(of('SOLVE_COMPLETE')).toHaveLength(0);
	});

	// Reported from the timer page: right after a solve the cube sat physically solved, but
	// the fresh scramble showed its first move already "half done". A stray turn arriving
	// after the solve had stayed in the matcher.
	it('drops stray moves once the cube reports solved again', () => {
		const { engine, of } = harness();
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);
		engine.pushFacelets(DEFAULT_SOLVED_STATE);

		// A single turn lands, then the cube reports itself solved anyway (the turn never
		// really happened, or was undone before the packet arrived).
		engine.pushTurns([turn('D', 1000)]);
		expect(engine.scrambleProgress).toEqual(['D']);

		engine.pushFacelets(DEFAULT_SOLVED_STATE);

		expect(engine.scrambleProgress).toEqual([]);
		const progress = of('SCRAMBLE_PROGRESS');
		expect(progress[progress.length - 1].matchStatus).toEqual([]);
	});

	it('flags out-of-sync once the cube stays in an unrecognisable state', async () => {
		const { engine, of } = harness({ outOfSyncDelayMs: 30 });
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);

		// Cube reports a state that matches neither solved nor the scramble target.
		engine.pushFacelets(faceletsAfter(['R', 'U', 'F', 'L', 'D']));

		// Not raised immediately: mid-turn states look exactly like this.
		expect(of('OUT_OF_SYNC')).toHaveLength(0);

		await wait(80);
		expect(of('OUT_OF_SYNC').slice(-1)[0].out).toBe(true);
	});

	// The warning used to flash on and off while the user was simply turning the cube.
	it('does not flash the warning for a state the cube passes through', async () => {
		const { engine, of } = harness({ outOfSyncDelayMs: 60 });
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);

		engine.pushFacelets(faceletsAfter(['R', 'U', 'F', 'L', 'D']));
		// Cube reaches a state we recognise before the delay elapses.
		engine.pushFacelets(DEFAULT_SOLVED_STATE);

		await wait(120);
		expect(of('OUT_OF_SYNC')).toHaveLength(0);
	});

	it('clears out-of-sync immediately once the cube is solved again', async () => {
		const { engine, of } = harness({ outOfSyncDelayMs: 20 });
		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);

		engine.pushFacelets(faceletsAfter(['R', 'U', 'F', 'L', 'D']));
		await wait(60);
		expect(of('OUT_OF_SYNC').slice(-1)[0].out).toBe(true);

		// Recovery is not delayed — the user should see the warning go at once.
		engine.pushFacelets(DEFAULT_SOLVED_STATE);
		expect(of('OUT_OF_SYNC').slice(-1)[0].out).toBe(false);
	});
});
