/**
 * Pyraminx scramble generator — random-state solver.
 * Ported from cstimer pyraminx.js (GPLv3)
 *
 * Supports: pyrso (WCA), pyro (optimal), pyrnb (no bar), pyr4c (4-tip)
 * Master Pyraminx (mpyrso) is separate — requires much larger tables, deferred.
 */

import { Coord, Solver, acycle, fillFacelet, rn, setNPerm, getNPerm, setNOri } from '../lib/mathlib';
import { registerGenerator } from '../registry';

// ==================== Facelets ====================

const cFacelet = [
	[3, 16, 11],
	[4, 23, 15],
	[5, 9, 22],
	[10, 17, 21]
];

const eFacelet = [
	[1, 7],
	[2, 14],
	[0, 18],
	[6, 12],
	[8, 20],
	[13, 19]
];

// ==================== Coordinates ====================

const eocoord = new Coord('o', 6, -2);
const epcoord = new Coord('p', 6, -1);
const cocoord = new Coord('o', 4, 3);

// ==================== Move Definitions ====================

const movePieces = [
	[0, 1, 3],
	[1, 2, 5],
	[0, 4, 2],
	[3, 5, 4]
];

const moveOris: (number[] | null)[] = [
	[0, 1, 0, 2],
	[0, 1, 0, 2],
	[0, 0, 1, 2],
	[0, 0, 1, 2]
];

function epermMove(arr: number[], m: number): void {
	acycle(arr, movePieces[m]);
}

function oriMove(a: number, c: number): number {
	const edgeOri = eocoord.set([], a & 0x1f);
	const cornOri = cocoord.set([], a >> 5);
	cornOri[c]++;
	acycle(edgeOri, movePieces[c], 1, moveOris[c]);
	return cocoord.get(cornOri) << 5 | eocoord.get(edgeOri);
}

// ==================== Solver ====================

const solv = new Solver(4, 2, [
	[0, [epermMove, 'p', 6, -1], 360],
	[0, oriMove, 2592]
]);

// ==================== No Bar Check ====================

function checkNoBar(perm: number, ori: number): boolean {
	const edgeOri = eocoord.set([], ori & 0x1f);
	const cornOri = cocoord.set([], ori >> 5);
	const edgePerm = epcoord.set([], perm);
	const f: number[] = [];
	fillFacelet(cFacelet, f, [0, 1, 2, 3], cornOri, 6);
	fillFacelet(eFacelet, f, edgePerm, edgeOri, 6);
	const pieces = [4, 2, 3, 1, 5, 0];
	for (let i = 0; i < 6; i++) {
		for (let j = 0; j < 2; j++) {
			const p1 = eFacelet[i][0 ^ j];
			const p2 = eFacelet[i][1 ^ j];
			const nb1 = ~~(p1 / 6) * 6 + pieces[(pieces.indexOf(p1 % 6) + 5) % 6];
			const nb2 = ~~(p2 / 6) * 6 + pieces[(pieces.indexOf(p2 % 6) + 1) % 6];
			if (f[nb1] === f[p1] && f[nb2] === f[p2]) {
				return false;
			}
		}
	}
	return true;
}

// ==================== Scramble Generation ====================

function getScramble(type: string): string {
	let perm: number;
	let ori: number;
	const minl = type === 'pyro' ? 0 : 8;
	const limit = 7;

	let len: number;
	let sol: string;

	do {
		if (type === 'pyrnb') {
			do {
				perm = rn(360);
				ori = rn(2592);
			} while (!checkNoBar(perm, ori));
		} else {
			perm = rn(360);
			ori = rn(2592);
		}

		len = solv.search([perm, ori], 0)!.length;
		sol = solv.toStr(solv.search([perm, ori], minl)!.reverse(), 'ULRB', "' ") + ' ';

		// Add tip moves
		for (let i = 0; i < 4; i++) {
			const r = rn(type === 'pyr4c' ? 2 : 3);
			if (r < 2) {
				sol += 'lrbu'[i] + [' ', "' "][r];
				len++;
			}
		}
	} while (len < limit);

	return sol.replace(/ +/g, ' ').trim();
}

// ==================== Registration ====================

function pyraminxGenerator(typeId: string): string {
	return getScramble(typeId);
}

registerGenerator(['pyro', 'pyrso', 'pyrnb', 'pyr4c'], pyraminxGenerator);
