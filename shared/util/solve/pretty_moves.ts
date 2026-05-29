/**
 * cstimer getPrettyMoves direct port — slice/wide move collapse + 100ms burst detection.
 *
 * Source: Reference/cstimer-master/src/js/lib/cubeutil.js:254-321
 *
 * Behavior:
 *   - Same-axis collapse: R + R = R2, R + R' = (cancel), R + R2 = R', R2 + R2 = (cancel)
 *   - Slice merge (parallel-axis opposite-power): R + L' = M, R' + L = M', U + D' = E', etc.
 *   - 100ms burst detection: if consecutive moves occur less than 100ms apart, attempt slice
 *     merge. At longer intervals no merge (user thought it out, didn't intend slice).
 *   - Center rotation tracking: after M/E/S moves, the cube's center positions change,
 *     and subsequent moves are interpreted relative to those changed positions.
 *
 * Only face turns (URFDLB) are accepted as input. Wide moves (Rw, r),
 * cube rotations (x/y/z), slices (M/E/S input), 'NONE', or empty strings
 * are passed through to output unchanged, bypassing collapse logic.
 */

export interface TimedMove {
	turn: string;
	timestamp: number;
}

const FACE_CHARS = 'URFDLB';
const POW_CHARS = " 2'";
const OUTPUT_CHARS = 'URFDLBEMS';

// Center rotation lookup — cstimer cubeutil.js:254-258 direct port.
const CENTER_ROT: number[][] = [
	[0, 2, 4, 3, 5, 1], // axisM=0 (E slice / y' rotation)
	[5, 1, 0, 2, 4, 3], // axisM=1 (M slice / x' rotation)
	[4, 0, 2, 1, 3, 5], // axisM=2 (S slice / z rotation)
];

// Power sign table for powM calculation — cstimer cubeutil.js:301
const POWER_SIGN = [1, 1, -1, -1, -1, 1];

function isCollapsibleFaceMove(turn: string): boolean {
	if (!turn || turn.length === 0) return false;
	const face = turn[0];
	if (FACE_CHARS.indexOf(face) < 0) return false;
	if (turn.length === 1) return true; // "R"
	if (turn.length === 2 && (turn[1] === '2' || turn[1] === "'")) return true; // "R2", "R'"
	return false;
}

/**
 * cstimer getPrettyMoves direct port. For a single move sequence.
 *
 * Pass-through pattern: non-URFDLB moves (Rw, M, x, y2, etc.) bypass collapse logic.
 * cstimer expects pure URFDLB — our engine sometimes sends wide/slice moves.
 * In this case, non-collapsible moves appear in canonical output, consecutive collapsible
 * groups operate with current center state but are split by pass-through moves.
 *
 * @param moves Array of moves with per-move timestamps.
 * @returns cstimer notation string (e.g., "R U' R'", "M U' M'", "R U R' L").
 */
export function getPrettyMoves(moves: TimedMove[]): string {
	if (!moves || moves.length === 0) return '';

	let center = [0, 1, 2, 3, 4, 5];
	const outputs: string[] = [];
	let buffer: TimedMove[] = [];

	const flushBuffer = () => {
		if (buffer.length === 0) return;
		const ret = processFaceMoves(buffer, center, (newCenter) => {
			center = newCenter;
		});
		const formatted = formatRet(ret);
		if (formatted) outputs.push(formatted);
		buffer = [];
	};

	for (const m of moves) {
		if (isCollapsibleFaceMove(m.turn)) {
			buffer.push(m);
		} else {
			flushBuffer();
			outputs.push(m.turn);
		}
	}
	flushBuffer();

	return outputs.join(' ');
}

/**
 * cstimer cubeutil.js:290-314 direct port. Processes a face-turn-only sequence,
 * performs collapse + slice merge, returns encoded ret array. center array is mutable.
 */
function processFaceMoves(
	moveSeq: TimedMove[],
	center: number[],
	updateCenter: (newCenter: number[]) => void
): number[] {
	const ret: number[] = [];

	const pushSol = (axis: number, pow: number) => {
		if (ret.length === 0 || Math.floor(ret[ret.length - 1] / 3) !== axis) {
			ret.push(axis * 3 + pow);
			return;
		}
		const newPow = (pow + (ret[ret.length - 1] % 3) + 1) % 4;
		if (newPow === 3) {
			ret.pop();
		} else {
			ret[ret.length - 1] = axis * 3 + newPow;
		}
	};

	for (let i = 0; i < moveSeq.length; i++) {
		const turn = moveSeq[i].turn;
		const axis = center.indexOf(FACE_CHARS.indexOf(turn[0]));
		const powChar = turn.length > 1 ? turn[1] : ' ';
		const pow = POW_CHARS.indexOf(powChar) % 3;

		const isLast = i === moveSeq.length - 1;
		const burstBroken = !isLast && moveSeq[i + 1].timestamp - moveSeq[i].timestamp > 100;

		if (isLast || burstBroken) {
			pushSol(axis, pow);
			continue;
		}

		const next = moveSeq[i + 1];
		const axis2 = center.indexOf(FACE_CHARS.indexOf(next.turn[0]));
		const powChar2 = next.turn.length > 1 ? next.turn[1] : ' ';
		const pow2 = POW_CHARS.indexOf(powChar2) % 3;

		if (axis !== axis2 && axis % 3 === axis2 % 3 && pow + pow2 === 2) {
			const axisM = axis % 3;
			const powM = (pow - 1) * POWER_SIGN[axis] + 1;
			pushSol(axisM + 6, powM);
			let cur = center;
			for (let p = 0; p < powM + 1; p++) {
				const nextCenter: number[] = [];
				for (let c = 0; c < 6; c++) {
					nextCenter[c] = cur[CENTER_ROT[axisM][c]];
				}
				cur = nextCenter;
			}
			center = cur;
			updateCenter(cur);
			i++; // next move was merged, skip it
			continue;
		}

		pushSol(axis, pow);
	}

	return ret;
}

// cstimer raw output uses ' '/'2'/"'" suffix — space-less prime+face
// combinations create ambiguity ("R'L'"). Format with space-awareness (single space between moves) —
// algorithm is identical to cstimer, only final string formatting is more
// readable/parseable.
function formatRet(ret: number[]): string {
	if (ret.length === 0) return '';
	return ret
		.map((val) => {
			const face = OUTPUT_CHARS[Math.floor(val / 3)];
			const pow = val % 3;
			if (pow === 0) return face;
			if (pow === 1) return face + '2';
			return face + "'";
		})
		.join(' ');
}

/**
 * Convenience: for callers without timestamps. All moves treated as single burst
 * (timestamp 0, burst threshold not exceeded).
 */
export function getPrettyMovesFromStrings(moves: string[]): string {
	const timed: TimedMove[] = moves.map((turn) => ({ turn, timestamp: 0 }));
	return getPrettyMoves(timed);
}
