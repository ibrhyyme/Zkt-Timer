/**
 * Utility scramble generators.
 * Ported from cstimer utilscramble.js (GPLv3)
 *
 * Contains: Clock variants (WCA/Old/w-o y2/Concise/Efficient/Jaap),
 * Megaminx variants (Pochmann/Carrot/Old Style/S2L), Pyraminx random-move,
 * SQ1 random-move.
 */

import { rn, rndEl } from '../lib/mathlib';
import { registerGenerator } from '../registry';
import { mega } from './megascramble';

const minxsuff = ['', '2', "'", "2'"];

// ==================== adjScramble — Adjacency-based random moves ====================

function adjScramble(
	faces: string[], adj: number[], len: number,
	suffixes?: string[], probs?: number[]
): string {
	suffixes = suffixes || [''];
	let used = 0;
	let face: number;
	const ret: string[] = [];
	for (let j = 0; j < len; j++) {
		do {
			face = probs ? rndProb(probs) : rn(faces.length);
		} while ((used >> face) & 1);
		ret.push(faces[face] + rndEl(suffixes));
		used &= ~adj[face];
		used |= 1 << face;
	}
	return ret.join(' ');
}

function rndProb(probs: number[]): number {
	let cum = 0;
	let curIdx = 0;
	for (let i = 0; i < probs.length; i++) {
		if (probs[i] === 0) continue;
		if (Math.random() < probs[i] / (cum + probs[i])) curIdx = i;
		cum += probs[i];
	}
	return curIdx;
}

// ==================== Clock Variants ====================

function clockC(s: string): string {
	const array = [s + '=0', s + '+1', s + '+2', s + '+3', s + '+4', s + '+5', s + '+6', s + '-5', s + '-4', s + '-3', s + '-2', s + '-1'];
	return ' ' + rndEl(array) + ' ';
}

function clockC2(): string {
	return rndEl(['U', 'd']) + rndEl(['U', 'd']);
}

function getClockWCA(type: string): string {
	const clkapp = ['0+', '1+', '2+', '3+', '4+', '5+', '6+', '1-', '2-', '3-', '4-', '5-'];
	let ret = type === 'clknf'
		? 'UR? DR? DL? UL? U(?,?) R(?,?) D(?,?) L(?,?) ALL? all?????'
		: 'UR? DR? DL? UL? U? R? D? L? ALL? y2 U? R? D? L? ALL?????';

	for (let i = 0; i < 14; i++) {
		ret = ret.replace('?', rndEl(clkapp));
	}
	if (type === 'clkwca') {
		ret = ret.slice(0, -4);
	}
	ret = ret
		.replace('?', rndEl(['', ' UR']))
		.replace('?', rndEl(['', ' DR']))
		.replace('?', rndEl(['', ' DL']))
		.replace('?', rndEl(['', ' UL']));
	return ret;
}

function getClockJaap(): string {
	return 'UU' + clockC('u') + 'dU' + clockC('u') + 'dd' + clockC('u') + 'Ud' + clockC('u')
		+ 'dU' + clockC('u') + 'Ud' + clockC('u') + 'UU' + clockC('u') + 'UU' + clockC('u')
		+ 'UU' + clockC('u') + 'dd     ' + clockC2()
		+ '\ndd' + clockC('d') + 'dU' + clockC('d') + 'UU' + clockC('d') + 'Ud' + clockC('d')
		+ 'UU     UU     Ud     dU     UU     dd' + clockC('d') + clockC2();
}

function getClockConcise(): string {
	let ret = '';
	for (let i = 0; i < 4; i++) ret += '(' + (rn(12) - 5) + ', ' + (rn(12) - 5) + ') / ';
	for (let i = 0; i < 6; i++) ret += '(' + (rn(12) - 5) + ') / ';
	for (let i = 0; i < 4; i++) ret += rndEl(['d', 'U']);
	return ret;
}

function getClockEfficient(): string {
	return 'UU' + clockC('u') + 'dU' + clockC('u') + 'dU' + clockC('u') + 'UU' + clockC('u')
		+ 'UU' + clockC('u') + 'UU' + clockC('u') + 'Ud' + clockC('u') + 'Ud' + clockC('u')
		+ 'dd' + clockC('u') + 'dd     ' + clockC2()
		+ '\nUU     UU     dU' + clockC('d') + 'dU     dd' + clockC('d') + 'Ud     Ud'
		+ clockC('d') + 'UU     UU' + clockC('d') + 'dd' + clockC('d') + clockC2();
}

// ==================== SQ1 Random-Move ====================

const sq1_p: number[] = [];

