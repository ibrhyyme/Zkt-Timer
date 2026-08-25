import Cube from 'cubejs';
import { getReverseTurns } from './solve/turns';
import { solveAsync } from './solver_worker_manager';

export interface SmartTurn {
	turn: string;
	time?: number;
	// Recovered from the cube's move history after a dropped BLE packet: the turn
	// happened earlier than its timestamp suggests.
	recovered?: boolean;
}

let solverReady = false;
let solverInitializing = false;

/**
 * Pre-warm the cubejs solver. Called lazily - deferred via requestIdleCallback
 * to avoid blocking the main thread during timer type switch.
 * After initialization, all solves are instant (<10ms).
 */
export function initSmartSolver(): void {
	if (solverReady || solverInitializing) return;
	solverInitializing = true;

	const doInit = () => {
		Cube.initSolver();
		solverReady = true;
		solverInitializing = false;
	};

	// Run when browser is idle via requestIdleCallback (prevents UI jank)
	if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
		(window as any).requestIdleCallback(doInit, { timeout: 10000 });
	} else {
		setTimeout(doInit, 2000);
	}
}

// Memoize inverse scramble — originalScramble is constant per session
let _cachedScramble = '';
let _cachedInverse: string[] = [];

/**
 * Async version: runs Cube.solve() in a Web Worker so the main thread stays free.
 * Falls back to sync solve if Worker is unavailable.
 */
export async function computeCorrectionPathAsync(
	originalScramble: string,
	userMovesRaw: string[]
): Promise<string[]> {
	if (originalScramble !== _cachedScramble) {
		_cachedInverse = getReverseTurns(originalScramble);
		_cachedScramble = originalScramble;
	}

	const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

	// Replay-based: diffCube = S⁻¹ × U
	const diffCube = new Cube();
	for (const move of _cachedInverse) {
		diffCube.move(move);
	}
	for (const move of userMovesRaw) {
		diffCube.move(move);
	}

	if (diffCube.asString() === SOLVED) {
		return [];
	}

	const solution = await solveAsync(diffCube.toJSON());
	if (!solution || !solution.trim()) return [];

	return solution.trim().split(' ').filter(m => m.trim());
}

export function processSmartTurns(smartTurns: SmartTurn[], skipCompress: boolean = false) {
	// Single pass is sufficient: the helper processes sequentially and after each
	// cancel/merge, the next input element checks against the new top.
	// Adjacent output elements always have different raw turns, so no cascading needed.
	return processSmartTurnsHelper(smartTurns, skipCompress);
}

/**
 * @deprecated Simple collapse used before cstimer's getPrettyMoves.
 * Only performs same-face same-axis collapse (R + R = R2). For new uses,
 * use `getPrettyMoves` from `shared/util/solve/pretty_moves.ts` — full cstimer port
 * including slice merge (R + L' = M), 100ms burst detection, and center tracking.
 *
 * Old usage: For SolveInfo solve display, compresses consecutive same-direction moves
 * into arbitrary-n notation: U + U → U2, U2 + U → U3, etc.
 */
export function cascadeQuartersForDisplay(smartTurns: (SmartTurn | string)[]): string[] {
	const accum: { face: string; quarters: number; raw?: string }[] = [];

	for (let i = 0; i < smartTurns.length; i++) {
		let turn = smartTurns[i] as string;
		if (typeof turn === 'object') {
			turn = (turn as SmartTurn).turn;
		}

		const m = turn.match(/^([URFDLB])(\d+)?([''])?$/);
		if (!m) {
			// Rotation/wide/slice/unknown — write as-is
			accum.push({ face: turn, quarters: 0, raw: turn });
			continue;
		}
		const [, face, count, prime] = m;
		const n = parseInt(count || '1', 10);
		if (n <= 0) continue;
		const quarters = prime ? -n : n;

		const last = accum[accum.length - 1];
		if (last && last.face === face && last.raw === undefined) {
			last.quarters += quarters;
			continue; // Act like skipCompress=true — don't drop even if 0
		}
		accum.push({ face, quarters });
	}

	return accum
		.map((a) => {
			if (a.raw !== undefined) return a.raw;
			if (a.quarters === 0) return '';
			if (a.quarters === 1) return a.face;
			if (a.quarters === -1) return a.face + "'";
			if (a.quarters > 0) return a.face + a.quarters;
			return a.face + Math.abs(a.quarters) + "'";
		})
		.filter(Boolean);
}

