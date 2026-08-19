/**
 * 2x2x2 scramble generator (random-state solver).
 * Ported from cstimer 2x2x2.js (GPLv3)
 *
 * Supports: 222so (WCA random state), 222o (optimal), 222nb (no bar),
 *           222eg (EG), 222eg0 (CLL), 222eg1, 222eg2,
 *           222tcp (TCLL+), 222tcn (TCLL-), 222tc (TCLL), 222lsall (LS)
 *
 * Scramble length follows cstimer: 222so searches for a solution of at least
 * 9 moves (minl), so scrambles land in the 9-11 move range, and any state
 * solvable in <= 3 moves is rejected outright. 222o is the optimal variant.
 */

import {
	Solver, Coord, acycle, setNPerm, getNPerm,
	rndPerm, rndProb, valuedArray, fillFacelet, rn,
} from '../lib/mathlib';
import { registerGenerator } from '../registry';

// ==================== Move Definitions ====================

const movePieces = [
	[0, 2, 3, 1], // U
	[0, 1, 5, 4], // R
	[0, 4, 6, 2] // F
];

const moveOris: (number[] | null)[] = [
	null, // U: no orientation change
	[0, 1, 0, 1, 3], // R
	[1, 0, 1, 0, 3] // F
];

function doPermMove(arr: number[], m: number): void {
	acycle(arr, movePieces[m]);
}

function doOriMove(arr: number[], m: number): void {
	acycle(arr, movePieces[m], 1, moveOris[m]);
}

const oriCoord = new Coord('o', 7, -3);

// ==================== Solver ====================

const solv = new Solver(3, 3, [
	[0, [doPermMove, 'p', 7], 5040],
	[0, [doOriMove, 'o', 7, -3], 729]
]);

// Power map turns a solution into a scramble: the move order is reversed by
// .reverse() and the direction by this map (p=0 is one CW turn -> "'").
const POWER_MAP = "'2 ";

// ==================== Facelets ====================

const cFacelet = [
	[3, 4, 9],
	[1, 20, 5],
	[2, 8, 17],
	[0, 16, 21],
	[13, 11, 6],
	[15, 7, 22],
	[12, 19, 10]
];

// ==================== EG / LL Case Data ====================

const egprobs = [
	1, 2, 4, 4, 4, 4, 4, 4, 1, 2, 4, 4, 4, 4, 4, 4,
	1, 2, 4, 4, 4, 4, 4, 4, 1, 2, 4, 4, 4, 4, 4, 4,
	1, 2, 4, 4, 4, 4, 4, 4, 1, 2, 4, 4, 4, 4, 4, 4
];

const egmap = [0, 17, 5, 14, 8, 1, 2, 4];

const egperms: number[][] = [
	[4, 5, 6], // solved
	[4, 6, 5], // diagonal swap
	[6, 5, 4], // adjacent swap variants
	[5, 4, 6],
	[5, 6, 4],
	[6, 4, 5],
];

// EG Last Layer case maps: [perm_hex, ori_hex, probability, name]
const egll_map: [number, number, number, string][] = [
	[0x3210, 0x1221, 2, 'H-1'], [0x3120, 0x1221, 2, 'H-2'],
	[0x2310, 0x1221, 4, 'H-3'], [0x3012, 0x1221, 4, 'H-4'],
	[0x0312, 0x0210, 4, 'L-1'], [0x2310, 0x0210, 4, 'L-2'],
	[0x0213, 0x0210, 4, 'L-3'], [0x3210, 0x0210, 4, 'L-4'],
	[0x2013, 0x0210, 4, 'L-5'], [0x3012, 0x0210, 4, 'L-6'],
	[0x3210, 0x1212, 4, 'Pi-1'], [0x0213, 0x1212, 4, 'Pi-2'],
	[0x2310, 0x1212, 4, 'Pi-3'], [0x2013, 0x1212, 4, 'Pi-4'],
	[0x3012, 0x1212, 4, 'Pi-5'], [0x0312, 0x1212, 4, 'Pi-6'],
	[0x3210, 0x2220, 4, 'S-1'], [0x0213, 0x2220, 4, 'S-2'],
	[0x0312, 0x2220, 4, 'S-3'], [0x3012, 0x2220, 4, 'S-4'],
	[0x2013, 0x2220, 4, 'S-5'], [0x2310, 0x2220, 4, 'S-6'],
	[0x2310, 0x1020, 4, 'T-1'], [0x2013, 0x1020, 4, 'T-2'],
	[0x0213, 0x1020, 4, 'T-3'], [0x3210, 0x1020, 4, 'T-4'],
	[0x3012, 0x1020, 4, 'T-5'], [0x0312, 0x1020, 4, 'T-6'],
	[0x0213, 0x2010, 4, 'U-1'], [0x3210, 0x2010, 4, 'U-2'],
	[0x0312, 0x2010, 4, 'U-3'], [0x3012, 0x2010, 4, 'U-4'],
	[0x2310, 0x2010, 4, 'U-5'], [0x2013, 0x2010, 4, 'U-6'],
	[0x3210, 0x1011, 4, 'aS-1'], [0x0213, 0x1011, 4, 'aS-2'],
	[0x0312, 0x1011, 4, 'aS-3'], [0x3012, 0x1011, 4, 'aS-4'],
	[0x2310, 0x1011, 4, 'aS-5'], [0x2013, 0x1011, 4, 'aS-6'],
];

