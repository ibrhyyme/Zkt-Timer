/**
 * 3x3x3 scramble generator — all subsets.
 * Ported from cstimer scramble_333_edit.js (GPLv3)
 *
 * Uses min2phase (Kociemba two-phase) solver for random-state scrambles.
 * Uses mathlib's CubieCube for state manipulation (NOT min2phase's CubieCube).
 *
 * Supports 40+ scramble types:
 * WCA: 333, 333fm, edges, corners
 * CFOP: pll, oll, ll, f2l, lsll2, zbll, zzll, zbls, coll, cll, ell, 2gll, ttll
 * VLS/EOLS: eols, wvls, vls
 * Roux: lse, cmll, sbrx
 * Mehta: mt3qb, mteole, mttdr, mt6cp, mtl5ep, mtcdrll
 * EO: eoline, eocross
 * Generator: 2gen, 2genl, 3gen_F, 3gen_L, RrU, roux, half, 333drud
 * Custom: 333custom
 */

import {
	CubieCube, getNPerm, setNPerm, getNParity, getNOri, setNOri,
	rn, rndEl, idxArray, valuedArray
} from '../lib/mathlib';
import { Search } from '../lib/min2phase';
import { registerGenerator } from '../registry';

// ==================== Move Constants ====================

const Ux1 = 0, Ux2 = 1, Ux3 = 2;
const Rx1 = 3, Rx2 = 4, Rx3 = 5;
const Fx1 = 6, Fx2 = 7, Fx3 = 8;
const Dx1 = 9, Dx2 = 10, Dx3 = 11;
const Lx1 = 12, Lx2 = 13, Lx3 = 14;
const Bx1 = 15, Bx2 = 16, Bx3 = 17;

// ==================== Shared Search Instance ====================

const search = new Search();

// ==================== Utility Functions ====================

function renderFacelet(solved: string, cc: CubieCube, resultMap: number[]): string {
	const f = cc.toPerm();
	const ret: string[] = [];
	for (let i = 0; i < resultMap.length; i++) {
		ret[i] = solved[f[resultMap[i]]];
	}
	return ret.join('');
}

function cntU(b: number[]): number {
	let c = 0;
	for (let a = 0; a < b.length; a++) {
		if (b[a] === -1) c++;
	}
	return c;
}

function fixOri(arr: number[], cntUndef: number, base: number): number {
	let sum = 0;
	for (let i = 0; i < arr.length; i++) {
		if (arr[i] !== -1) sum += arr[i];
	}
	sum %= base;
	for (let i = 0; i < arr.length - 1; i++) {
		if (arr[i] === -1) {
			if (cntUndef-- === 1) {
				arr[i] = ((base << 4) - sum) % base;
			} else {
				arr[i] = rn(base);
				sum += arr[i];
			}
		}
	}
	if (cntUndef === 1) {
		arr[arr.length - 1] = ((base << 4) - sum) % base;
	}
	// Compute index
	let idx = 0;
	for (let i = 0; i < arr.length; i++) {
		idx = idx * base + arr[i];
	}
	return idx;
}

function fixPerm(arr: number[], cntUndef: number, parity: number): number {
	const val: number[] = [];
	for (let i = 0; i < arr.length; i++) val[i] = i;
	for (let i = 0; i < arr.length; i++) {
		if (arr[i] !== -1) val[arr[i]] = -1;
	}
	const available: number[] = [];
	for (let i = 0; i < val.length; i++) {
		if (val[i] !== -1) available.push(val[i]);
	}
	let last = -1;
	let lastFilled = -1;
	for (let i = 0; i < arr.length && cntUndef > 0; i++) {
		if (arr[i] === -1) {
			const r = rn(cntUndef);
			arr[i] = available[r];
			available.splice(r, 1);
			if (cntUndef-- === 2) last = i;
			if (cntUndef === 0) lastFilled = i;
		}
	}
	if (parity >= 0 && getNParity(getNPerm(arr, arr.length)!, arr.length) !== parity) {
		const temp = arr[lastFilled];
		arr[lastFilled] = arr[last];
		arr[last] = temp;
	}
	return getNPerm(arr, arr.length)!;
}

