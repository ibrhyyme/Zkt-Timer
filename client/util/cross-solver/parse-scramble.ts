// Ported from cstimer cubeutil.parseScramble
// Parses scramble string like "R U' F2 D" into move tuples [axis, width, power]

const SCRAMBLE_REG = /^([\d]+(?:-\d+)?)?([FRUBLDfrubldzxySME])(?:([w])|&sup([\d]);)?([2'])?$/;

export type MoveSeq = [number, number, number][];

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
			moveseq.push([moveMap.indexOf('FRUBLD'.charAt(f)), 2, p]);
			moveseq.push([moveMap.indexOf('FRUBLD'.charAt(f)), 1, 4 - p]);
			continue;
		}

		const w = f < 12 ? (~~(m[1] || '') || ~~m[4] || ((m[3] === 'w' || f > 5) ? 2 : 0) || 1) : -1;
		const p = (f < 12 ? 1 : -1) * ("2'".indexOf(m[5] || 'X') + 2);
		moveseq.push([moveMap.indexOf('FRUBLD'.charAt(f % 6)), w, p]);
	}

	return moveseq;
}
