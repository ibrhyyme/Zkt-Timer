import type { VrcMove } from './types';

/**
 * Touch gesture map. Port of `getTouchMoves` (twistynnn.js:610-693).
 *
 * cstimer's answer to mobile is not an on-screen keypad. It overlays an invisible
 * 3x3 grid on the cube and reads a swipe from one cell to another:
 *
 *     1 2 3
 *     4 5 6
 *     7 8 9
 *
 * The gesture key is `from * 10 + to`. Edge swipes turn the adjacent face (6->3
 * is R, 3->2 is U), swipes through the centre are whole-cube rotations (5->2 is
 * x), and diagonals from the centre are wide moves (5->1 is u).
 *
 * The label in each entry is what the UI paints on the target cell while a drag
 * is in progress, which is what makes the scheme self-teaching.
 */

export interface TouchMove {
	label: string;
	move: VrcMove;
}

export function getTouchMoves(oSl: number, oSr: number, iSi: number): Record<number, TouchMove> {
	const t = (label: string, move: VrcMove): TouchMove => ({ label, move });

	return {
		61: t('u2', [1, 2, 'U', 2]),
		62: t('B', [1, 1, 'B', 1]),
		63: t('R', [1, oSr, 'R', 1]),
		64: t('y2', [1, iSi, 'U', 2]),
		65: t('y', [1, iSi, 'U', 1]),
		67: t('F2', [1, 1, 'F', 2]),
		68: t('M', [oSr + 1, oSr + 1, 'R', -1]),
		69: t('F', [1, 1, 'F', 1]),

		41: t("L'", [1, oSl, 'L', -1]),
		42: t("B'", [1, 1, 'B', -1]),
		43: t("u2'", [1, 2, 'U', -2]),
		45: t("y'", [1, iSi, 'U', -1]),
		46: t("y2'", [1, iSi, 'U', -2]),
		47: t("F'", [1, 1, 'F', -1]),
		48: t('M', [oSl + 1, oSl + 1, 'L', 1]),
		49: t("F2'", [1, 1, 'F', -2]),

		31: t('U2', [1, 1, 'U', 2]),
		32: t('U', [1, 1, 'U', 1]),
		34: t('u2', [1, 2, 'U', 2]),
		35: t('u', [1, 2, 'U', 1]),
		36: t("R'", [1, oSr, 'R', -1]),
		37: t("z'", [1, iSi, 'F', -1]),
		38: t('M2', [oSr + 1, oSr + 1, 'R', -2]),
		39: t("R2'", [1, oSr, 'R', -2]),

		12: t("U'", [1, 1, 'U', -1]),
		13: t("U2'", [1, 1, 'U', -2]),
		14: t('L', [1, oSl, 'L', 1]),
		15: t("u'", [1, 2, 'U', -1]),
		16: t("u2'", [1, 2, 'U', -2]),
		17: t('L2', [1, oSl, 'L', 2]),
		18: t('M2', [oSl + 1, oSl + 1, 'L', 2]),
		19: t('z', [1, iSi, 'F', 1]),

		91: t("z'", [1, iSi, 'F', -1]),
		92: t('B2', [1, 1, 'B', 2]),
		93: t('R2', [1, oSr, 'R', 2]),
		94: t("F2'", [1, 1, 'F', -2]),
		95: t('r', [1, oSr + 1, 'R', 1]),
		96: t("F'", [1, 1, 'F', -1]),
		97: t("D2'", [1, 1, 'D', -2]),
		98: t("D'", [1, 1, 'D', -1]),

		73: t('z', [1, iSi, 'F', 1]),
		72: t("B2'", [1, 1, 'B', -2]),
		71: t("L2'", [1, oSl, 'L', -2]),
		76: t('F2', [1, 1, 'F', 2]),
		75: t("l'", [1, oSl + 1, 'L', -1]),
		74: t('F', [1, 1, 'F', 1]),
		79: t('D2', [1, 1, 'D', 2]),
		78: t('D', [1, 1, 'D', 1]),

		21: t('U', [1, 1, 'U', 1]),
		23: t("U'", [1, 1, 'U', -1]),
		24: t('B', [1, 1, 'B', 1]),
		25: t("x'", [1, iSi, 'R', -1]),
		26: t("B'", [1, 1, 'B', -1]),
		27: t('B2', [1, 1, 'B', 2]),
		28: t("x2'", [1, iSi, 'R', -2]),
		29: t("B2'", [1, 1, 'B', -2]),

		51: t('u', [1, 2, 'U', 1]),
		52: t('x', [1, iSi, 'R', 1]),
		53: t("u'", [1, 2, 'U', -1]),
		54: t('y', [1, iSi, 'U', 1]),
		56: t("y'", [1, iSi, 'U', -1]),
		57: t('l', [1, oSl + 1, 'L', 1]),
		58: t("x'", [1, iSi, 'R', -1]),
		59: t("r'", [1, oSr + 1, 'R', -1]),

		81: t("M2'", [oSl + 1, oSl + 1, 'L', -2]),
		82: t('x2', [1, iSi, 'R', 2]),
		83: t("M2'", [oSr + 1, oSr + 1, 'R', 2]),
		84: t("M'", [oSl + 1, oSl + 1, 'L', -1]),
		85: t('x', [1, iSi, 'R', 1]),
		86: t("M'", [oSr + 1, oSr + 1, 'R', 1]),
		87: t("D'", [1, 1, 'D', -1]),
		89: t('D', [1, 1, 'D', 1]),
	};
}

/** How long the grid outline stays visible after a touch. twisty.js `hintBoard`. */
export const HINT_BOARD_MS = 5000;