function parseMask(arr: number | number[], length: number): number[] {
	if (typeof arr !== 'number') return arr;
	const ret: number[] = [];
	for (let i = 0; i < length; i++) {
		const val = arr & 0xf;
		ret[i] = val === 15 ? -1 : val;
		arr = arr / 16; // use division, not >>, to handle > 32 bits
	}
	return ret;
}

// ==================== AUF Suffixes ====================

const aufsuff: number[][] = [[], [Ux1], [Ux2], [Ux3]];
const rlpresuff: number[][] = [[], [Rx1, Lx3], [Rx2, Lx2], [Rx3, Lx1]];
const rlappsuff = ['', "x'", 'x2', 'x'];
const emptysuff: number[][] = [[]];
const daufsuff: number[][] = [[], [Dx1], [Dx2], [Dx3]];
const daufrot = ['', 'y', 'y2', "y'"];

// ==================== Core: getAnyScramble ====================

function getAnyScramble(
	_ep: number | number[], _eo: number | number[],
	_cp: number | number[], _co: number | number[],
	neut?: number,
	_rndapp?: number[][], _rndpre?: number[][],
	firstAxisFilter?: number, lastAxisFilter?: number
): string {
	_rndapp = _rndapp || emptysuff;
	_rndpre = _rndpre || emptysuff;
	const epArr = parseMask(_ep, 12);
	const eoArr = parseMask(_eo, 12);
	const cpArr = parseMask(_cp, 8);
	const coArr = parseMask(_co, 8);

	let solution = '';
	do {
		const eo = eoArr.slice();
		const ep = epArr.slice();
		const co = coArr.slice();
		const cp = cpArr.slice();
		fixOri(eo, cntU(eo), 2);
		fixOri(co, cntU(co), 3);

		let ue = cntU(ep);
		let uc = cntU(cp);
		let nep: number, ncp: number;

		if (ue === 1) { fixPerm(ep, ue, -1); ue = 0; }
		if (uc === 1) { fixPerm(cp, uc, -1); uc = 0; }

		if (ue === 0 && uc === 0) {
			nep = getNPerm(ep, 12)!;
			ncp = getNPerm(cp, 8)!;
		} else if (ue !== 0 && uc === 0) {
			ncp = getNPerm(cp, 8)!;
			nep = fixPerm(ep, ue, getNParity(ncp, 8));
		} else if (ue === 0 && uc !== 0) {
			nep = getNPerm(ep, 12)!;
			ncp = fixPerm(cp, uc, getNParity(nep, 12));
		} else {
			nep = fixPerm(ep, ue, -1);
			ncp = fixPerm(cp, uc, getNParity(nep, 12));
		}

		if (ncp! + fixOri(co, 0, 3) + nep! + fixOri(eo, 0, 2) === 0) continue;

		const rndpre = rndEl(_rndpre);
		const rndapp = rndEl(_rndapp);

		const cc = new CubieCube();
		const cd = new CubieCube();
		for (let i = 0; i < 12; i++) {
			cc.ea[i] = ep[i] << 1 | eo[i];
			if (i < 8) cc.ca[i] = co[i] << 3 | cp[i];
		}
		for (let i = 0; i < rndpre.length; i++) {
			CubieCube.CubeMult(CubieCube.moveCube[rndpre[i]], cc, cd);
			cc.init(cd.ca, cd.ea);
		}
		for (let i = 0; i < rndapp.length; i++) {
			CubieCube.CubeMult(cc, CubieCube.moveCube[rndapp[i]], cd);
			cc.init(cd.ca, cd.ea);
		}
		if (neut) {
			cc.ori = rn([1, 4, 8, 1, 1, 1, 24][neut]);
			cc.selfConj();
			cc.ori = 0;
		}
		const posit = cc.toFaceCube();
		solution = search.solution(posit, 21, 1e9, 50, 2, lastAxisFilter, firstAxisFilter);
	} while (solution.length <= 3);

	return solution.replace(/ +/g, ' ');
}

// ==================== Basic Scramble Types ====================

function getRandomScramble(): string {
	return getAnyScramble(0xffffffffffff, 0xffffffffffff, 0xffffffff, 0xffffffff);
}

