/**
 * cstimer getPrettyMoves birebir port — slice/wide move collapse + 100ms burst detection.
 *
 * Kaynak: Referans/cstimer-master/src/js/lib/cubeutil.js:254-321
 *
 * Davranis:
 *   - Same-axis collapse: R + R = R2, R + R' = (cancel), R + R2 = R', R2 + R2 = (cancel)
 *   - Slice merge (parallel-axis opposite-power): R + L' = M, R' + L = M', U + D' = E', vs.
 *   - 100ms burst detection: ardisik move'lar 100ms'den az aralikla yapildiysa slice
 *     merge dener. Daha uzun aralikta merge yok (kullanici dusunmus, slice yapmamis).
 *   - Center rotation tracking: M/E/S move sonrasi cube'un center pozisyonlari degisir,
 *     sonraki move'lar bu degismis pozisyonlara gore yorumlanir.
 *
 * Sadece face turns (URFDLB) input olarak kabul edilir. Wide moves (Rw, r),
 * cube rotations (x/y/z), slices (M/E/S input olarak), 'NONE' veya bos string'ler
 * pass-through olarak output'a eklenir, collapse logic'ine girmez.
 */

export interface TimedMove {
	turn: string;
	timestamp: number;
}

const FACE_CHARS = 'URFDLB';
const POW_CHARS = " 2'";
const OUTPUT_CHARS = 'URFDLBEMS';

// Center rotation lookup — cstimer cubeutil.js:254-258 birebir.
const CENTER_ROT: number[][] = [
	[0, 2, 4, 3, 5, 1], // axisM=0 (E slice / y' rotation)
	[5, 1, 0, 2, 4, 3], // axisM=1 (M slice / x' rotation)
	[4, 0, 2, 1, 3, 5], // axisM=2 (S slice / z rotation)
];

// powM hesabi icin sign tablosu — cstimer cubeutil.js:301
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
 * cstimer getPrettyMoves birebir port. Tek bir move sequence'i icin.
 *
 * Pass-through pattern: non-URFDLB move'lar (Rw, M, x, y2, vs.) collapse logic'ine
 * girmez. Cstimer pure URFDLB bekler — bizdeki engine bazen wide/slice gonderebilir.
 * Bu durumda non-collapsible move'lar kanonik output'ta yer alir, ardisik collapsible
 * grubu mevcut center state'iyle isler ama pass-through ile arada kirilir.
 *
 * @param moves Per-move timestamp'li dizi.
 * @returns cstimer notation string (orn "R U' R'", "M U' M'", "R U R' L").
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
 * cstimer cubeutil.js:290-314 birebir port. Bir face-turn-only sequence'i isler,
 * collapse + slice merge yapar, encoded ret array'i doner. center array mutable.
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
			i++; // sonraki move merge edildi, atla
			continue;
		}

		pushSol(axis, pow);
	}

	return ret;
}

// cstimer raw output ' '/'2'/"'" suffix kullanir — space'siz prime+face
// kombinasyonlari olusur ("R'L'"). Format'i space-aware yap (her move arasinda
// tek space) — algoritma cstimer ile birebir, sadece son string formatting daha
// okunaklı/parse edilebilir.
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
 * Convenience: timestamp olmayan caller'lar icin. Tum move'lar tek burst kabul edilir
 * (timestamp 0, burst threshold asilmaz).
 */
export function getPrettyMovesFromStrings(moves: string[]): string {
	const timed: TimedMove[] = moves.map((turn) => ({ turn, timestamp: 0 }));
	return getPrettyMoves(timed);
}
