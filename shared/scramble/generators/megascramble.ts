/**
 * Random-move scramble generators.
 * Ported from cstimer megascramble.js (GPLv3)
 *
 * Contains:
 * - mega() — core random-move generator with axis tracking
 * - formatScramble() — template engine (${333} and #{...} substitution)
 * - args table — NxN cubes (4x4-7x7 WCA/SiGN), cuboids, gear, floppy, etc.
 * - edge() — big cube edge pairing scrambles
 * - Relay composites (r234, r2345, rmngf, etc.)
 * - BLD orientation suffixes (333ni, 444bld, 555bld)
 */

import { rn, rndEl } from '../lib/mathlib';
import { registerGenerator, generateScramble } from '../registry';

const cubesuff = ['', '2', "'"];
const minxsuff = ['', '2', "'", "2'"];

// ==================== mega() — Core Random-Move Generator ====================

export function mega(
	turns: (string | string[])[][],
	suffixes: string[] | 0,
	length: number
): string {
	turns = turns || [['']];
	const sufArr: string[] = (suffixes === 0 || !suffixes) ? [] : suffixes;
	length = length || 0;
	let donemoves = 0;
	let lastaxis = -1;
	const s: string[] = [];
	for (let i = 0; i < length; i++) {
		let first: number, second: number;
		do {
			first = rn(turns.length);
			second = rn(turns[first].length);
			if (first !== lastaxis) {
				donemoves = 0;
				lastaxis = first;
			}
		} while (((donemoves >> second) & 1) !== 0);
		donemoves |= 1 << second;
		const turn = turns[first][second];
		const suf = sufArr.length > 0 ? rndEl(sufArr) : '';
		if (Array.isArray(turn)) {
			s.push(rndEl(turn) + suf);
		} else {
			s.push(turn + suf);
		}
	}
	return s.join(' ');
}

// ==================== args table — Puzzle definitions ====================

type MegaArgs = [(string | string[])[][], string[] | 0] | [(string | string[])[][], string[] | 0, number];

const args: Record<string, MegaArgs> = {
	'333o': [[['U', 'D'], ['R', 'L'], ['F', 'B']], cubesuff],
	'444': [[['U', 'D', 'u'], ['R', 'L', 'r'], ['F', 'B', 'f']], cubesuff],
	'444m': [[['U', 'D', 'Uw'], ['R', 'L', 'Rw'], ['F', 'B', 'Fw']], cubesuff],
	'555': [[['U', 'D', 'u', 'd'], ['R', 'L', 'r', 'l'], ['F', 'B', 'f', 'b']], cubesuff],
	'555wca': [[['U', 'D', 'Uw', 'Dw'], ['R', 'L', 'Rw', 'Lw'], ['F', 'B', 'Fw', 'Bw']], cubesuff],
	'666p': [[['U', 'D', '2U', '2D', '3U'], ['R', 'L', '2R', '2L', '3R'], ['F', 'B', '2F', '2B', '3F']], cubesuff],
	'666wca': [[['U', 'D', 'Uw', 'Dw', '3Uw'], ['R', 'L', 'Rw', 'Lw', '3Rw'], ['F', 'B', 'Fw', 'Bw', '3Fw']], cubesuff],
	'666si': [[['U', 'D', 'u', 'd', '3u'], ['R', 'L', 'r', 'l', '3r'], ['F', 'B', 'f', 'b', '3f']], cubesuff],
	'777p': [[['U', 'D', '2U', '2D', '3U', '3D'], ['R', 'L', '2R', '2L', '3R', '3L'], ['F', 'B', '2F', '2B', '3F', '3B']], cubesuff],
	'777wca': [[['U', 'D', 'Uw', 'Dw', '3Uw', '3Dw'], ['R', 'L', 'Rw', 'Lw', '3Rw', '3Lw'], ['F', 'B', 'Fw', 'Bw', '3Fw', '3Bw']], cubesuff],
	'777si': [[['U', 'D', 'u', 'd', '3u', '3d'], ['R', 'L', 'r', 'l', '3r', '3l'], ['F', 'B', 'f', 'b', '3f', '3b']], cubesuff],
	'RrUu': [[['U', 'u'], ['R', 'r']], cubesuff],
	'minx2g': [[['U'], ['R']], minxsuff],          // Megaminx 2-gen (R, U)
};

// Default lengths for mega-based scrambles
const defaultLengths: Record<string, number> = {
	'333o': 25,
	'444': 40, '444m': 40,
	'555': 60, '555wca': 60,
	'666p': 80, '666wca': 80, '666si': 80,
	'777p': 100, '777wca': 100, '777si': 100,
	'RrUu': 25,
	'minx2g': 30,
};

function megascramble(type: string, len?: number): string {
	const value = args[type];
	if (!value) return '';
	const length = len || defaultLengths[type] || 25;
	if (value.length >= 3) {
		return mega(value[0], value[1], value[2] as number);
	}
	return mega(value[0], value[1], length);
}

// ==================== formatScramble() — Template Engine ====================