function getFMCScramble(): string {
	const scramble = getAnyScramble(0xffffffffffff, 0xffffffffffff, 0xffffffff, 0xffffffff, 0, undefined, undefined, 2, 1);
	return "R' U' F " + scramble + "R' U' F";
}

function getEdgeScramble(): string {
	return getAnyScramble(0xffffffffffff, 0xffffffffffff, 0x76543210, 0x00000000);
}

function getCornerScramble(): string {
	return getAnyScramble(0xba9876543210, 0x000000000000, 0xffffffff, 0xffffffff);
}

function getLLScramble(): string {
	return getAnyScramble(0xba987654ffff, 0x00000000ffff, 0x7654ffff, 0x0000ffff);
}

function getF2LScramble(): string {
	return getAnyScramble(0xffff7654ffff, 0xffff0000ffff, 0xffffffff, 0xffffffff);
}

function getZZLLScramble(): string {
	return getAnyScramble(0xba9876543f1f, 0x000000000000, 0x7654ffff, 0x0000ffff, undefined, aufsuff);
}

function getELLScramble(): string {
	return getAnyScramble(0xba987654ffff, 0x00000000ffff, 0x76543210, 0x00000000);
}

function get2GLLScramble(): string {
	return getAnyScramble(0xba987654ffff, 0x000000000000, 0x76543210, 0x0000ffff, undefined, aufsuff);
}

function getLSEScramble(): string {
	const rnd4 = rn(4);
	return getAnyScramble(0xba98f6f4ffff, 0x0000f0f0ffff, 0x76543210, 0x00000000, 0, [rlpresuff[rnd4]], aufsuff) + rlappsuff[rnd4];
}

function getSBRouxScramble(): string {
	const rnd4 = rn(4);
	return getAnyScramble(0xfa9ff6ffffff, 0xf00ff0ffffff, 0xf65fffff, 0xf00fffff, 0, [rlpresuff[rnd4]]) + rlappsuff[rnd4];
}

function getEOLineScramble(): string {
	return getAnyScramble(0xffff7f5fffff, 0x000000000000, 0xffffffff, 0xffffffff);
}

function getEOCrossScramble(): string {
	return getAnyScramble(0xffff7654ffff, 0x000000000000, 0xffffffff, 0xffffffff);
}

// ==================== PLL ====================

const pll_map: [number, number, number, string][] = [
	[0x1032, 0x3210, 1, 'H'],
	[0x3102, 0x3210, 4, 'Ua'],
	[0x3021, 0x3210, 4, 'Ub'],
	[0x2301, 0x3210, 2, 'Z'],
	[0x3210, 0x3021, 4, 'Aa'],
	[0x3210, 0x3102, 4, 'Ab'],
	[0x3210, 0x2301, 2, 'E'],
	[0x3012, 0x3201, 4, 'F'],
	[0x2130, 0x3021, 4, 'Ga'],
	[0x1320, 0x3102, 4, 'Gb'],
	[0x3021, 0x3102, 4, 'Gc'],
	[0x3102, 0x3021, 4, 'Gd'],
	[0x3201, 0x3201, 4, 'Ja'],
	[0x3120, 0x3201, 4, 'Jb'],
	[0x1230, 0x3012, 1, 'Na'],
	[0x3012, 0x3012, 1, 'Nb'],
	[0x0213, 0x3201, 4, 'Ra'],
	[0x2310, 0x3201, 4, 'Rb'],
	[0x1230, 0x3201, 4, 'T'],
	[0x3120, 0x3012, 4, 'V'],
	[0x3201, 0x3012, 4, 'Y'],
];
const pllprobs = pll_map.map(c => c[2]);

function getPLLScramble(_t: string, _l?: number, cases?: number): string {
	const idx = cases !== undefined ? cases : weightedRandom(pllprobs);
	const pllcase = pll_map[idx];
	return getAnyScramble(pllcase[0] + 0xba9876540000, 0x000000000000, pllcase[1] + 0x76540000, 0x00000000, undefined, aufsuff, aufsuff);
}

// ==================== OLL ====================