function processSmartTurnsHelper(smartTurns: (SmartTurn | string)[], skipCompress: boolean = false) {
	const output = [];

	let movingIndex = 0;
	for (let i = 0; i < smartTurns.length; i += 1) {
		let turn = smartTurns[i] as string;
		if (typeof turn === 'object') {
			turn = (turn as SmartTurn).turn;
		}

		if (output.length > 0) {
			const lastTurn = output[movingIndex - 1];

			if (turn === lastTurn) {
				if (isTwo(turn) && !skipCompress) {
					output.pop();
					movingIndex -= 1;
				} else {
					output[movingIndex - 1] = removePrime(turn) + '2';
				}
				continue;
			}

			if (rawTurnIsSame(turn, lastTurn) && !skipCompress) {
				if (!isTwo(turn) && !isTwo(lastTurn)) {
					output.pop();
					movingIndex -= 1;
				} else if (isTwo(turn) || isTwo(lastTurn)) {
					if (isPrime(turn) || isPrime(lastTurn)) {
						output[movingIndex - 1] = getRawTurn(turn);
					} else {
						output[movingIndex - 1] = getRawTurn(turn) + "'";
					}
				}
				continue;
			}
		}

		output.push(turn);
		movingIndex += 1;
	}

	return output;
}

export function reverseScramble(turns: string[]) {
	const output = [];
	for (let i = turns.length - 1; i > -1; i -= 1) {
		let turn = turns[i];
		if (isPrime(turn)) {
			turn = removePrime(turn);
		} else if (!isTwo(turn)) {
			turn += "'";
		}
		output.push(turn)
	}

	return output;
}

export function invertMove(move: string): string {
	if (isPrime(move)) return removePrime(move);
	if (isTwo(move)) return move;
	return move + "'";
}

export function rawTurnIsSame(turn1: string, turn2: string): boolean {
	return getRawTurn(turn1) === getRawTurn(turn2);
}

function isPrime(turn: string): boolean {
	return turn.indexOf("'") >= 0;
}

export function isTwo(turn: string): boolean {
	return turn.indexOf('2') >= 0;
}

