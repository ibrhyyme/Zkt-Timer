// Cube notation can carry n quarters in a single move: U2, U3, U4...
// cubejs only supports U/U'/U2 — U3 throws. This util expands arbitrary-n notation
// to raw quarter list (U3 → "U U U") so cubejs / stats code works unmodified. TwistyPlayer natively supports Un, expand is unnecessary there.

const QUARTER_RE = /^([UDLRFBudlrfbMESxyz])(\d+)?([''])?$/;

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
 * Converts a single move (U3, U2', U4...) to a single-quarter sequence.
 * U3 → "U U U" | U2' → "U' U'" | U → "U" | U4 → "U U U U"
 * Undefined moves (e.g. rotation not in cubejs) remain as-is.
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