const oll_map: [number, number, number, string, number][] = [
	[0x0000, 0x0000, 1, 'PLL', 0x000ff],
	[0x1111, 0x1212, 2, 'Point-1', 0xeba00],
	[0x1111, 0x1122, 4, 'Point-2', 0xdda00],
	[0x1111, 0x0222, 4, 'Point-3', 0x5b620],
	[0x1111, 0x0111, 4, 'Point-4', 0x6d380],
	[0x0011, 0x2022, 4, 'Square-5', 0x8360b],
	[0x0011, 0x1011, 4, 'Square-6', 0x60b16],
	[0x0011, 0x2202, 4, 'SLBS-7', 0x1362a],
	[0x0011, 0x0111, 4, 'SLBS-8', 0x64392],
	[0x0011, 0x1110, 4, 'Fish-9', 0x2538a],
	[0x0011, 0x2220, 4, 'Fish-10', 0x9944c],
	[0x0011, 0x0222, 4, 'SLBS-11', 0x9160e],
	[0x0011, 0x1101, 4, 'SLBS-12', 0x44b13],
	[0x0101, 0x2022, 4, 'Knight-13', 0x1a638],
	[0x0101, 0x0111, 4, 'Knight-14', 0x2c398],
	[0x0101, 0x0222, 4, 'Knight-15', 0x8a619],
	[0x0101, 0x1011, 4, 'Knight-16', 0x28b1c],
	[0x1111, 0x0102, 4, 'Point-17', 0x4b381],
	[0x1111, 0x0012, 4, 'Point-18', 0x49705],
	[0x1111, 0x0021, 4, 'Point-19', 0xc9a05],
	[0x1111, 0x0000, 1, 'CO-20', 0x492a5],
	[0x0000, 0x1212, 2, 'OCLL-21', 0x1455a],
	[0x0000, 0x1122, 4, 'OCLL-22', 0xa445a],
	[0x0000, 0x0012, 4, 'OCLL-23', 0x140fa],
	[0x0000, 0x0021, 4, 'OCLL-24', 0x101de],
	[0x0000, 0x0102, 4, 'OCLL-25', 0x2047e],
	[0x0000, 0x0111, 4, 'OCLL-26', 0x2095e],
	[0x0000, 0x0222, 4, 'OCLL-27', 0x1247a],
	[0x0011, 0x0000, 4, 'CO-28', 0x012af],
	[0x0011, 0x0210, 4, 'Awkward-29', 0x1138e],
	[0x0011, 0x2100, 4, 'Awkward-30', 0x232aa],
	[0x0011, 0x0021, 4, 'P-31', 0x50396],
	[0x0011, 0x1002, 4, 'P-32', 0x0562b],
	[0x0101, 0x0021, 4, 'T-33', 0x1839c],
	[0x0101, 0x0210, 4, 'C-34', 0x2a2b8],
	[0x0011, 0x1020, 4, 'Fish-35', 0x4a1d1],
	[0x0011, 0x0102, 4, 'W-36', 0xc4293],
	[0x0011, 0x2010, 4, 'Fish-37', 0x0338b],
	[0x0011, 0x0201, 4, 'W-38', 0x11a2e],
	[0x0101, 0x1020, 4, 'BLBS-39', 0x18a3c],
	[0x0101, 0x0102, 4, 'BLBS-40', 0x8c299],
	[0x0011, 0x1200, 4, 'Awkward-41', 0x152aa],
	[0x0011, 0x0120, 4, 'Awkward-42', 0x0954d],
	[0x0011, 0x0012, 4, 'P-43', 0xe0296],
	[0x0011, 0x2001, 4, 'P-44', 0x03a2b],
	[0x0101, 0x0012, 4, 'T-45', 0xa829c],
	[0x0101, 0x0120, 4, 'C-46', 0x43863],
	[0x0011, 0x1221, 4, 'L-47', 0x52b12],
	[0x0011, 0x1122, 4, 'L-48', 0xa560a],
	[0x0011, 0x2112, 4, 'L-49', 0xe4612],
	[0x0011, 0x2211, 4, 'L-50', 0xec450],
	[0x0101, 0x1221, 4, 'I-51', 0x1ab18],
	[0x0101, 0x1122, 4, 'I-52', 0x53942],
	[0x0011, 0x2121, 4, 'L-53', 0x54712],
	[0x0011, 0x1212, 4, 'L-54', 0x1570a],
	[0x0101, 0x2121, 2, 'I-55', 0x1c718],
	[0x0101, 0x1212, 2, 'I-56', 0xaaa18],
	[0x0101, 0x0000, 2, 'CO-57', 0x082bd],
];
const ollprobs = oll_map.map(c => c[2]);