export function formatScramble(str: string): string {
	const re1 = /[$#]\{([^}]+)\}/g;
	return str.replace(re1, (match, p1) => {
		if (match[0] === '$') {
			let scrArgs = [p1];
			if (p1[0] === '[') {
				scrArgs = JSON.parse(p1);
			}
			return generateScramble(scrArgs[0], scrArgs[1]);
		} else if (match[0] === '#') {
			const parsed = JSON.parse('[' + p1 + ']');
			return mega(parsed[0], parsed[1], parsed[2]);
		}
		return '';
	});
}

// ==================== Format-based scramble types (args2) ====================

const args2: Record<string, string> = {
	'333ni': '${333}#{[[""]],["","Rw ","Rw2 ","Rw\' ","Fw ","Fw\' "],1}#{[[""]],["","Uw","Uw2","Uw\'"],1}',
	'444bld': '${444m}#{[[""]],[""," x"," x2"," x\'"," z"," z\'"],1}#{[[""]],[""," y"," y2"," y\'"],1}',
	'555bld': '${["555wca",%l]}#{[[""]],[""," 3Rw"," 3Rw2"," 3Rw\'"," 3Fw"," 3Fw\'"],1}#{[[""]],[""," 3Uw"," 3Uw2"," 3Uw\'"],1}',
};

const formatDefaultLengths: Record<string, number> = {
	'333ni': 0,
	'444bld': 0,
	'555bld': 60,
};

function formatScrambleType(type: string, len?: number): string {
	const length = len || formatDefaultLengths[type] || 25;
	const template = args2[type].replace(/%l/g, String(length)).replace(/%c/g, '["","2","\'"]');
	return formatScramble(template);
}

// ==================== Edge scrambles (big cubes) ====================

function edge(start: string, endMoves: string[], moves: string[], len: number): string {
	let u = 0, d = 0;
	const movemis: number[] = [];
	const triggers = [['R', "R'"], ["R'", 'R'], ['L', "L'"], ["L'", 'L'], ["F'", 'F'], ['F', "F'"], ["B'", 'B'], ['B', "B'"]];
	const ud = ['U', 'D'];
	let scramble = start;
	for (let i = 0; i < moves.length; i++) movemis[i] = 0;

	for (let i = 0; i < len; i++) {
		let done = false;
		let v = '';
		while (!done) {
			v = '';
			for (let j = 0; j < moves.length; j++) {
				const x = rn(4);
				movemis[j] += x;
				if (x !== 0) {
					done = true;
					v += ' ' + moves[j] + cubesuff[x - 1];
				}
			}
		}
		const trigger = rn(8);
		const layer = rn(2);
		const turn = rn(3);
		scramble += v + ' ' + triggers[trigger][0] + ' ' + ud[layer] + cubesuff[turn] + ' ' + triggers[trigger][1];
		if (layer === 0) u += turn + 1;
		if (layer === 1) d += turn + 1;
	}

	for (let i = 0; i < moves.length; i++) {
		const x = 4 - (movemis[i] % 4);
		if (x < 4) scramble += ' ' + moves[i] + cubesuff[x - 1];
	}
	u = 4 - (u % 4);
	d = 4 - (d % 4);
	if (u < 4) scramble += ' U' + cubesuff[u - 1];
	if (d < 4) scramble += ' D' + cubesuff[d - 1];
	scramble += ' ' + rndEl(endMoves);
	return scramble;
}

const edges: Record<string, [string, string[], string[]]> = {
	'5edge': ['r R b B', ["B' b' R' r'", "B' b' R' U2 r U2 r U2 r U2 r"], ['u', 'd']],
	'6edge': ['3r r 3b b', ["3b' b' 3r' r'", "3b' b' 3r' U2 r U2 r U2 r U2 r", "3b' b' r' U2 3r U2 3r U2 3r U2 3r", "3b' b' r2 U2 3r U2 3r U2 3r U2 3r U2 r"], ['u', '3u', 'd']],
	'7edge': ['3r r 3b b', ["3b' b' 3r' r'", "3b' b' 3r' U2 r U2 r U2 r U2 r", "3b' b' r' U2 3r U2 3r U2 3r U2 3r", "3b' b' r2 U2 3r U2 3r U2 3r U2 3r U2 r"], ['u', '3u', '3d', 'd']],
};

const edgeDefaultLengths: Record<string, number> = {
	'5edge': 8,
	'6edge': 8,
	'7edge': 10,
};

function edgescramble(type: string, len?: number): string {
	const value = edges[type];
	const length = len || edgeDefaultLengths[type] || 8;
	return edge(value[0], value[1], value[2], length);
}


// ==================== Registration ====================

// mega-based types
for (const type in args) {
	registerGenerator(type, (typeId, len) => megascramble(typeId, len));
}

// format-based types
for (const type in args2) {
	registerGenerator(type, (typeId, len) => formatScrambleType(typeId, len));
}

// edge scrambles
for (const type in edges) {
	registerGenerator(type, (typeId, len) => edgescramble(typeId, len));
}
