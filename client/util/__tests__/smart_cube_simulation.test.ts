/**
 * Smart Cube Simulation Test
 *
 * Simulates the state machine from SmartCube.tsx with pure functions.
 * No React/Redux — only cubejs, IncrementalCompressor, matchScrambleWithCommutative.
 *
 * Each scenario produces detailed logs: moves, match status, undo, correction, restore.
 */

import Cube from 'cubejs';
import {
	IncrementalCompressor,
	matchScrambleWithCommutative,
	invertMove,
	SmartTurn,
} from '../smart_scramble';
import { getReverseTurns } from '../solve/turns';

// ── CONSTANTS ──
const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// ── SIMULATOR ──

class SmartCubeSimulator {
	// Physical cube (state from BLE)
	physicalCube: Cube;
	// Virtual cube (synced on each move event)
	cubejs: Cube;
	// Move compressor
	compressor: IncrementalCompressor;

	// State
	scramble: string;
	originalScramble: string;
	smartTurnOffset: number;
	smartTurns: SmartTurn[];
	targetFacelets: string;
	smartUndoMoves: string[] | null;
	smartCanStart: boolean;
	timeStartedAt: Date | null;
	initialSyncDone: boolean;
	scrambleCompletedAt: Date | null;
	connected: boolean;

	// Log
	log: string[];

	constructor(scramble: string) {
		this.physicalCube = new Cube();
		this.cubejs = new Cube();
		this.compressor = new IncrementalCompressor();

		this.scramble = scramble;
		this.originalScramble = scramble;
		this.smartTurnOffset = 0;
		this.smartTurns = [];
		this.smartUndoMoves = null;
		this.smartCanStart = false;
		this.timeStartedAt = null;
		this.initialSyncDone = false;
		this.scrambleCompletedAt = null;
		this.connected = false;
		this.log = [];

		// Calculate target state (result of original scramble)
		const targetCube = new Cube();
		scramble.split(' ').filter(m => m.trim()).forEach(m => targetCube.move(m));
		this.targetFacelets = targetCube.asString();

		this.emit('INIT', `scramble: ${scramble} | target: ${this.targetFacelets.slice(0, 20)}...`);
	}

	private emit(tag: string, msg: string) {
		const line = `[${tag.padEnd(8)}] ${msg}`;
		this.log.push(line);
		// eslint-disable-next-line no-console
		console.log(line);
	}

	// ── BLE Connection ──

	connect(physicalState?: string) {
		this.connected = true;

		if (physicalState) {
			this.physicalCube = Cube.fromString(physicalState);
		}
		// else: physicalCube stays as-is (default: solved)

		const facelets = this.physicalCube.asString();
		this.emit('CONNECT', `facelets: ${facelets.slice(0, 20)}... | solved: ${facelets === SOLVED}`);

		this.initialSync();
	}

	disconnect() {
		this.connected = false;
		this.initialSyncDone = false;
		this.emit('DISCONN', 'BLE connection closed | initialSyncDone reset');
	}

	// ── Initial Sync (SmartCube.tsx:476-570) ──

