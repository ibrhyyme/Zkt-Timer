/**
 * Smart cube move sequence parse/serialize utility.
 *
 * Two formats are supported:
 *
 * 1. Legacy JSON array (backward compatibility):
 *    `[{"turn":"R","completedAt":1234,"cubeTimestamp":12,"localTimestamp":1234},...]`
 *
 * 2. New cstimer compact format (~88% less space):
 *    `"R@1234 U@1567 R'@2103 U'@2456 F2@2890"`
 *    Each segment: `<turn>@<ms_offset_from_start>`, separated by spaces.
 *
 * New solves are written in compact format, legacy JSON arrays remain parseable.
 */

export interface ParsedTurn {
	turn: string;
	completedAt: number;
}

export function parseSmartTurns(input: string | null | undefined): ParsedTurn[] {
	if (!input) return [];

	// Legacy JSON format
	if (input.charAt(0) === '[') {
		try {
			const arr = JSON.parse(input);
			if (!Array.isArray(arr)) return [];
			return arr
				.filter((t: any) => t && typeof t.turn === 'string')
				.map((t: any) => ({
					turn: t.turn,
					completedAt: typeof t.completedAt === 'number' ? t.completedAt : 0,
				}));
		} catch {
			return [];
		}
	}

	// New compact format: "R@1234 U@1567 ..."
	return input
		.split(' ')
		.filter((s) => s && s.indexOf('@') > 0)
		.map((part) => {
			const idx = part.lastIndexOf('@');
			return {
				turn: part.substring(0, idx),
				completedAt: parseInt(part.substring(idx + 1), 10) || 0,
			};
		});
}

/**
 * Serializes moves to compact format.
 * `startMs` = reference time (timer start). Each move is written as an offset from this time.
 * If startMs=0 is provided, `completedAt` is written as absolute milliseconds.
 */
export function serializeSmartTurnsCompact(turns: ParsedTurn[], startMs: number = 0): string {
	return turns
		.map((t) => `${t.turn}@${Math.round(t.completedAt - startMs)}`)
		.join(' ');
}
