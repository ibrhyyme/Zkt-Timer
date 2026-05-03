/**
 * Smart cube hamle dizisi parse/serialize utility.
 *
 * Iki format desteklenir:
 *
 * 1. Eski JSON array (geriye donuk uyumluluk):
 *    `[{"turn":"R","completedAt":1234,"cubeTimestamp":12,"localTimestamp":1234},...]`
 *
 * 2. Yeni cstimer compact format (~%88 daha az yer):
 *    `"R@1234 U@1567 R'@2103 U'@2456 F2@2890"`
 *    Her segment: `<turn>@<ms_offset_from_start>`, bosluk ile ayrilmis.
 *
 * Yeni solve'lar compact format ile yazilir, eski JSON'lar parse edilebilir kalir.
 */

export interface ParsedTurn {
	turn: string;
	completedAt: number;
}

export function parseSmartTurns(input: string | null | undefined): ParsedTurn[] {
	if (!input) return [];

	// Eski JSON format
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

	// Yeni compact format: "R@1234 U@1567 ..."
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
 * Hamleleri compact format'a serialize eder.
 * `startMs` = referans zaman (timer start). Her hamle bu zamandan offset olarak yazilir.
 * Eger startMs=0 verilirse `completedAt` mutlak ms olarak yazilir.
 */
export function serializeSmartTurnsCompact(turns: ParsedTurn[], startMs: number = 0): string {
	return turns
		.map((t) => `${t.turn}@${Math.round(t.completedAt - startMs)}`)
		.join(' ');
}