	private initialSync() {
		const facelets = this.physicalCube.asString();

		// Guard: already done
		if (this.initialSyncDone) {
			this.emit('SYNC', 'SKIP — initialSyncDone=true');
			return;
		}

		// Guard: reconnect during correction mode (SmartCube.tsx:481-482)
		if (this.originalScramble && this.scramble !== this.originalScramble) {
			this.emit('SYNC', 'SKIP — correction mode guard (scramble !== originalScramble)');
			return;
		}

		this.initialSyncDone = true;

		// Cube is solved, no sync needed
		if (facelets === SOLVED) {
			this.emit('SYNC', 'Cube SOLVED — no sync needed');
			return;
		}

		this.emit('SYNC', `Cube SCRAMBLED — calculating correction...`);

		// Solve physical state (current → solved)
		const currentCube = Cube.fromString(facelets);
		const solveStr = currentCube.solve();
		const toCurrentMoves: string[] = solveStr
			? getReverseTurns(solveStr) as string[]
			: [];

		this.emit('SYNC', `toCurrentMoves: [${toCurrentMoves.join(' ')}]`);

		// Sync cubejs to physical state
		this.cubejs = Cube.fromString(facelets);

		// Cube already at target state?
		if (facelets === this.targetFacelets) {
			this.emit('SYNC', 'Cube already at target — scramble complete');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			return;
		}

		// Calculate correction path (sync — no Worker)
		// diffCube = S^-1 x U
		const cachedInverse = getReverseTurns(this.scramble);
		const diffCube = new Cube();
		for (const m of cachedInverse) diffCube.move(m);
		for (const m of toCurrentMoves) diffCube.move(m);

		if (diffCube.asString() === SOLVED) {
			this.emit('SYNC', 'diffCube SOLVED — no correction needed');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			return;
		}

		const solution = diffCube.solve();
		const correctionMoves = solution
			? solution.trim().split(' ').filter(m => m.trim())
			: [];

		if (correctionMoves.length === 0) {
			this.emit('SYNC', 'Correction empty — cube at target');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			return;
		}

		// New scramble = correction path
		const newScramble = correctionMoves.join(' ');
		this.originalScramble = this.scramble;
		this.scramble = newScramble;
		this.smartTurnOffset = 0;
		this.compressor.reset();

		this.emit('SYNC', `correction path: ${newScramble}`);
		this.emit('SYNC', `originalScramble: ${this.originalScramble} | scramble: ${this.scramble}`);
	}

	// ── Move ──

	move(turn: string) {
		if (!this.connected) {
			this.emit('ERROR', `Cube not connected — move rejected: ${turn}`);
			return;
		}

		// Update physical + virtual cube
		this.physicalCube.move(turn);
		this.cubejs.move(turn);

		// Record SmartTurn
		this.smartTurns.push({ turn, time: Date.now() });

		const facelets = this.physicalCube.asString();
		const cubejsState = this.cubejs.asString();

		// If timer running → check for solve
		if (this.timeStartedAt) {
			this.emit('MOVE', `${turn} | cubejs: ${cubejsState.slice(0, 15)}... | solving`);
			this.checkSolved();
			return;
		}

		// Scramble complete, first move → start timer
		if (this.scrambleCompletedAt) {
			this.emit('MOVE', `${turn} | TIMER START (scramble already complete)`);
			this.timeStartedAt = new Date();
			this.smartCanStart = false;
			this.scrambleCompletedAt = null;
			return;
		}

		// Scramble phase — check match
		this.emit('MOVE', `${turn} | facelets: ${facelets.slice(0, 15)}...`);

		// FACELETS restore check (SmartCube.tsx:395-406)
		this.checkFaceletsRestore();

		// FACELETS scramble safety net
		if (facelets === this.targetFacelets) {
			this.emit('FACELETS', 'Physical cube AT TARGET — scramble complete');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			this.smartUndoMoves = null;
			return;
		}

		// Move matcher
		this.checkForStart();
	}

	// ── Move Matcher (SmartCube.tsx:651-772) ──

