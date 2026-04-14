/**
 * Skewb + Ivy Cube scramble generator — random-state solver.
 * Ported from cstimer skewb.js (GPLv3)
 *
 * Supports: skbso (WCA), skbo (optimal), skbnb (no bar), ivyso, ivyo
 */

import { Coord, Solver, acycle, fillFacelet, rn } from '../lib/mathlib';
import { registerGenerator } from '../registry';

// ==================== Facelets ====================

const fixedCorn = [
	[4, 16, 7],
	[1, 11, 22],
	[26, 14, 8],
	[29, 19, 23]
];

const twstCorn = [
	[3, 6, 12],
	[2, 21, 17],
	[27, 9, 18],
	[28, 24, 13]
];

// ==================== Coordinates ====================

const ctcord = new Coord('p', 6, -1);
const cpcord = new Coord('p', 4, -1);
const ftcord = new Coord('o', 4, 3);
const twcord = new Coord('o', 4, -3);

// ==================== Move Definitions ====================

const moveCenters = [
	[0, 3, 1],
	[0, 2, 4],
	[1, 5, 2],
	[3, 4, 5]
];

const moveCorners = [
	[0, 1, 2],
	[0, 3, 1],
	[0, 2, 3],
	[1, 3, 2]
];

function ctcpMove(idx: number, m: number): number {
	const corner = cpcord.set([], idx % 12);
	const center = ctcord.set([], ~~(idx / 12));
	acycle(center, moveCenters[m]);
	acycle(corner, moveCorners[m]);
	return ctcord.get(center) * 12 + cpcord.get(corner);
}

function twstMove(idx: number, move: number): number {
	const fixedtwst = ftcord.set([], idx % 81);
	const twst = twcord.set([], ~~(idx / 81));
	fixedtwst[move]++;
	acycle(twst, moveCorners[move], 1, [0, 2, 1, 3]);
	return twcord.get(twst) * 81 + ftcord.get(fixedtwst);
}

// ==================== Solvers ====================

const solv = new Solver(4, 2, [
	[0, ctcpMove, 4320],
	[0, twstMove, 2187]
]);

const solvivy = new Solver(4, 2, [
	[0, (idx: number, m: number) => ~~(ctcpMove(idx * 12, m) / 12), 360],
	[0, (idx: number, m: number) => twstMove(idx, m) % 81, 81]
]);

// ==================== No Bar Check ====================

function checkNoBar(perm: number, twst: number): boolean {
	const corner = cpcord.set([], perm % 12);
	const center = ctcord.set([], ~~(perm / 12));
	const fixedtwst = ftcord.set([], twst % 81);
	const tw = twcord.set([], ~~(twst / 81));
	const f: number[] = [];
	for (let i = 0; i < 6; i++) {
		f[i * 5] = center[i];
	}
	fillFacelet(fixedCorn, f, [0, 1, 2, 3], fixedtwst, 5);
	fillFacelet(twstCorn, f, corner, tw, 5);
	for (let i = 0; i < 30; i += 5) {
		for (let j = 1; j < 5; j++) {
			if (f[i] === f[i + j]) {
				return false;
			}
		}
	}
	return true;
}

// ==================== Solution to String ====================

function sol2str(sol: number[][]): string {
	const ret: string[] = [];
	const move2str = ['L', 'R', 'B', 'U'];
	for (let i = 0; i < sol.length; i++) {
		const axis = sol[i][0];
		const pow = 1 - sol[i][1];
		if (axis === 2) {
			// step two — rotate move names
			const tmp = move2str.slice();
			acycle(tmp as any, [0, 3, 1], pow + 1);
			for (let k = 0; k < 4; k++) move2str[k] = (tmp as any)[k];
		}
		ret.push(move2str[axis] + (pow === 1 ? "'" : ''));
	}
	return ret.join(' ');
}

// ==================== Scramble Generation ====================

const ori = [0, 1, 2, 0, 2, 1, 1, 2, 0, 2, 1, 0];

function getSkewbScramble(type: string): string {
	const lim = type === 'skbso' ? 6 : 2;
	const minl = type === 'skbo' ? 0 : 8;
	let perm: number, twst: number;
	do {
		perm = rn(4320);
		twst = rn(2187);
	} while (
		(perm === 0 && twst === 0) ||
		ori[perm % 12] !== (twst + ~~(twst / 3) + ~~(twst / 9) + ~~(twst / 27)) % 3 ||
		solv.search([perm, twst], 0, lim) != null ||
		(type === 'skbnb' && !checkNoBar(perm, twst))
	);
	return sol2str(solv.search([perm, twst], minl)!.reverse());
}

function getIvyScramble(type: string): string {
	const maxl = type === 'ivyso' ? 6 : 0;
	let perm: number, twst: number;
	do {
		perm = rn(360);
		twst = rn(81);
	} while (perm === 0 && twst === 0 || solvivy.search([perm, twst], 0, 1) != null);
	return solvivy.toStr(solvivy.search([perm, twst], maxl)!.reverse(), 'RLDB', "' ");
}

// ==================== Registration ====================

registerGenerator(['skbo', 'skbso', 'skbnb'], (typeId) => getSkewbScramble(typeId));
registerGenerator(['ivyo', 'ivyso'], (typeId) => getIvyScramble(typeId));