function removePrime(turn: string): string {
	return turn.replace(/'/g, '');
}

export function getRawTurn(turn: string): string {
	return turn.replace(/('|2)/g, '');
}

// Commutative pairs: Moves on opposite faces that don't affect each other
// U/D, L/R, F/B - these can be swapped without changing the cube state
const COMMUTATIVE_PAIRS: Record<string, string> = {
	'U': 'D', 'D': 'U',
	'L': 'R', 'R': 'L',
	'F': 'B', 'B': 'F',
};

/**
 * Check if two moves are commutative (can be done in any order)
 */
export function areCommutative(turn1: string, turn2: string): boolean {
	const raw1 = getRawTurn(turn1);
	const raw2 = getRawTurn(turn2);
	return COMMUTATIVE_PAIRS[raw1] === raw2;
}

/**
 * Matches user moves against expected scramble, allowing commutative reordering.
 * Returns an array of matched moves in the order they should be displayed,
 * along with match status for each position.
 *
 * Example: Expected ["U", "D", "L"], User did ["D", "U", "L"]
 * Since U and D are commutative, this should match successfully.
 */
export function matchScrambleWithCommutative(
	expectedMoves: string[],
	userMoves: string[]
): { matched: boolean; matchStatus: ('perfect' | 'half' | 'wrong' | 'pending')[] } {
	const matchStatus: ('perfect' | 'half' | 'wrong' | 'pending')[] = [];

	// Track which user moves have been consumed
	const userConsumed: boolean[] = new Array(userMoves.length).fill(false);
	let userSearchStart = 0;

	for (let expIdx = 0; expIdx < expectedMoves.length; expIdx++) {
		const expectedMove = expectedMoves[expIdx];

		// Try to find a matching user move
		let foundIdx = -1;
		let isHalf = false;

		// First, try exact match or half match (like R vs R2) starting from userSearchStart
		for (let uIdx = userSearchStart; uIdx < userMoves.length; uIdx++) {
			if (userConsumed[uIdx]) continue;

			const userMove = userMoves[uIdx];

			// Check if all moves between userSearchStart and uIdx are commutative with expectedMove
			let canReach = true;
			for (let between = userSearchStart; between < uIdx; between++) {
				if (userConsumed[between]) continue;
				if (!areCommutative(expectedMove, userMoves[between])) {
					canReach = false;
					break;
				}
			}

			if (!canReach) continue;

			// Check for exact match
			if (userMove === expectedMove) {
				foundIdx = uIdx;
				break;
			}

			// Check for half match (same base, one is x2)
			if (rawTurnIsSame(userMove, expectedMove) && (isTwo(expectedMove) || isTwo(userMove))) {
				foundIdx = uIdx;
				isHalf = true;
				break;
			}
		}

		if (foundIdx >= 0) {
			userConsumed[foundIdx] = true;
			matchStatus.push(isHalf ? 'half' : 'perfect');

			if (isHalf) {
				// The user turned one quarter of a double move (R where R2 was asked). The
				// move is owed, not wrong, so this position stays 'half' and the scramble
				// cannot count as complete until the second quarter lands.
				//
				// Moves made after it only matter if they collide with it. Turning R and then
				// L2 is not a mistake: L2 commutes with R, so the cube sits exactly where
				// those two moves put it and only the R2 is unfinished. Treating that as
				// wrong painted the next move red and offered to undo a move the user had
				// done correctly, which is what made a half-finished double move look like
				// an error instead of something still to do.
				// The user may also have finished the double move later, after turning
				// something that commutes with it: R, L2, R leaves the cube in exactly the
				// state R2, L2 would. Look ahead for the completing quarter, and credit the
				// whole move when everything in between commutes with it.
				let completesIdx = -1;
				for (let idx = foundIdx + 1; idx < userMoves.length; idx++) {
					if (userConsumed[idx]) continue;
					// Same quarter turn again finishes the double; the opposite one cancels it.
					if (userMoves[idx] === userMoves[foundIdx]) {
						completesIdx = idx;
						break;
					}
					if (!areCommutative(expectedMove, userMoves[idx])) break;
				}
				if (completesIdx >= 0) {
					userConsumed[completesIdx] = true;
					matchStatus[matchStatus.length - 1] = 'perfect';
					while (userSearchStart < userMoves.length && userConsumed[userSearchStart]) {
						userSearchStart++;
					}
					continue;
				}

				const blocked = userMoves.some(
					(m, idx) => idx > foundIdx && !userConsumed[idx] && !areCommutative(expectedMove, m)
				);
				if (blocked) {
					for (let i = expIdx + 1; i < expectedMoves.length; i++) {
						matchStatus.push('wrong');
					}
					return { matched: false, matchStatus };
				}
				// Carry on matching: moves the user already made further along still get
				// credited, and the half turn stays on screen as the one thing outstanding.
				while (userSearchStart < userMoves.length && userConsumed[userSearchStart]) {
					userSearchStart++;
				}
				continue;
			}

			// Advance search start past all consumed moves
			while (userSearchStart < userMoves.length && userConsumed[userSearchStart]) {
				userSearchStart++;
			}
		} else if (userSearchStart < userMoves.length) {
			// The user has turned something, just not this move. Before calling it wrong,
			// check whether everything they still have outstanding commutes with this one:
			// doing R2 before L2 leaves the cube in exactly the same place, so this position
			// is simply not done yet. Calling it wrong turned the whole scramble red the
			// moment a user reordered an opposite pair, and the correction hint then asked
			// them to undo a move that was right.
			const outstanding = userMoves.filter((_, idx) => idx >= userSearchStart && !userConsumed[idx]);
			// Commuting with this move is not enough on its own — D2 commutes with U but is
			// still a mistake when the scramble never asks for it. Every outstanding move has
			// to be one the scramble still wants, otherwise a genuinely wrong turn would slip
			// through as "not done yet" and the user would never get a correction hint.
			const stillWanted = expectedMoves.slice(expIdx + 1);
			const belongsLater = (m: string) =>
				stillWanted.some((e) => e === m || (rawTurnIsSame(e, m) && (isTwo(e) || isTwo(m))));
			if (outstanding.every((m) => areCommutative(expectedMove, m) && belongsLater(m))) {
				matchStatus.push('pending');
				continue;
			}
			matchStatus.push('wrong');
			// Mark remaining as wrong
			for (let i = expIdx + 1; i < expectedMoves.length; i++) {
				matchStatus.push('wrong');
			}
			return { matched: false, matchStatus };
		} else {
			// User hasn't made this move yet
			matchStatus.push('pending');
		}
	}

	// Check if all user moves were consumed (no extra wrong moves)
	const allConsumed = userConsumed.slice(0, userMoves.length).every(c => c);
	// Half matches are NOT considered complete - only perfect matches count
	const allPerfect = matchStatus.every(s => s === 'perfect');

	return {
		matched: allConsumed && allPerfect,
		matchStatus
	};
}

/**
 * Incremental move compressor: maintains an output stack and only processes
 * newly appended turns, reducing per-batch cost from O(n) to O(k).
 */
export class IncrementalCompressor {
	private output: string[] = [];
	private processedCount = 0;

	processNew(allTurns: (SmartTurn | string)[], skipCompress = false): string[] {
		for (let i = this.processedCount; i < allTurns.length; i++) {
			let turn = allTurns[i] as string;
			if (typeof turn === 'object') {
				turn = (turn as SmartTurn).turn;
			}

			if (this.output.length > 0) {
				const lastTurn = this.output[this.output.length - 1];

				if (turn === lastTurn) {
					if (isTwo(turn) && !skipCompress) {
						this.output.pop();
					} else {
						this.output[this.output.length - 1] = removePrime(turn) + '2';
					}
					continue;
				}

				if (rawTurnIsSame(turn, lastTurn) && !skipCompress) {
					if (!isTwo(turn) && !isTwo(lastTurn)) {
						this.output.pop();
					} else if (isTwo(turn) || isTwo(lastTurn)) {
						if (isPrime(turn) || isPrime(lastTurn)) {
							this.output[this.output.length - 1] = getRawTurn(turn);
						} else {
							this.output[this.output.length - 1] = getRawTurn(turn) + "'";
						}
					}
					continue;
				}
			}

			this.output.push(turn);
		}

		this.processedCount = allTurns.length;
		return this.output;
	}

	/**
	 * Start from a move list that is already known to have happened, instead of an empty
	 * one. Used when the cube reports a state the scramble passes through: the physical
	 * cube proves how far the user got, so the matcher carries on from there rather than
	 * making them start the scramble over because a BLE packet went missing.
	 */
	seed(moves: string[]): void {
		this.output = [...moves];
		this.processedCount = 0;
	}

	getOutput(): string[] {
		return this.output;
	}

	reset(): void {
		this.output = [];
		this.processedCount = 0;
	}
}