	private checkForStart() {
		if (!this.scramble) return;

		const offset = this.smartTurnOffset || 0;
		const relevantTurns = offset > 0 ? this.smartTurns.slice(offset) : this.smartTurns;

		const userMoves = this.compressor.processNew(relevantTurns);
		const expectedMoves = this.scramble.split(' ').filter(m => m.trim());
		const { matched, matchStatus } = matchScrambleWithCommutative(expectedMoves, userMoves);

		this.emit('MATCH', `user: [${userMoves.join(' ')}] | expected: [${expectedMoves.join(' ')}]`);
		this.emit('MATCH', `matched: ${matched} | status: [${matchStatus.join(', ')}]`);

		if (matched) {
			// cubejs validation
			const cubejsState = this.cubejs.asString();
			if (cubejsState !== this.targetFacelets) {
				this.emit('MATCH', `MATCHED but cubejs MISMATCH — wait for FACELETS`);
				return;
			}

			this.emit('MATCH', 'SCRAMBLE COMPLETE');
			this.scrambleCompletedAt = new Date();
			this.smartCanStart = true;
			this.smartUndoMoves = null;
			return;
		}

		if (matchStatus.includes('wrong')) {
			const firstWrongIdx = matchStatus.indexOf('wrong');
			const wrongUserMoves = userMoves.slice(firstWrongIdx);

			if (wrongUserMoves.length > 7) {
				this.emit('WRONG', `${wrongUserMoves.length} wrong moves — TOO_MANY`);
				this.smartUndoMoves = ['TOO_MANY'];
			} else {
				const undoSequence = wrongUserMoves.slice().reverse().map(invertMove);
				this.emit('WRONG', `undo: [${undoSequence.join(' ')}] | wrong_count: ${wrongUserMoves.length}`);
				this.smartUndoMoves = undoSequence;
			}
		} else if (matchStatus.includes('half')) {
			this.emit('HALF', 'Half match — undo cleared');
			this.smartUndoMoves = null;
		} else {
			// All perfect or pending
			this.smartUndoMoves = null;
		}
	}

	// ── FACELETS Restore (SmartCube.tsx:395-406) ──

	private checkFaceletsRestore() {
		const facelets = this.physicalCube.asString();

		if (
			facelets === SOLVED &&
			this.originalScramble &&
			this.scramble !== this.originalScramble
		) {
			this.emit('RESTORE', `Cube solved during correction — restore original scramble`);
			this.emit('RESTORE', `${this.scramble} → ${this.originalScramble}`);

			this.scramble = this.originalScramble;
			this.smartTurnOffset = this.smartTurns.length;
			this.smartUndoMoves = null;
			this.compressor.reset();
		}
	}

	// ── Solve Detection ──

	private checkSolved() {
		const cubejsState = this.cubejs.asString();
		const facelets = this.physicalCube.asString();

		if (cubejsState === SOLVED || facelets === SOLVED) {
			const elapsed = this.timeStartedAt
				? (Date.now() - this.timeStartedAt.getTime()) / 1000
				: 0;
			this.emit('SOLVED', `cubejs=${cubejsState === SOLVED} facelets=${facelets === SOLVED} | ${elapsed.toFixed(2)}s`);
			this.timeStartedAt = null;
			this.smartCanStart = false;
		}
	}

	// ── Timer ──

	startTimer() {
		if (!this.scrambleCompletedAt && !this.smartCanStart) {
			this.emit('ERROR', 'Cannot start timer — scramble not complete');
			return;
		}
		this.timeStartedAt = new Date();
		this.smartCanStart = false;
		this.scrambleCompletedAt = null;
		this.emit('TIMER', 'Timer started');
	}

	// ── Batch moves (convenience) ──

	moves(turns: string) {
		turns.split(' ').filter(m => m.trim()).forEach(m => this.move(m));
	}

	// ── Completely solve cube (physical + virtual) ──

	solveCube() {
		const solution = this.physicalCube.solve();
		if (solution && solution.trim()) {
			this.emit('ACTION', `Solving cube: ${solution}`);
			solution.trim().split(' ').filter(m => m.trim()).forEach(m => this.move(m));
		} else {
			this.emit('ACTION', 'Cube already solved');
		}
	}

	// ── State summary ──

	status(): string {
		return [
			`scramble: "${this.scramble}"`,
			`originalScramble: "${this.originalScramble}"`,
			`offset: ${this.smartTurnOffset}`,
			`turns: ${this.smartTurns.length}`,
			`undo: ${this.smartUndoMoves ? `[${this.smartUndoMoves.join(' ')}]` : 'null'}`,
			`canStart: ${this.smartCanStart}`,
			`timer: ${this.timeStartedAt ? 'running' : 'stopped'}`,
			`connected: ${this.connected}`,
			`syncDone: ${this.initialSyncDone}`,
			`physical: ${this.physicalCube.asString() === SOLVED ? 'SOLVED' : this.physicalCube.asString().slice(0, 15) + '...'}`,
			`cubejs: ${this.cubejs.asString() === SOLVED ? 'SOLVED' : this.cubejs.asString().slice(0, 15) + '...'}`,
		].join(' | ');
	}
}

