import Cube from 'cubejs';
import { getReverseTurns } from './solve/turns';
import { solveAsync } from './solver_worker_manager';

export interface SmartTurn {
	turn: string;
	time?: number;
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

	// requestIdleCallback ile tarayıcı boşken çalıştır (UI kasması önlenir)
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
				// Half match: user did one turn of a double move (e.g. R instead of R2).
				// Don't proceed to next expected move — the double move must be completed first.
				// If there are extra unconsumed user moves after this, the user moved on
				// without completing the double move → wrong.
				// If no extra moves, user may still complete it → pending.
				const hasExtraMoves = userMoves.some((_, idx) => idx > foundIdx && !userConsumed[idx]);
				if (hasExtraMoves) {
					for (let i = expIdx + 1; i < expectedMoves.length; i++) {
						matchStatus.push('wrong');
					}
					return { matched: false, matchStatus };
				}
				for (let i = expIdx + 1; i < expectedMoves.length; i++) {
					matchStatus.push('pending');
				}
				return { matched: false, matchStatus };
			}

			// Advance search start past all consumed moves
			while (userSearchStart < userMoves.length && userConsumed[userSearchStart]) {
				userSearchStart++;
			}
		} else if (userSearchStart < userMoves.length) {
			// User made a move but it doesn't match
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

	getOutput(): string[] {
		return this.output;
	}

	reset(): void {
		this.output = [];
		this.processedCount = 0;
	}
}