const tcllp_map: [number, number, number, string][] = [
	[0x0123, 0x0221, 4, 'Hammer-1'], [0x3021, 0x0221, 4, 'Hammer-2'],
	[0x0132, 0x0221, 4, 'Hammer-3'], [0x0231, 0x0221, 4, 'Hammer-4'],
	[0x0321, 0x0221, 4, 'Hammer-5'], [0x2301, 0x0221, 4, 'Hammer-6'],
	[0x0123, 0x1022, 4, 'Spaceship-1'], [0x2301, 0x1022, 4, 'Spaceship-2'],
	[0x1320, 0x1022, 4, 'Spaceship-3'], [0x3021, 0x1022, 4, 'Spaceship-4'],
	[0x3012, 0x1022, 4, 'Spaceship-5'], [0x0231, 0x1022, 4, 'Spaceship-6'],
	[0x2031, 0x0002, 4, 'Stollery-1'], [0x3120, 0x0002, 4, 'Stollery-2'],
	[0x3201, 0x0002, 4, 'Stollery-3'], [0x2103, 0x0002, 4, 'Stollery-4'],
	[0x0231, 0x0002, 4, 'Stollery-5'], [0x2130, 0x0002, 4, 'Stollery-6'],
	[0x0123, 0x2222, 1, 'Pinwheel-1'], [0x1032, 0x2222, 1, 'Pinwheel-2'],
	[0x3201, 0x2222, 4, 'Pinwheel-3'],
	[0x2031, 0x0110, 2, '2Face-1'], [0x3102, 0x0110, 4, '2Face-2'],
	[0x0213, 0x0110, 2, '2Face-3'], [0x3021, 0x0110, 4, '2Face-4'],
	[0x1302, 0x0122, 4, 'Turtle-1'], [0x1032, 0x0122, 4, 'Turtle-2'],
	[0x3201, 0x0122, 4, 'Turtle-3'], [0x1230, 0x0122, 4, 'Turtle-4'],
	[0x2310, 0x0122, 4, 'Turtle-5'], [0x0321, 0x0122, 4, 'Turtle-6'],
	[0x3210, 0x1112, 4, 'PP-1'], [0x3120, 0x1112, 4, 'PP-2'],
	[0x3201, 0x1112, 4, 'PP-3'], [0x2103, 0x1112, 4, 'PP-4'],
	[0x2310, 0x1112, 4, 'PP-5'], [0x2130, 0x1112, 4, 'PP-6'],
	[0x2031, 0x0011, 4, 'Gun-1'], [0x1032, 0x0011, 4, 'Gun-2'],
	[0x0132, 0x0011, 4, 'Gun-3'], [0x3021, 0x0011, 4, 'Gun-4'],
	[0x2310, 0x0011, 4, 'Gun-5'], [0x2130, 0x0011, 4, 'Gun-6'],
];