// ── TESTS ──

beforeAll(() => {
	Cube.initSolver();
}, 30000); // Solver init can take 2-5 seconds

describe('Smart Cube Simulation', () => {

	// ── Scenario 1: Normal Flow ──
	test('Solved cube + correct scramble tracking', () => {
		console.log('\n=== SCENARIO 1: Normal Flow ===\n');
		const sim = new SmartCubeSimulator('R U F2');

		sim.connect(); // SOLVED cube

		// Correct moves
		sim.move('R');
		sim.move('U');
		sim.move('F2');

		expect(sim.smartCanStart).toBe(true);
		expect(sim.scrambleCompletedAt).not.toBeNull();
		expect(sim.smartUndoMoves).toBeNull();

		console.log('STATUS:', sim.status());
	});

	// ── Scenario 2: Wrong move + Undo ──
	test('Wrong move → undo → continue', () => {
		console.log('\n=== SCENARIO 2: Wrong Move + Undo ===\n');
		const sim = new SmartCubeSimulator('R U F2');

		sim.connect();

		sim.move('R');  // Correct
		sim.move('L');  // WRONG (expected: U)

		expect(sim.smartUndoMoves).toEqual(["L'"]);

		// Undo
		sim.move("L'");

		// Continue
		sim.move('U');
		sim.move('F2');

		expect(sim.smartCanStart).toBe(true);
		console.log('STATUS:', sim.status());
	});

	// ── Scenario 3: TOO_MANY (8+) ──
	test('8+ wrong moves → TOO_MANY', () => {
		console.log('\n=== SCENARIO 3: TOO_MANY ===\n');
		const sim = new SmartCubeSimulator('R U F2');

		sim.connect();
		sim.move('R');  // Correct

		// 8+ wrong moves
		const wrongMoves = ['L', 'D', 'B', 'L', 'D', 'B', 'L', 'D'];
		wrongMoves.forEach(m => sim.move(m));

		expect(sim.smartUndoMoves).toEqual(['TOO_MANY']);
		console.log('STATUS:', sim.status());
	});

	// ── Scenario 4: Scrambled cube + Correction ──
	test('Scrambled cube connect → correction path → complete', () => {
		console.log('\n=== SCENARIO 4: Scrambled Cube + Correction ===\n');
		const sim = new SmartCubeSimulator('R U');

		// Scramble physical cube
		const scrambledCube = new Cube();
		scrambledCube.move('F');
		scrambledCube.move('D');
		sim.connect(scrambledCube.asString());

		// Correction path calculated — original scramble preserved
		expect(sim.originalScramble).toBe('R U');
		expect(sim.scramble).not.toBe('R U'); // Correction path should differ

		console.log('Correction path:', sim.scramble);

		// Follow correction
		const correctionMoves = sim.scramble.split(' ').filter(m => m.trim());
		correctionMoves.forEach(m => sim.move(m));

		// Cube reached target state?
		const targetCube = new Cube();
		'R U'.split(' ').forEach(m => targetCube.move(m));

		expect(sim.physicalCube.asString()).toBe(targetCube.asString());
		console.log('STATUS:', sim.status());
	});

	// ── Scenario 5: Correction + Solve cube → Restore ──
	test('Correction → TOO_MANY → solve cube → original restore', () => {
		console.log('\n=== SCENARIO 5: Correction + Restore ===\n');
		const sim = new SmartCubeSimulator('R U');

		// Connect scrambled cube
		const scrambledCube = new Cube();
		scrambledCube.move('F');
		scrambledCube.move('D');
		sim.connect(scrambledCube.asString());

		const correctionPath = sim.scramble;
		console.log('Correction path:', correctionPath);

		// Make wrong moves (8+ → TOO_MANY)
		const wrongMoves = ['L', 'D', 'B', 'L', 'D', 'B', 'L', 'D', 'B'];
		wrongMoves.forEach(m => sim.move(m));
		expect(sim.smartUndoMoves).toEqual(['TOO_MANY']);

		// Completely solve cube
		sim.solveCube();

		// Original scramble restored?
		expect(sim.scramble).toBe('R U');
		expect(sim.originalScramble).toBe('R U');
		expect(sim.smartUndoMoves).toBeNull();
		expect(sim.physicalCube.asString()).toBe(SOLVED);

		console.log('STATUS after restore:', sim.status());

		// Now follow original scramble
		sim.move('R');
		sim.move('U');

		expect(sim.smartCanStart).toBe(true);
		console.log('STATUS after scramble:', sim.status());
	});

	// ── Scenario 6: BLE Reconnect During Correction ──
	test('Correction mode → disconnect → reconnect → no new sync', () => {
		console.log('\n=== SCENARIO 6: BLE Reconnect ===\n');
		const sim = new SmartCubeSimulator('R U');

		// Connect scrambled cube
		const scrambledCube = new Cube();
		scrambledCube.move('F');
		scrambledCube.move('D');
		sim.connect(scrambledCube.asString());

		const correctionPathBefore = sim.scramble;
		console.log('Correction path (1st connect):', correctionPathBefore);

		// BLE disconnect + reconnect
		sim.disconnect();
		expect(sim.initialSyncDone).toBe(false); // Disconnect resets

		// Reconnect with same physical state
		sim.connect(sim.physicalCube.asString());

		// Correction mode guard — new sync did NOT run
		expect(sim.scramble).toBe(correctionPathBefore); // Same correction path
		console.log('Correction path (2nd connect):', sim.scramble);
		console.log('STATUS:', sim.status());
	});

	// ── Scenario 7: Commutative matching ──
	test('Commutative pairs: U D → D U', () => {
		console.log('\n=== SCENARIO 7: Commutative Matching ===\n');
		const sim = new SmartCubeSimulator('U D R');

		sim.connect();

		// Reverse order: D first, U second (commutative)
		sim.move('D');
		sim.move('U');
		sim.move('R');

		expect(sim.smartCanStart).toBe(true);
		console.log('STATUS:', sim.status());
	});

	// ── Scenario 8: Half match ──
	test('Half match: R2 instead of R', () => {
		console.log('\n=== SCENARIO 8: Half Match ===\n');
		const sim = new SmartCubeSimulator('R U');

		sim.connect();

		sim.move('R2'); // Half — expected R but R2 executed

		// Half match → no undo, but not complete
		expect(sim.smartCanStart).toBe(false);
		expect(sim.smartUndoMoves).toBeNull(); // Half → undo not shown

		console.log('STATUS:', sim.status());
	});

	// ── Scenario 9: Full flow (scramble → solve → complete) ──
	test('Full flow: scramble → timer → solve', () => {
		console.log('\n=== SCENARIO 9: Full Flow ===\n');
		const sim = new SmartCubeSimulator('R U');

		sim.connect();

		// Follow scramble
		sim.move('R');
		sim.move('U');
		expect(sim.smartCanStart).toBe(true);

		// First move starts timer
		sim.move("U'"); // Solve begins
		expect(sim.timeStartedAt).not.toBeNull();

		// Solve continues
		sim.move("R'");

		// cubejs and physical cube should be SOLVED
		expect(sim.physicalCube.asString()).toBe(SOLVED);
		expect(sim.cubejs.asString()).toBe(SOLVED);
		expect(sim.timeStartedAt).toBeNull(); // Timer stopped

		console.log('STATUS:', sim.status());
	});
});