function getOLLScramble(_t: string, _l?: number, cases?: number): string {
	const idx = cases !== undefined ? cases : weightedRandom(ollprobs);
	const ollcase = oll_map[idx];
	return getAnyScramble(0xba987654ffff, ollcase[0], 0x7654ffff, ollcase[1], undefined, aufsuff, aufsuff);
}

// ==================== COLL/CMLL ====================

const coll_map: [number, number, number, string][] = [
	[0x3210, 0x2121, 2, 'H-1'], [0x2301, 0x1212, 2, 'H-2'], [0x1203, 0x1212, 4, 'H-3'], [0x2013, 0x1212, 4, 'H-4'],
	[0x3021, 0x1020, 4, 'L-1'], [0x1203, 0x0201, 4, 'L-2'], [0x2301, 0x0102, 4, 'L-3'], [0x3210, 0x1020, 4, 'L-4'],
	[0x3102, 0x1020, 4, 'L-5'], [0x2013, 0x0201, 4, 'L-6'],
	[0x3210, 0x1122, 4, 'Pi-1'], [0x2301, 0x2112, 4, 'Pi-2'], [0x1203, 0x1221, 4, 'Pi-3'],
	[0x3102, 0x1122, 4, 'Pi-4'], [0x2013, 0x1221, 4, 'Pi-5'], [0x3021, 0x1122, 4, 'Pi-6'],
	[0x3210, 0x2220, 4, 'S-1'], [0x2301, 0x0222, 4, 'S-2'], [0x3021, 0x2220, 4, 'S-3'],
	[0x2013, 0x2202, 4, 'S-4'], [0x3102, 0x2220, 4, 'S-5'], [0x1203, 0x2202, 4, 'S-6'],
	[0x1203, 0x1002, 4, 'T-1'], [0x3102, 0x2100, 4, 'T-2'], [0x2301, 0x0210, 4, 'T-3'],
	[0x3210, 0x2100, 4, 'T-4'], [0x2013, 0x1002, 4, 'T-5'], [0x3021, 0x2100, 4, 'T-6'],
	[0x2301, 0x0120, 4, 'U-1'], [0x3210, 0x1200, 4, 'U-2'], [0x3021, 0x1200, 4, 'U-3'],
	[0x2013, 0x2001, 4, 'U-4'], [0x1203, 0x2001, 4, 'U-5'], [0x3102, 0x1200, 4, 'U-6'],
	[0x3210, 0x1101, 4, 'aS-1'], [0x2301, 0x1110, 4, 'aS-2'], [0x3021, 0x1101, 4, 'aS-3'],
	[0x2013, 0x1011, 4, 'aS-4'], [0x1203, 0x1011, 4, 'aS-5'], [0x3102, 0x1101, 4, 'aS-6'],
	[0x3021, 0x0000, 4, 'O-Adj'], [0x2301, 0x0000, 1, 'O-Diag'], [0x3210, 0x0000, 1, 'O-AUF'],
];
const coprobs = coll_map.map(c => c[2]);

function getCOLLScramble(_t: string, _l?: number, cases?: number): string {
	const idx = cases !== undefined ? cases : weightedRandom(coprobs);
	const cocase = coll_map[idx];
	return getAnyScramble(0xba987654ffff, 0, cocase[0] + 0x76540000, cocase[1], undefined, aufsuff, aufsuff);
}

function getCLLScramble(_t: string, _l?: number, cases?: number): string {
	const idx = cases !== undefined ? cases : weightedRandom(coprobs);
	const cocase = coll_map[idx];
	return getAnyScramble(0xba987654ffff, 0x00000000ffff, cocase[0] + 0x76540000, cocase[1], undefined, aufsuff, aufsuff);
}

