// Cube notation tek bir hamlede n quarter taşıyabilir: U2, U3, U4...
// cubejs sadece U/U'/U2 destekler — U3 throw eder. Bu util keyfi-n notation'i
// ham quarter listesine acar (U3 → "U U U") oyle ki cubejs / istatistik kodu
// bozulmadan calisir. TwistyPlayer Un native destekler, expand orada gereksiz.

const QUARTER_RE = /^([UDLRFBudlrfbMESxyz])(\d+)?(['‘])?$/;

export interface ParsedMove {
	face: string;
	quarters: number;
}

export function parseMove(move: string): ParsedMove | null {
	const m = move.match(QUARTER_RE);
	if (!m) return null;
	const [, face, count, prime] = m;
	const n = parseInt(count || '1', 10);
	if (n <= 0) return null;
	return { face, quarters: prime ? -n : n };
}

export function quartersToNotation(face: string, quarters: number): string {
	if (quarters === 0) return '';
	if (quarters === 1) return face;
	if (quarters === -1) return face + "'";
	if (quarters > 0) return face + quarters;
	return face + Math.abs(quarters) + "'";
}

/**
 * Tek hamleyi (U3, U2', U4...) tek-quarter dizisine cevirir.
 * U3 → "U U U" | U2' → "U' U'" | U → "U" | U4 → "U U U U"
 * Tanimsiz hamleler (orn rotation cubejs'te yok) olduklari gibi kalir.
 */
export function expandMove(move: string): string {
	const parsed = parseMove(move);
	if (!parsed) return move;
	const single = parsed.quarters > 0
		? parsed.face
		: parsed.face + "'";
	const count = Math.abs(parsed.quarters);
	return Array(count).fill(single).join(' ');
}

export function expandNotation(moves: string): string {
	if (!moves) return moves;
	return moves
		.trim()
		.split(/\s+/)
		.map(expandMove)
		.filter(Boolean)
		.join(' ');
}
