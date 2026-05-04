/**
 * Move counter — cstimer-grade HTM/OBTM/ETM/STM hesabi.
 *
 * cstimer recons.js (GPL v3) MoveCounterHTM/MoveCounterLFMC siniflarindan birebir port.
 * Lisans: cstimer GPL v3 — direkt port, header'da credit.
 *
 * Metrik tanimlari:
 *   HTM (Half Turn Metric): cstimer-style — paralel duzlem mantigi.
 *     Ardisik paralel duzlemde ayni yuze tekrarli hamleler 1 hamle sayilir.
 *     Ornek: R R = 1 (R2 esdeger), R L = 2, R U R = 2 (yeni paralel grup), R U R' = 3.
 *
 *   OBTM (Outer Block Turn Metric): face + wide turns 1, slice/rotation 0.
 *     Burst counting yok — ham hamle sayisi.
 *
 *   ETM (Execution Turn Metric): face + wide + slice 1, rotation 0.
 *
 *   STM (Slice Turn Metric): face + slice 1, wide 1, rotation 0.
 *     (Outer Block + Slice ayri sayilir.)
 *
 * Move encoding (cstimer convention, URFDLB sirasi):
 *   axis 0=U, 1=R, 2=F, 3=D, 4=L, 5=B (face turns)
 *   axis 6=E, 7=M, 8=S (slice turns)
 *   axis%3 ile paralel duzlem belirlenir: 0=U-D-E, 1=R-L-M, 2=F-B-S
 *   Wide moves (Rw, r, vb.) outer face axis'ini paylasir
 *   Rotation (x, y, z) sayilmaz (axis = -1)
 *
 * Move integer = axis * 3 + power (power: 0=normal, 1=double, 2=prime).
 */

const FACE_AXIS_MAP: Record<string, number> = {
	U: 0, R: 1, F: 2, D: 3, L: 4, B: 5,
	// Wide moves outer face axis'i
	Uw: 0, Rw: 1, Fw: 2, Dw: 3, Lw: 4, Bw: 5,
	u: 0, r: 1, f: 2, d: 3, l: 4, b: 5,
	// Slice
	E: 6, M: 7, S: 8,
};

const ROTATION_BASES = new Set(['x', 'y', 'z']);
const FACE_BASES = new Set(['U', 'R', 'F', 'D', 'L', 'B']);
const WIDE_BASES = new Set(['Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw', 'u', 'r', 'f', 'd', 'l', 'b']);
const SLICE_BASES = new Set(['M', 'E', 'S']);

interface ParsedMove {
	base: string;
	power: number; // 0=normal, 1=double, 2=prime
}

function parseMove(move: string): ParsedMove | null {
	if (!move) return null;
	const trimmed = move.trim();
	if (!trimmed) return null;
	const m = trimmed.match(/^([URFDLB]w?|[urfdlb]|[MES]|[xyz])(['2]?)$/);
	if (!m) return null;
	const suffix = m[2];
	let power = 0;
	if (suffix === '2') power = 1;
	else if (suffix === "'") power = 2;
	return { base: m[1], power };
}

/**
 * Move'i cstimer integer encoding'ine cevirir. Rotation icin -1 doner.
 */
function encodeMove(base: string, power: number): number {
	if (ROTATION_BASES.has(base)) return -1;
	const axis = FACE_AXIS_MAP[base];
	if (axis === undefined) return -1;
	return axis * 3 + power;
}

export class MoveCounter {
	htm = 0;
	obtm = 0;
	etm = 0;
	stm = 0;
	moves: string[] = [];

	// HTM state — cstimer MoveCounterHTM
	private lastHtmMove = -3;
	private lastHtmPow = 0;

	push(move: string) {
		const parsed = parseMove(move);
		if (!parsed) return;
		const { base } = parsed;
		this.moves.push(move);

		const isRotation = ROTATION_BASES.has(base);
		if (isRotation) {
			// Rotation: hicbir metrik artmaz.
			return;
		}

		const isFace = FACE_BASES.has(base);
		const isWide = WIDE_BASES.has(base);
		const isSlice = SLICE_BASES.has(base);

		// OBTM/ETM/STM (cstimer-grade degil, basit ham sayim)
		if (isFace || isWide) {
			this.obtm += 1;
			this.stm += 1;
		} else if (isSlice) {
			this.stm += 1;
		}
		this.etm += 1; // face + wide + slice (rotation hariç) = ETM

		// HTM: cstimer MoveCounterHTM logic — paralel düzlem mantigi
		const moveInt = encodeMove(base, parsed.power);
		if (moveInt < 0) return;
		const axis = Math.floor(moveInt / 3);
		const amask = 1 << axis;
		if (axis % 3 !== this.lastHtmMove % 3) {
			this.lastHtmMove = axis;
			this.lastHtmPow = 0;
		}
		if ((this.lastHtmPow & amask) !== amask) {
			this.htm += 1;
		}
		this.lastHtmPow |= amask;
	}

	snapshot() {
		return {
			htm: this.htm,
			obtm: this.obtm,
			etm: this.etm,
			stm: this.stm,
		};
	}

	clear() {
		this.htm = 0;
		this.obtm = 0;
		this.etm = 0;
		this.stm = 0;
		this.moves = [];
		this.lastHtmMove = -3;
		this.lastHtmPow = 0;
	}

	clone(): MoveCounter {
		const c = new MoveCounter();
		c.htm = this.htm;
		c.obtm = this.obtm;
		c.etm = this.etm;
		c.stm = this.stm;
		c.moves = this.moves.slice();
		c.lastHtmMove = this.lastHtmMove;
		c.lastHtmPow = this.lastHtmPow;
		return c;
	}
}

/**
 * Verilen hamle dizisinin tum metriklerini doner.
 */
export function countMoves(moves: string[]) {
	const counter = new MoveCounter();
	for (const m of moves) counter.push(m);
	return counter.snapshot();
}

/**
 * cstimer-grade HTM hamle sayisi — projedeki tum turn count gosterimleri icin tek kaynak.
 */
export function countHTM(moves: string[]): number {
	return countMoves(moves).htm;
}

/**
 * Verilen hamle dizisi ve sure (saniye) icin TPS hesabi (HTM-bazli).
 */
export function calculateTPS(moves: string[], timeSeconds: number): number {
	if (timeSeconds <= 0) return 0;
	const htm = countHTM(moves);
	return Math.floor((htm / timeSeconds) * 100) / 100;
}
