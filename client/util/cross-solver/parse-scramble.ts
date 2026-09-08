// Ported from cstimer cubeutil.parseScramble
// Parses scramble string like "R U' F2 D" into move tuples [axis, width, power]

const SCRAMBLE_REG = /^([\d]+(?:-\d+)?)?([FRUBLDfrubldzxySME])(?:([w])|&sup([\d]);)?([2'])?$/;

/**
 * [faceIndex, width, power, rangeStart?]
 *
 * `rangeStart` is cstimer's `w2`: the low end of an explicit layer range such as
 * "3-4Rw", or -1 when the move is not ranged. Solvers ignore it; the virtual cube
 * needs it to turn a ranged wide move into a [startLayer, endLayer] pair.
 */
export type MoveSeq = [number, number, number, number?][];

export function parseScramble(scramble: string, moveMap: string): MoveSeq {
	const moveseq: MoveSeq = [];
	const moves = (scramble || '').split(' ');

	for (let s = 0; s < moves.length; s++) {
		const m = SCRAMBLE_REG.exec(moves[s]);
		if (m == null) continue;

		let f = 'FRUBLDfrubldzxySME'.indexOf(m[2]);
		if (f > 14) {
			// Slice moves (S, M, E) -> decomposed
			const p = "2'".indexOf(m[5] || 'X') + 2;
			f = [0, 4, 5][f % 3];
			// cstimer omits the range element on this branch, which leaves it
			// undefined and makes downstream `w2 == -1` tests fail. Emitting the
			// explicit -1 is what every other branch does and what those tests
			// expect. Unreachable for WCA NxN scrambles, which carry no M/E/S.
			moveseq.push([moveMap.indexOf('FRUBLD'.charAt(f)), 2, p, -1]);
			moveseq.push([moveMap.indexOf('FRUBLD'.charAt(f)), 1, 4 - p, -1]);
			continue;
		}

		// The prefix may be a plain count ("3Rw") or a range ("3-4Rw"), so split on
		// '-' before coercing. Coercing the whole string first yields 0 for a range
		// and silently falls through to the wide-move default.
		const widthParts = (m[1] || '').split('-');
		const w2 = ~~widthParts[1] || -1;
		const w = f < 12 ? (~~widthParts[0] || ~~m[4] || ((m[3] === 'w' || f > 5) ? 2 : 0) || 1) : -1;
		const p = (f < 12 ? 1 : -1) * ("2'".indexOf(m[5] || 'X') + 2);
		moveseq.push([moveMap.indexOf('FRUBLD'.charAt(f % 6)), w, p, w2]);
	}

	return moveseq;
}