function getCMLLScramble(): string {
	const idx = weightedRandom(coprobs);
	const cocase = coll_map[idx];
	const rnd4 = rn(4);
	const presuff: number[][] = [];
	for (let i = 0; i < aufsuff.length; i++) {
		presuff.push(aufsuff[i].concat(rlpresuff[rnd4]));
	}
	return getAnyScramble(0xba98f6f4ffff, 0x0000f0f0ffff, cocase[0] + 0x76540000, cocase[1], 0, presuff, aufsuff) + rlappsuff[rnd4];
}

// ==================== LSLL (F2L Last Slot + Last Layer) ====================

const f2l_map: [number, number, string][] = [
	[0x2000, 4, 'Easy-01'], [0x1011, 4, 'Easy-02'], [0x2012, 4, 'Easy-03'], [0x1003, 4, 'Easy-04'],
	[0x2003, 4, 'RE-05'], [0x1012, 4, 'RE-06'], [0x2002, 4, 'RE-07'], [0x1013, 4, 'RE-08'],
	[0x2013, 4, 'REFC-09'], [0x1002, 4, 'REFC-10'], [0x2010, 4, 'REFC-11'], [0x1001, 4, 'REFC-12'],
	[0x2011, 4, 'REFC-13'], [0x1000, 4, 'REFC-14'], [0x2001, 4, 'SPGO-15'], [0x1010, 4, 'SPGO-16'],
	[0x0000, 4, 'SPGO-17'], [0x0011, 4, 'SPGO-18'], [0x0003, 4, 'PMS-19'], [0x0012, 4, 'PMS-20'],
	[0x0002, 4, 'PMS-21'], [0x0013, 4, 'PMS-22'], [0x0001, 4, 'Weird-23'], [0x0010, 4, 'Weird-24'],
	[0x0400, 4, 'CPEU-25'], [0x0411, 4, 'CPEU-26'], [0x1400, 4, 'CPEU-27'], [0x2411, 4, 'CPEU-28'],
	[0x1411, 4, 'CPEU-29'], [0x2400, 4, 'CPEU-30'], [0x0018, 4, 'EPCU-31'], [0x0008, 4, 'EPCU-32'],
	[0x2008, 4, 'EPCU-33'], [0x1008, 4, 'EPCU-34'], [0x2018, 4, 'EPCU-35'], [0x1018, 4, 'EPCU-36'],
	[0x0418, 1, 'ECP-37'], [0x1408, 1, 'ECP-38'], [0x2408, 1, 'ECP-39'],
	[0x1418, 1, 'ECP-40'], [0x2418, 1, 'ECP-41'], [0x0408, 1, 'Solved-42'],
];
const f2lprobs = f2l_map.map(c => c[1]);

function getLSLLScramble(): string {
	const idx = weightedRandom(f2lprobs);
	const caze = f2l_map[idx][0];
	const ep = Math.pow(16, caze & 0xf);
	const eo = 0xf ^ (caze >> 4 & 1);
	const cp = Math.pow(16, (caze >> 8) & 0xf);
	const co = 0xf ^ (caze >> 12 & 3);
	return getAnyScramble(
		0xba9f7654ffff - 7 * ep, 0x000f0000ffff - eo * ep,
		0x765fffff - 0xb * cp, 0x000fffff - co * cp,
		undefined, aufsuff
	);
}

// ==================== Mehta ====================

function getMehta3QBScramble(): string {
	const rnd4 = rn(4);
	return getAnyScramble(0xffff765fffff, 0xffff000fffff, 0xf65fffff, 0xf00fffff, 0, [daufsuff[rnd4]]) + daufrot[rnd4];
}

function getMehtaEOLEScramble(): string {
	const skip = rn(4);
	const rnd4 = rn(4);
	return getAnyScramble(
		0xba98765fffff + (0x4567 & (0xf << skip * 4)) * 0x100000000,
		0x0000000fffff + (0xf << skip * 4) * 0x100000000,
		0xf65fffff, 0xf00fffff, 0, [daufsuff[rnd4]]
	) + daufrot[rnd4];
}

function getMehtaTDRScramble(): string {
	return getAnyScramble(0xba98765fffff, 0x000000000000, 0xf65fffff, 0xf00fffff);
}