const tclln_map: [number, number, number, string][] = [
	[0x1302, 0x1201, 4, 'Hammer-1'], [0x3021, 0x1201, 4, 'Hammer-2'],
	[0x2310, 0x1201, 4, 'Hammer-3'], [0x3201, 0x1201, 4, 'Hammer-4'],
	[0x1203, 0x1201, 4, 'Hammer-5'], [0x3120, 0x1201, 4, 'Hammer-6'],
	[0x0123, 0x1012, 4, 'Spaceship-1'], [0x1032, 0x1012, 4, 'Spaceship-2'],
	[0x0312, 0x1012, 4, 'Spaceship-3'], [0x3201, 0x1012, 4, 'Spaceship-4'],
	[0x1023, 0x1012, 4, 'Spaceship-5'], [0x2130, 0x1012, 4, 'Spaceship-6'],
	[0x0123, 0x0001, 4, 'Stollery-1'], [0x3120, 0x0001, 4, 'Stollery-2'],
	[0x0132, 0x0001, 4, 'Stollery-3'], [0x2103, 0x0001, 4, 'Stollery-4'],
	[0x3102, 0x0001, 4, 'Stollery-5'], [0x1203, 0x0001, 4, 'Stollery-6'],
	[0x0123, 0x1111, 1, 'Pinwheel-1'], [0x1032, 0x1111, 1, 'Pinwheel-2'],
	[0x1320, 0x1111, 4, 'Pinwheel-3'],
	[0x2031, 0x2002, 2, '2Face-1'], [0x0132, 0x2002, 4, '2Face-2'],
	[0x1032, 0x2002, 2, '2Face-3'], [0x3021, 0x2002, 4, '2Face-4'],
	[0x2031, 0x1102, 4, 'Turtle-1'], [0x3120, 0x1102, 4, 'Turtle-2'],
	[0x1023, 0x1102, 4, 'Turtle-3'], [0x3021, 0x1102, 4, 'Turtle-4'],
	[0x0132, 0x1102, 4, 'Turtle-5'], [0x1203, 0x1102, 4, 'Turtle-6'],
	[0x1302, 0x2122, 4, 'PP-1'], [0x0213, 0x2122, 4, 'PP-2'],
	[0x2013, 0x2122, 4, 'PP-3'], [0x0312, 0x2122, 4, 'PP-4'],
	[0x2310, 0x2122, 4, 'PP-5'], [0x0321, 0x2122, 4, 'PP-6'],
	[0x0123, 0x0022, 4, 'Gun-1'], [0x1032, 0x0022, 4, 'Gun-2'],
	[0x0132, 0x0022, 4, 'Gun-3'], [0x2310, 0x0022, 4, 'Gun-4'],
	[0x0312, 0x0022, 4, 'Gun-5'], [0x2130, 0x0022, 4, 'Gun-6'],
];

const tcll_map: [number, number, number, string][] = [
	[0x0123, 0x0221, 4, 'TCLL1-Hammer'], [0x0123, 0x1022, 4, 'TCLL1-Spaceship'],
	[0x2031, 0x0002, 4, 'TCLL1-Stollery'], [0x0123, 0x2222, 1, 'TCLL1-Pinwheel'],
	[0x2031, 0x0110, 2, 'TCLL1-2Face'], [0x1302, 0x0122, 4, 'TCLL1-Turtle'],
	[0x3210, 0x1112, 4, 'TCLL1-PP'], [0x2031, 0x0011, 4, 'TCLL1-Gun'],
	[0x1302, 0x1201, 4, 'TCLL2-Hammer'], [0x0123, 0x1012, 4, 'TCLL2-Spaceship'],
	[0x0123, 0x0001, 4, 'TCLL2-Stollery'], [0x0123, 0x1111, 1, 'TCLL2-Pinwheel'],
	[0x2031, 0x2002, 2, 'TCLL2-2Face'], [0x2031, 0x1102, 4, 'TCLL2-Turtle'],
	[0x1302, 0x2122, 4, 'TCLL2-PP'], [0x0123, 0x0022, 4, 'TCLL2-Gun'],
];