function sq1_domove(x: number, y: number): boolean {
	if (x === 7) {
		for (let i = 0; i < 6; i++) {
			const temp = sq1_p[i + 6];
			sq1_p[i + 6] = sq1_p[i + 12];
			sq1_p[i + 12] = temp;
		}
		return true;
	}
	if (sq1_p[(17 - x + 12) % 12] || sq1_p[(11 - x + 12) % 12] || sq1_p[12 + (17 - y + 12) % 12] || sq1_p[12 + (11 - y + 12) % 12]) {
		return false;
	}
	const px = sq1_p.slice(0, 12);
	const py = sq1_p.slice(12, 24);
	for (let i = 0; i < 12; i++) {
		sq1_p[i] = px[(12 + i - x) % 12];
		sq1_p[i + 12] = py[(12 + i - y) % 12];
	}
	return true;
}

function sq1_getseq(num: number, type: number, len: number): number[][][] {
	const seq: number[][][] = [];
	for (let n = 0; n < num; n++) {
		// Reset p
		for (let i = 0; i < 24; i++) {
			sq1_p[i] = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0][i];
		}
		seq[n] = [];
		let cnt = 0;
		while (cnt < len) {
			const x = rn(12) - 5;
			const y = type === 2 ? 0 : rn(12) - 5;
			const size = (x === 0 ? 0 : 1) + (y === 0 ? 0 : 1);
			if ((cnt + size <= len || type !== 1) && (size > 0 || cnt === 0)) {
				if (sq1_domove(x, y)) {
					if (type === 1) cnt += size;
					if (size > 0) seq[n].push([x, y]);
					if (cnt < len || type !== 1) {
						cnt++;
						seq[n].push([7, 0]);
						sq1_domove(7, 0);
					}
				}
			}
		}
	}
	return seq;
}

function sq1_scramble(type: number, len: number): string {
	const seq = sq1_getseq(1, type, len);
	let s = '';
	for (let i = 0; i < seq[0].length; i++) {
		const k = seq[0][i];
		if (k[0] === 7) {
			s += '/';
		} else {
			s += ' (' + k[0] + ',' + k[1] + ')';
		}
	}
	return s;
}

// ==================== Pochmann / Carrot ====================

function pochscramble(x: number, y: number): string {
	let ret = '';
	for (let i = 0; i < y; i++) {
		ret += '  ';
		for (let j = 0; j < x; j++) {
			ret += (j % 2 === 0 ? 'R' : 'D') + rndEl(['++', '--']) + ' ';
		}
		ret += 'U' + (ret.endsWith('-- ') ? "'" : '') + '\n';
	}
	return ret;
}

// ==================== Pyraminx Random-Move + Tips ====================

function addPyrTips(scramble: string, moveLen: number): string {
	let cnt = 0;
	const rnd: (string | number)[] = [];
	for (let i = 0; i < 4; i++) {
		const r = rn(3);
		if (r > 0) {
			rnd[i] = 'ulrb'[i] + [' ', "' "][r - 1];
			cnt++;
		} else {
			rnd[i] = '';
		}
	}
	return scramble.substr(0, scramble.length - moveLen * cnt) + ' ' + rnd.join('');
}

// ==================== Registration ====================

function utilscramble(type: string, len?: number): string {
	const length = len || 0;
	switch (type) {
		case 'clkwca':
		case 'clkwcab':
		case 'clknf':
			return getClockWCA(type);
		case 'clk': return getClockJaap();
		case 'clkc': return getClockConcise();
		case 'clke': return getClockEfficient();
		case 'mgmo':
			return adjScramble(
				['F', 'B', 'U', 'D', 'L', 'DBR', 'DL', 'BR', 'DR', 'BL', 'R', 'DBL'],
				[0x554, 0xaa8, 0x691, 0x962, 0xa45, 0x58a, 0x919, 0x626, 0x469, 0x896, 0x1a5, 0x25a],
				length || 70, minxsuff
			);
		case 'mgmc': return pochscramble(10, Math.ceil((length || 70) / 10));
		case 'mgms2l':
			return adjScramble(
				['F', 'R', 'BR', 'BL', 'L', 'U'],
				[0x32, 0x25, 0x2a, 0x34, 0x29, 0x1f],
				length || 70, minxsuff
			);
		case 'mgmp': return pochscramble(10, Math.ceil((length || 70) / 10));
		case 'pyrm': {
			const ret = mega([['U'], ['L'], ['R'], ['B']], ['', "'"], length || 25);
			return addPyrTips(ret, 3).replace(/!/g, '');
		}
		case 'sq1h': return sq1_scramble(1, length || 40);
		case 'sq1t': return sq1_scramble(0, length || 20);
		default:
			return '';
	}
}

// Register all utility scramble types
const utilTypes = [
	'clkwca', 'clkwcab', 'clknf', 'clk', 'clkc', 'clke',
	'mgmo', 'mgmc', 'mgms2l', 'mgmp',
	'pyrm',
	'sq1h', 'sq1t',
];

registerGenerator(utilTypes, (typeId, len) => utilscramble(typeId, len));