function getMehta6CPScramble(): string {
	return getAnyScramble(0xba98765fffff, 0x000000000000, 0xf65fffff, 0x00000000);
}

function getMehtaL5EPScramble(): string {
	return getAnyScramble(0xba98765fffff, 0x000000000000, 0x76543210, 0x00000000);
}

function getMehtaCDRLLScramble(): string {
	return getAnyScramble(0xba98765fffff, 0x000000000000, 0x7654ffff, 0x0000ffff);
}

// ==================== Weighted Random Helper ====================

function weightedRandom(probs: number[]): number {
	let cum = 0;
	let idx = 0;
	for (let i = 0; i < probs.length; i++) {
		if (probs[i] === 0) continue;
		cum += probs[i];
		if (Math.random() < probs[i] / cum) idx = i;
	}
	return idx;
}

// ==================== Registration ====================

// WCA Standard
registerGenerator('333', () => getRandomScramble());
registerGenerator('333fm', () => getFMCScramble());
registerGenerator('edges', () => getEdgeScramble());
registerGenerator('corners', () => getCornerScramble());
registerGenerator('mrbl', () => getRandomScramble()); // Mirror Blocks = 3x3 scramble

// CFOP
registerGenerator('pll', (t, l) => getPLLScramble(t!, l));
registerGenerator('oll', (t, l) => getOLLScramble(t!, l));
registerGenerator('ll', () => getLLScramble());
registerGenerator('f2l', () => getF2LScramble());
registerGenerator('lsll2', () => getLSLLScramble());
registerGenerator('zbls', () => getLSLLScramble());

// COLL/CLL/CMLL
registerGenerator('coll', (t, l) => getCOLLScramble(t!, l));
registerGenerator('cll', (t, l) => getCLLScramble(t!, l));
registerGenerator('cmll', () => getCMLLScramble());

// Other LL
registerGenerator('zzll', () => getZZLLScramble());
registerGenerator('ell', () => getELLScramble());
registerGenerator('2gll', () => get2GLLScramble());

// Roux
registerGenerator('lse', () => getLSEScramble());
registerGenerator('sbrx', () => getSBRouxScramble());

// EO-based
registerGenerator('eoline', () => getEOLineScramble());
registerGenerator('eocross', () => getEOCrossScramble());

// Mehta
registerGenerator('mt3qb', () => getMehta3QBScramble());
registerGenerator('mteole', () => getMehtaEOLEScramble());
registerGenerator('mttdr', () => getMehtaTDRScramble());
registerGenerator('mt6cp', () => getMehta6CPScramble());
registerGenerator('mtl5ep', () => getMehtaL5EPScramble());
registerGenerator('mtcdrll', () => getMehtaCDRLLScramble());

// Subset scrambles (grouplib SubgroupSolver)
import { SubgroupSolver } from '../lib/grouplib';
import { SOLVED_FACELET } from '../lib/mathlib';

const subsetSolvs: Record<string, SubgroupSolver> = {};

function subsetScramble(moves: string[]): string {
	const key = moves.join('|');
	if (!subsetSolvs[key]) {
		const gens: number[][] = [];
		for (let m = 0; m < moves.length; m++) {
			const cc = new CubieCube();
			cc.selfMoveStr(moves[m]);
			gens.push(cc.toPerm(undefined, undefined, undefined, true));
		}
		subsetSolvs[key] = new SubgroupSolver(gens);
		subsetSolvs[key].initTables();
	}
	const solv = subsetSolvs[key];
	let solution = '';
	if (solv.sgsG.size() < 1e8) {
		do {
			const state = solv.sgsG.rndElem();
			const sol = solv.DissectionSolve(state, 12, 20);
			if (sol) {
				solution = sol.map((mvpow: [number, number]) => moves[mvpow[0]] + ['', '2', "'"][mvpow[1] - 1]).join(' ');
			}
		} while (solution.length <= 2);
		return solution.replace(/ +/g, ' ');
	}
	// Large group — use min2phase solver with orientation normalization
	let toAppend: string[];
	do {
		const state = solv.sgsG.rndElem();
		const stateStr: string[] = [];
		for (let i = 0; i < state.length; i++) {
			stateStr[i] = 'URFDLB'[~~(state[i] / 9)];
		}
		toAppend = [];
		const normState = normOrient(stateStr.join(''), toAppend);
		solution = search.solution(normState, 21, 1e9, 50, 2);
	} while (solution.length <= 3);
	toAppend.unshift(solution);
	return toAppend.join(' ').replace(/ +/g, ' ');
}

