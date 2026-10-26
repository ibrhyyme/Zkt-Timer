import Cube from 'cubejs';

export interface SmartTurn {
	turn: string;
	time?: number;
	// Recovered from the cube's move history after a dropped BLE packet: the turn
	// happened earlier than its timestamp suggests.
	recovered?: boolean;
	// Already contained in the last cube state the driver adopted from the cube: its
	// packet landed after the facelets packet that counted it. Applying it to a tracker
	// that follows the cube's reported state would count it twice.
	stale?: boolean;
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
