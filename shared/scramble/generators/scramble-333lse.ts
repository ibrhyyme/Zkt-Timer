/**
 * 3x3 LSE (Last Six Edges) scramble generator — <M,U> Roux.
 * Ported from cstimer 333lse.js (GPLv3)
 *
 * Supports: lsemu
 */

import { Solver, getNParity, setNPerm, getNPerm, acycle } from '../lib/mathlib';
import { registerGenerator } from '../registry';

const edgePerms = [
	[0, 1, 2, 3],
	[0, 2, 5, 4]
];

const edgeOris: (number[] | null)[] = [
	[0, 0, 0, 0, 2],
	[0, 1, 0, 1, 2]
];

function doPermMove(idx: number, m: number): number {
	const edge = idx >> 3;
	const corn = idx;
	const cent = idx << 1 | (getNParity(edge, 6) ^ ((corn >> 1) & 1));
	const g = setNPerm([], edge, 6);
	acycle(g, edgePerms[m]);
	let newCorn = corn;
	let newCent = cent;
	if (m === 0) newCorn = corn + 2;
	if (m === 1) newCent = cent + 1;
	return (getNPerm(g, 6) << 3) | (newCorn & 6) | ((newCent >> 1) & 1);
}

function doOriMove(arr: number[], m: number): void {
	acycle(arr, edgePerms[m], 1, edgeOris[m]);
}

const solv = new Solver(2, 3, [
	[0, doPermMove, 5760],
	[0, [doOriMove, 'o', 6, -2], 32]
]);

function generateScramble(): string {
	let c: number, b: number;
	do {
		c = Math.floor(Math.random() * 5760);
		b = Math.floor(Math.random() * 32);
	} while (b + c === 0);
	return solv.toStr(solv.search([c, b], 0)!, 'UM', " 2'").replace(/ +/g, ' ');
}

registerGenerator('lsemu', () => generateScramble());