function normOrient(facelet: string, toAppend: string[]): string {
	const rotMoves1 = ['', 'x', 'x2', "x'", 'z', "z'"];
	const rotMoves2 = ['', 'y', 'y2', "y'"];
	const normTrans: number[][] = [];
	if (normTrans.length === 0) {
		for (let i = 0; i < 24; i++) {
			const cc = new CubieCube();
			cc.selfMoveStr(rotMoves2[i & 3]);
			cc.selfMoveStr(rotMoves1[i >> 2]);
			normTrans.push(cc.toPerm(undefined, undefined, undefined, true));
		}
	}
	let ori = 0;
	for (let i = 0; i < 24; i++) {
		let match = true;
		for (let j = 0; j < 6; j++) {
			if (facelet[normTrans[i][j * 9 + 4]] !== 'URFDLB'[j]) {
				match = false;
				break;
			}
		}
		if (match) {
			const ret: string[] = [];
			for (let j = 0; j < 54; j++) {
				ret[j] = facelet[normTrans[i][j]];
			}
			facelet = ret.join('');
			ori = i;
			break;
		}
	}
	const mv1 = rotMoves1[ori >> 2];
	if (mv1 !== '') {
		toAppend.push(mv1[0] + "'2 "["2'".indexOf(mv1[1]) + 1]);
	}
	const mv2 = rotMoves2[ori & 3];
	if (mv2 !== '') {
		toAppend.push(mv2[0] + "'2 "["2'".indexOf(mv2[1]) + 1]);
	}
	return facelet;
}

registerGenerator('half', () => subsetScramble(['U2', 'R2', 'F2', 'D2', 'L2', 'B2']));
registerGenerator('333drud', () => subsetScramble(['U', 'R2', 'F2', 'D', 'L2', 'B2']));
registerGenerator('3gen_F', () => subsetScramble(['U', 'R', 'F']));
registerGenerator('3gen_L', () => subsetScramble(['U', 'R', 'L']));
registerGenerator('2gen', () => subsetScramble(['U', 'R']));
registerGenerator('2genl', () => subsetScramble(['U', 'L']));
registerGenerator('RrU', () => subsetScramble(['R', 'Rw', 'U']));
registerGenerator('roux', () => subsetScramble(['M', 'U']));

// Note: easyc/easyxc require cross-solver module — will be connected in Faz 4.

// Note: 333custom, zbll, ttll, eols, wvls, vls are complex case-selection types.
// Registered with simplified random case selection (no filter UI for now).
registerGenerator('zbll', () => {
	// Random ZBLL — all cases equally weighted
	return getAnyScramble(0xba987654ffff, 0, 0x7654ffff, 0x0000ffff, undefined, aufsuff, aufsuff);
});
registerGenerator('ttll', () => getAnyScramble(0xba987654ffff, 0, 0x7654ffff, 0, undefined, aufsuff, aufsuff));
registerGenerator('eols', () => getLSLLScramble());
registerGenerator('wvls', () => {
	const co = rn(27);
	const caze = ~~(co / 9) << 12 | ~~(co / 3) % 3 << 8 | co % 3;
	return getAnyScramble(0xba9f7654ff8f, 0x000000000000, 0x765fff4f, 0x000f0020 | caze);
});
registerGenerator('vls', () => {
	const co = rn(27);
	const eo = rn(8);
	const caze0 = ~~(co / 9) % 3 << 12 | ~~(co / 3) % 3 << 8 | co % 3;
	const caze1 = (eo >> 2 & 1) << 12 | (eo >> 1 & 1) << 8 | eo & 1;
	return getAnyScramble(0xba9f7654ff8f, 0x000f00000000 + caze1, 0x765fff4f, 0x000f0020 + caze0, undefined, [[Ux3]]);
});