const lsall_map: [number, string][] = [
	[0x00000, 'LS1-PBL'], [0x00222, 'LS1-Sune'], [0x00111, 'LS1-aSune'],
	[0x00102, 'LS1-Ua'], [0x00021, 'LS1-Ub'], [0x00120, 'LS1-La'],
	[0x00210, 'LS1-Lb'], [0x00201, 'LS1-Ta'], [0x00012, 'LS1-Tb'],
	[0x10221, 'LS2-Hammer'], [0x10212, 'LS2-Spaceship'],
	[0x10200, 'LS2-StolleryA'], [0x10002, 'LS2-StolleryB'],
	[0x10020, 'LS2-StolleryC'], [0x10110, 'LS2-2Face'],
	[0x10122, 'LS2-Turtle'], [0x10011, 'LS2-GunA'], [0x10101, 'LS2-GunB'],
	[0x20112, 'LS3-Hammer'], [0x20211, 'LS3-Spaceship'],
	[0x20100, 'LS3-StolleryA'], [0x20001, 'LS3-StolleryB'],
	[0x20010, 'LS3-StolleryC'], [0x20220, 'LS3-2Face'],
	[0x20121, 'LS3-Turtle'], [0x20022, 'LS3-GunA'], [0x20202, 'LS3-GunB'],
	[0x02022, 'LS4-SuneA'], [0x02220, 'LS4-SuneB'], [0x02202, 'LS4-SuneC'],
	[0x02211, 'LS4-PiA'], [0x02121, 'LS4-PiB'], [0x02010, 'LS4-U'],
	[0x02001, 'LS4-L'], [0x02100, 'LS4-T'], [0x02112, 'LS4-H'],
	[0x12012, 'LS5-HammerA'], [0x12102, 'LS5-HammerB'],
	[0x12120, 'LS5-SpaceshipA'], [0x12201, 'LS5-SpaceshipB'],
	[0x12000, 'LS5-Stollery'], [0x12222, 'LS5-Pinwheel'],
	[0x12021, 'LS5-TurtleA'], [0x12210, 'LS5-TurtleB'],
	[0x12111, 'LS5-PP'],
	[0x22110, 'LS6-Hammer'], [0x22101, 'LS6-Spaceship'],
	[0x22002, 'LS6-2Face'], [0x22011, 'LS6-Turtle'],
	[0x22122, 'LS6-PPA'], [0x22221, 'LS6-PPB'], [0x22212, 'LS6-PPC'],
	[0x22200, 'LS6-GunA'], [0x22020, 'LS6-GunB'],
	[0x01011, 'LS7-aSuneA'], [0x01110, 'LS7-aSuneB'], [0x01101, 'LS7-aSuneC'],
	[0x01212, 'LS7-PiA'], [0x01122, 'LS7-PiB'], [0x01200, 'LS7-U'],
	[0x01002, 'LS7-L'], [0x01020, 'LS7-T'], [0x01221, 'LS7-H'],
	[0x11220, 'LS8-Hammer'], [0x11022, 'LS8-Spaceship'],
	[0x11001, 'LS8-2Face'], [0x11202, 'LS8-Turtle'],
	[0x11121, 'LS8-PPA'], [0x11112, 'LS8-PPB'], [0x11211, 'LS8-PPC'],
	[0x11010, 'LS8-GunA'], [0x11100, 'LS8-GunB'],
	[0x21201, 'LS9-HammerA'], [0x21021, 'LS9-HammerB'],
	[0x21012, 'LS9-SpaceshipA'], [0x21120, 'LS9-SpaceshipB'],
	[0x21000, 'LS9-Stollery'], [0x21111, 'LS9-Pinwheel'],
	[0x21102, 'LS9-TurtleA'], [0x21210, 'LS9-TurtleB'],
	[0x21222, 'LS9-PP'],
];

// Probability arrays (weight column of each case map)
const egllprobs = egll_map.map((c) => c[2]);
const tcllpprobs = tcllp_map.map((c) => c[2]);
const tcllnprobs = tclln_map.map((c) => c[2]);
const tcllprobs = tcll_map.map((c) => c[2]);
const lsallprobs = valuedArray(lsall_map.length, 1);

// ==================== No Bar Check ====================

function checkNoBar(pidx: number, oidx: number): boolean {
	const perm = setNPerm(new Array(7), pidx, 7);
	const ori = oriCoord.set(new Array(7), oidx);
	const f: number[] = [];
	for (let i = 0; i < 24; i++) f[i] = i >> 2;
	fillFacelet(cFacelet, f, perm, ori, 4);
	for (let i = 0; i < 24; i += 4) {
		if ((1 << f[i] | 1 << f[i + 3]) & (1 << f[i + 1] | 1 << f[i + 2])) {
			return false;
		}
	}
	return true;
}

// ==================== Random State Scramble ====================

function getScramble(type: string, state?: number): string {
	let perm = 0;
	let ori = 0;
	let lim = 2;

	do {
		lim = 2;
		if (type === '222o' || type === '222so') {
			perm = rn(5040);
			ori = rn(729);
			lim = 3;
		} else if (type === '222eg') {
			const egCase = state === undefined ? rndProb(egprobs) : state;
			const oriIdx = egmap[egCase & 0x7];
			const permVariant = [0, 2, 3, 4, 5, 1][egCase >> 3];
			const arr = setNPerm([0, 0, 0, 0].concat(egperms[permVariant]), rn(24), 4);
			perm = getNPerm(arr, 7);
			const oriArr = oriCoord.set([], oriIdx);
			let rndU = rn(4);
			while (rndU-- > 0) {
				doOriMove(oriArr, 0);
			}
			ori = oriCoord.get(oriArr);
		} else if (type === '222nb') {
			do {
				perm = rn(5040);
				ori = rn(729);
			} while (!checkNoBar(perm, ori));
		}
	} while (perm === 0 && ori === 0 || solv.search([perm, ori], 0, lim) != null);

	// minl: 222o asks for the optimal solution, everything else for one of at
	// least 9 moves. That is what keeps scrambles in the 9-11 move range.
	const minl = type === '222o' ? 0 : 9;
	return solv.toStr(solv.search([perm, ori], minl)!.reverse(), 'URF', POWER_MAP).trim();
}

