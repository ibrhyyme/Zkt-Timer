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
		// F' U' R' has no repeated face, so HTM matches the raw count here.
		expect(done[0].result.htmCount).toBe(3);
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
		// Back at the start of the scramble: nothing is marked done.
		expect(progress[progress.length - 1].matchStatus.every((s) => s === 'pending')).toBe(true);
	});

	// Field data (3151 solves over a week) showed recovery-path solves recorded 0.7-3.5s
	// short: the final move's packet was the dropped one, so the last move we held predated
	// the real finish and the time was stamped from it.
	it('times a recovered solve from the facelets stamp, not the last move held', async () => {
		// Timestamps are laid out in the past relative to wall clock, the way a real session
		// looks by the time the engine sees them. maxLateDrops:0 keeps the late-scramble rule
		// from swallowing those turns, since every one of them predates "now".
		const { engine, of } = harness({ graceMs: 40, pollMs: 10_000, maxLateDrops: 0 });
		const now = Date.now();
		const solveStart = now - 8000;

		engine.setScramble(SCRAMBLE);
		engine.setConnected(true);
		const scr = [turn('R', now - 20000), turn('U', now - 19900), turn('F', now - 19800)];
		engine.pushTurns(scr);

		engine.pushTurns([...scr, turn("F'", solveStart)]);
		engine.pushTurns([...scr, turn("F'", solveStart), turn("U'", solveStart + 3000)]);

		// The final R' packet is lost; the cube only tells us it is solved, 5s after the last
		// move we hold.
		engine.pushFacelets(DEFAULT_SOLVED_STATE);
		await wait(120);

		const done = of('SOLVE_COMPLETE');
		expect(done).toHaveLength(1);
		const r = done[0].result;
		expect(r.source).toBe('facelets-grace');

		// Timing from the last held move would report ~3s. The real solve ran ~8s.
		expect(r.endedAt).toBeGreaterThanOrEqual(now);
		expect(r.timeMs).toBeGreaterThanOrEqual(7900);
		expect(r.timeCorrectionMs).toBeGreaterThan(4000);
	});

	it('leaves the clean path untouched', () => {
		const { engine, events, of } = harness();
		const start = scrambleAndStart(engine, events);

		engine.pushTurns([
			turn('R', 1000), turn('U', 1100), turn('F', 1200),
			turn("F'", start), turn("U'", start + 3000), turn("R'", start + 6000),
		]);

		const done = of('SOLVE_COMPLETE')[0].result;
		// Same numbers as before the correction existed: no facelets stamp is involved.
		expect(done.source).toBe('tracker');
		expect(done.endedAt).toBe(start + 6000);
		expect(done.timeMs).toBe(6000);
		expect(done.timeCorrectionMs).toBe(0);
	});

	// A cube clock that runs ahead could put the last move after the facelets stamp.
	// The end must never move backwards from the moves we actually hold.
	it('never shortens a solve when the facelets stamp is older than the last move', async () => {
		const { engine, events, of } = harness({ graceMs: 40, pollMs: 10_000 });
		const start = scrambleAndStart(engine, events);

		// Last move is stamped far in the future relative to wall clock.
		const farFuture = Date.now() + 60_000;
		engine.pushTurns([
			turn('R', 1000), turn('U', 1100), turn('F', 1200),
			turn("F'", start), turn("U'", farFuture),
		]);
		engine.pushFacelets(DEFAULT_SOLVED_STATE);
		await wait(120);

		const done = of('SOLVE_COMPLETE')[0].result;
		expect(done.endedAt).toBe(farFuture);
		expect(done.timeMs).toBeGreaterThan(0);
	});

	// Both pages must report the same move count for the same solve. Rooms used to show the
	// raw BLE event count while the timer showed HTM, so a solve looked faster in a room.
	it('reports HTM, collapsing repeated moves on one face', () => {
		const { engine, events, of } = harness();
		const start = scrambleAndStart(engine, events);

		// Solving R U F needs F' U' R'. The last face is turned three times (R' R R'), which
		// nets out to R' on the cube but counts as one HTM move.
		engine.pushTurns([
			turn('R', 1000), turn('U', 1100), turn('F', 1200),
			turn("F'", start), turn("U'", start + 1000),
			turn("R'", start + 2000), turn('R', start + 2500), turn("R'", start + 6000),
		]);

		const done = of('SOLVE_COMPLETE')[0].result;
		expect(done.turnCount).toBe(5);
		expect(done.htmCount).toBeLessThan(done.turnCount);
		// TPS follows HTM, which is the number shown to the user.
		expect(done.tps).toBeCloseTo(Number((done.htmCount / (done.timeMs / 1000)).toFixed(2)), 2);
	});

	it('carries corrected moves so callers do not refit', () => {
		const { engine, events, of } = harness();
		const start = scrambleAndStart(engine, events);
		engine.pushTurns([
			turn('R', 1000), turn('U', 1100), turn('F', 1200),
			turn("F'", start), turn("U'", start + 3000), turn("R'", start + 6000),
		]);

		const done = of('SOLVE_COMPLETE')[0].result;
		expect(done.correctedMoves).toHaveLength(done.turnCount);
		expect(done.correctedMoves.every((m: any) => typeof m.completedAt === 'number')).toBe(true);
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

/**
 * A dropped BLE packet used to cost the user their whole scramble. The tracker was
 * re-anchored to the state the cube reported and the matcher was wiped along with it, so
 * the display went blank part way through and the correction hint started fighting a user
 * who had done nothing wrong. The cube's own state says how far they got; use it.
 */
describe('SmartSolveEngine — scramble progress across a re-anchor', () => {
	const LONG = "R U F L' D2 B R' U2 F";
	const MOVES = LONG.split(' ');

	/** Scramble started, two moves delivered, the next two packets lost. */
	function twoDeliveredFourDone(options?: ConstructorParameters<typeof SmartSolveEngine>[1]) {
		const h = harness(options);
		h.engine.setScramble(LONG);
		h.engine.setConnected(true);
		h.engine.pushFacelets(DEFAULT_SOLVED_STATE);
		h.engine.pushTurns([turn(MOVES[0], 1000), turn(MOVES[1], 1100)]);
		return h;
	}

	it('keeps the moves the user already made when packets are dropped', () => {
		const { engine, of } = twoDeliveredFourDone();
		expect(engine.scrambleProgress).toEqual(MOVES.slice(0, 2));

		// The cube reports where it really is: four moves in.
		engine.pushFacelets(faceletsAfter(MOVES.slice(0, 4)));

		const resync = of('TRACKER_RESYNCED');
		expect(resync).toHaveLength(1);
		expect(resync[0].realigned).toBe(true);
		expect(engine.scrambleProgress).toEqual(MOVES.slice(0, 4));

		const status = of('SCRAMBLE_PROGRESS').slice(-1)[0].matchStatus;
		expect(status.slice(0, 4)).toEqual(['perfect', 'perfect', 'perfect', 'perfect']);
		expect(status.slice(4).every((s) => s === 'pending')).toBe(true);
	});

	it('completes the scramble from where the user actually is', () => {
		const { engine, of } = twoDeliveredFourDone();
		engine.pushFacelets(faceletsAfter(MOVES.slice(0, 4)));

		// The user carries on with the remaining moves, unaware anything happened.
		let stream = [turn(MOVES[0], 1000), turn(MOVES[1], 1100)];
		MOVES.slice(4).forEach((move, i) => {
			stream = [...stream, turn(move, 2000 + i * 100)];
			engine.pushTurns(stream);
		});

		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(1);
		expect(of('UNDO_MOVES').filter((e) => e.moves && e.moves.length)).toHaveLength(0);
	});

	it('does not warn about a cube that is simply part way through the scramble', async () => {
		const { engine, of } = twoDeliveredFourDone({ outOfSyncDelayMs: 20 });
		engine.pushFacelets(faceletsAfter(MOVES.slice(0, 4)));

		await wait(60);
		expect(of('OUT_OF_SYNC')).toHaveLength(0);
	});

	it('still clears the matcher when the cube is off the scramble path', () => {
		const { engine, of } = twoDeliveredFourDone();

		// A state the scramble never passes through: a genuine mis-scramble, or a cube
		// turned while disconnected. There is nothing trustworthy to keep.
		engine.pushFacelets(faceletsAfter(['R', 'R', 'D', 'B2']));

		const resync = of('TRACKER_RESYNCED');
		expect(resync).toHaveLength(1);
		expect(resync[0].realigned).toBe(false);
		expect(engine.scrambleProgress).toEqual([]);
	});

	it('realigns on the correction path, where the cube does not start solved', () => {
		// Timer correction: the displayed scramble is a short fix-up sequence and the cube
		// sits in a mis-scrambled state, so a prefix table built from solved would be wrong.
		const { engine, of } = harness();
		const correction = "U' R'";
		engine.setScramble(correction, LONG);
		engine.setConnected(true);

		const start = faceletsAfter([...MOVES, 'R', 'U']);
		engine.pushFacelets(start);
		expect(of('TRACKER_RESYNCED').slice(-1)[0].realigned).toBe(true);

		// One move of the fix-up done, its packet lost.
		engine.pushFacelets(faceletsAfter([...MOVES, 'R']));

		const status = of('SCRAMBLE_PROGRESS').slice(-1)[0].matchStatus;
		expect(status).toEqual(['perfect', 'pending']);
	});

	// The half of the problem the prefix table missed. Around 40% of a WCA scramble is double
	// moves, and the cube reports each one as two quarter turns. When the lost packet lands
	// between those quarters the cube is sitting on a state no whole-move prefix describes,
	// so the lookup fails and the progress is wiped exactly as it was before any of this.
	it('keeps progress when the packet is lost mid-double-move', () => {
		const DOUBLE = "R U R2 F L' D2";
		const { engine, of } = harness();
		engine.setScramble(DOUBLE);
		engine.setConnected(true);
		engine.pushFacelets(DEFAULT_SOLVED_STATE);

		engine.pushTurns([turn('R', 1000), turn('U', 1100)]);
		expect(engine.scrambleProgress).toEqual(['R', 'U']);

		// The user has started the R2. Its first quarter turn happened on the cube, but the
		// packet carrying it was lost, so the engine only hears about it from facelets.
		engine.pushFacelets(faceletsAfter(['R', 'U', 'R']));

		expect(of('TRACKER_RESYNCED').slice(-1)[0].realigned).toBe(true);
		const status = of('SCRAMBLE_PROGRESS').slice(-1)[0].matchStatus;
		expect(status.slice(0, 2)).toEqual(['perfect', 'perfect']);
		// Half of the double move is done, and saying so is what lets the user finish it.
		expect(status[2]).toBe('half');
	});

	it('finishes a double move that was half done when the packet was lost', () => {
		const DOUBLE = "R U R2 F L' D2";
		const { engine, of } = harness();
		engine.setScramble(DOUBLE);
		engine.setConnected(true);
		engine.pushFacelets(DEFAULT_SOLVED_STATE);
		engine.pushTurns([turn('R', 1000), turn('U', 1100)]);
		engine.pushFacelets(faceletsAfter(['R', 'U', 'R']));

		// Second quarter of the R2 arrives normally, then the rest of the scramble.
		let stream = [turn('R', 1000), turn('U', 1100)];
		for (const [i, move] of ['R', 'F', "L'", 'D2'].entries()) {
			stream = [...stream, turn(move, 2000 + i * 100)];
			engine.pushTurns(stream);
		}

		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(1);
	});
});

// Bugs found in a live physical-cube session (2026-08-31) with the old move-list matcher
// (matchScrambleWithCommutative, since removed): a half-turn tolerated a commuting move
// while waiting for its second quarter, and that tolerated move — never credited to
// anything symbolically, just not yet ruled out — later collided with an unrelated future
// scramble position that happened to share its face letter (or, worse, let the matcher
// declare the scramble "matched" while the physical cube was not actually on target). Two
// variations of this were found and patched one at a time before the whole move-list
// approach was replaced with the state-based one below, which cannot have this class of
// bug: there is no move list to misalign, only "is the cube's current state somewhere on
// the scramble's path" — the physical cube is always the source of truth.
describe('SmartSolveEngine — state-based matching cannot misfire on a shared face letter', () => {
	it('a move turned early — not the one the scramble actually asks for next — is correctly flagged as a deviation, not symbolically excused', () => {
		// D2 belongs at position 17, not here. The old matcher's `vettedAgainst` bug treated
		// an early, out-of-turn D2 as automatically forgiven because it commutes with U2 and
		// D2 appears somewhere later in the scramble — without checking that the cube's
		// actual state matched what the scramble expected at this point. It doesn't: turning
		// D2 now leaves a real D2 sitting on the cube that the scramble does not ask for
		// until position 17, so completing U2 here must NOT read as "perfect" — the state
		// genuinely differs from "U2 alone done". A physical D2 cannot be un-turned by an
		// unrelated matcher forgetting about it.
		const SCR = "D' B' D2 B' U2 L' U R' D F2 U2 R F2 L U2 R2 D2 B2 R U2 R";
		const { engine, of } = harness();
		engine.setScramble(SCR);
		engine.setConnected(true);

		// D' B' D2 B' correct, then U2 attempted as U + D2 (out of turn) + U.
		engine.pushTurns([
			turn("D'", 1000), turn("B'", 1100), turn('D2', 1200), turn("B'", 1300),
			turn('U', 1400), turn('D2', 1500), turn('U', 1600),
		]);

		const status = of('SCRAMBLE_PROGRESS').slice(-1)[0].matchStatus;
		expect(status.slice(0, 4)).toEqual(['perfect', 'perfect', 'perfect', 'perfect']);
		// Not 'perfect': the cube carries an extra D2 the scramble did not ask for yet, so
		// the state genuinely is not "U2 alone, cleanly done".
		expect(status[4]).not.toBe('perfect');
		// And SCRAMBLE_COMPLETE must never fire while the physical cube sits off target —
		// this is the guard that would have caught the old bug even without a status check.
		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(0);
	});

	it('a half-turn broken by a real mistake gives a short, exact undo that preserves the still-valid first quarter — not a match against a distant unrelated move', () => {
		// R2 half-done as R, then a genuine mistake (F, not part of the scramble at all). F
		// does not commute with R2, so this must be flagged immediately as a deviation, not
		// searched for among later positions sharing a face letter (this scramble has L/L'
		// moves later that an old face-letter-based mixup could have latched onto).
		const SCR = "R2 U F D B L' U2 R D2 F' L2 B2 R' U D'";
		const { engine, of } = harness();
		engine.setScramble(SCR);
		engine.setConnected(true);

		engine.pushTurns([turn('R', 1000), turn('F', 1100)]);

		const hints = of('UNDO_MOVES');
		const lastHint = hints[hints.length - 1].moves!;
		expect(lastHint).not.toEqual(['TOO_MANY']);

		// The first quarter (R) is a genuine, still-valid start of R2 — undoing only what
		// came after it (F) is the short, correct fix, not re-doing the whole R2 from
		// scratch. Applying the hint to the physical cube must land exactly back on "R
		// alone", ready for the second quarter to complete R2.
		const physical = new Cube();
		physical.move('R');
		physical.move('F');
		for (const m of lastHint) physical.move(m);
		const expected = new Cube();
		expected.move('R');
		expect(physical.asString()).toBe(expected.asString());
		expect(lastHint).toEqual(["F'"]);
	});

	// Live-session bug (2026-08-31): a double move started counter-clockwise (U' before a
	// second U' to make U2 — physically identical to U then U, since a 180° turn is its own
	// inverse) was flagged as a mistake. The prefix table only recorded the clockwise
	// starting direction.
	it('a double move started counter-clockwise is recognised as half done, not a mistake', () => {
		const { engine, of } = harness();
		engine.setScramble('U2 R F');
		engine.setConnected(true);

		engine.pushTurns([turn("U'", 1000)]);
		expect(of('SCRAMBLE_PROGRESS').slice(-1)[0].matchStatus[0]).toBe('half');
		expect(of('UNDO_MOVES').filter((e) => e.moves && e.moves.length)).toHaveLength(0);

		engine.pushTurns([turn("U'", 1000), turn("U'", 1100)]);
		expect(of('SCRAMBLE_PROGRESS').slice(-1)[0].matchStatus[0]).toBe('perfect');
	});

	// Live-session bug (2026-08-31): two plain turns of the same face in a row (a genuine
	// deviation, not part of the scramble) showed as two separate undo moves ("F' F'")
	// instead of the one double move a solver would actually make ("F2").
	it('two same-face turns in a row compress to one undo move, not two', () => {
		const { engine, of } = harness();
		engine.setScramble('R U L');
		engine.setConnected(true);

		engine.pushTurns([turn('F', 1000)]);
		engine.pushTurns([turn('F', 1000), turn('F', 1100)]);

		const undo = of('UNDO_MOVES').slice(-1)[0].moves;
		expect(undo).toEqual(['F2']);
	});

	// Live-session bug (2026-08-31): the old move-list matcher let the second of two
	// opposite-face moves (independent layers, physically free to reorder — R then L is
	// the same cube as L then R) be done first without penalty. The state-based rewrite
	// dropped this: the reordered state was never on the prefix table, so doing the
	// scramble's next move a beat early was flagged as a mistake. Restored by recording
	// the "one done early, out of order" state too (tracker.ts prefixStatesFrom).
	it('the second of an opposite-face pair can be turned first without being flagged wrong', () => {
		const { engine, of } = harness();
		// Scramble asks for R then L (opposite faces, independent layers).
		engine.setScramble('R L U2');
		engine.setConnected(true);

		// User does L first.
		engine.pushTurns([turn('L', 1000)]);
		expect(of('SCRAMBLE_PROGRESS').slice(-1)[0].matchStatus[0]).toBe('pending');
		expect(of('UNDO_MOVES').filter((e) => e.moves && e.moves.length)).toHaveLength(0);

		// Then R, completing the pair in the opposite order to the scramble text.
		engine.pushTurns([turn('L', 1000), turn('R', 1100)]);
		expect(of('SCRAMBLE_PROGRESS').slice(-1)[0].matchStatus.slice(0, 2)).toEqual(['perfect', 'perfect']);

		// The rest of the scramble is unaffected.
		engine.pushTurns([turn('L', 1000), turn('R', 1100), turn('U2', 1200)]);
		expect(of('SCRAMBLE_COMPLETE')).toHaveLength(1);
	});
});