// ==================== Last Layer Scrambles ====================

function getLLScramble(type: string, state?: number): string {
	let llcase: [number, number];
	let ncubie = 4;
	const perm = [0, 1, 2, 3];
	const ori = [0, 0, 0, 0, 0, 0, 0];

	if (type === '222tcp') {
		const caseData = tcllp_map[state === undefined ? rndProb(tcllpprobs) : state];
		llcase = [caseData[0], caseData[1]];
		ori[4] = 1;
		perm.push(...egperms[0]);
	} else if (type === '222tcn') {
		const caseData = tclln_map[state === undefined ? rndProb(tcllnprobs) : state];
		llcase = [caseData[0], caseData[1]];
		ori[4] = 2;
		perm.push(...egperms[0]);
	} else if (type === '222tc') {
		const tcllIdx = state === undefined ? rndProb(tcllprobs) : state;
		const caseData = tcll_map[tcllIdx];
		llcase = [caseData[0], caseData[1]];
		// tcll_map holds 8 TCLL1 cases followed by 8 TCLL2 cases, so the split is
		// at 8. cstimer writes `tcllIdx < 7` here, which twists TCLL1-Gun the
		// wrong way and mislabels it; deliberate divergence.
		ori[4] = tcllIdx < 8 ? 1 : 2;
		perm.push(...egperms[0]);
		const perm4 = rndPerm(4);
		llcase[0] = 0;
		for (let i = 0; i < 4; i++) {
			llcase[0] |= perm4[i] << (i * 4);
		}
	} else if (type === '222eg0') {
		const caseData = egll_map[state === undefined ? rndProb(egllprobs) : state];
		llcase = [caseData[0], caseData[1]];
		perm.push(...egperms[0]);
	} else if (type === '222eg1') {
		const caseData = egll_map[state === undefined ? rndProb(egllprobs) : state];
		llcase = [caseData[0], caseData[1]];
		perm.push(...egperms[2 + rn(4)]);
	} else if (type === '222eg2') {
		const caseData = egll_map[state === undefined ? rndProb(egllprobs) : state];
		llcase = [caseData[0], caseData[1]];
		perm.push(...egperms[1]);
	} else if (type === '222lsall') {
		perm.push(...egperms[0]);
		const perm4 = rndPerm(4);
		perm4.push(perm4[3]);
		perm4[3] = 4;
		const lsCase = lsall_map[state === undefined ? rndProb(lsallprobs) : state];
		llcase = [0, lsCase[0]];
		for (let i = 0; i < 5; i++) {
			llcase[0] |= perm4[i] << (i * 4);
		}
		ncubie = 5;
	} else {
		return '';
	}

	// Random AUF on the first layer
	let rndA = rn(4);
	while (rndA-- > 0) {
		doPermMove(perm, 0);
	}

	// Apply case permutation and orientation to the top layer
	const perm0 = perm.slice();
	for (let i = 0; i < ncubie; i++) {
		perm[i] = perm0[(llcase[0] >> (i * 4)) & 0xf];
		ori[i] = (llcase[1] >> (i * 4)) & 0xf;
	}

	// Random U move
	let rndU = rn(4);
	while (rndU-- > 0) {
		doOriMove(ori, 0);
		doPermMove(perm, 0);
	}

	const permIdx = getNPerm(perm, 7);
	const oriIdx = oriCoord.get(ori);

	return solv.toStr(solv.search([permIdx, oriIdx], 9)!.reverse(), 'URF', POWER_MAP).trim();
}

// ==================== Registration ====================

registerGenerator(
	['222so', '222o', '222nb', '222eg'],
	(typeId, _length, state) => getScramble(typeId, state)
);

registerGenerator(
	['222eg0', '222eg1', '222eg2', '222tcp', '222tcn', '222tc', '222lsall'],
	(typeId, _length, state) => getLLScramble(typeId, state)
);
