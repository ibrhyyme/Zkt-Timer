/**
 * 2x2, 4x4, Pyraminx, Skewb ve SQ1 kategorileri icin algoritma pattern'lerini hesaplar.
 * cubingapp alg-codegen/main.js'den port edilmis puzzle simulatorleri kullanir.
 *
 * Cikti: public/trainer/puzzle-patterns.json
 *
 * Kullanim: node scripts/generate-puzzle-patterns.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

// ─── Yardimci fonksiyonlar (cubingapp main.js'den port) ───

function invertAlg(alg) {
	if (!alg) return '';
	return alg.split(' ').map(invertMove).reverse().join(' ');
}

function invertMove(move) {
	if (move === '/') return '/';
	if (move.includes(',')) {
		const [top, bot] = move.split(',').map((n) => parseInt(n));
		return `${-top},${-bot}`;
	}
	if (move.endsWith("'")) return move.slice(0, -1);
	return move + "'";
}

function range(n) {
	const out = Array(n);
	for (let i = 0; i < n; i++) out[i] = i;
	return out;
}

function sq(x) {
	return x * x;
}

function cycle(state, cycleDef, clockwise) {
	if (!clockwise) cycleDef = [...cycleDef].reverse();
	const temp = state[cycleDef[cycleDef.length - 1]];
	for (let i = cycleDef.length - 1; i > 0; i--) {
		state[cycleDef[i]] = state[cycleDef[i - 1]];
	}
	state[cycleDef[0]] = temp;
}

function cycles(state, cyclesDef, clockwise) {
	cyclesDef.forEach((c) => cycle(state, c, clockwise));
}

function parseMove(inputString) {
	let preNumber = '';
	let middle = '';
	let postNumber = '';
	let prime = false;

	const preNumberMatch = inputString.match(/^\d+/);
	if (preNumberMatch) {
		preNumber = preNumberMatch[0];
		inputString = inputString.slice(preNumber.length);
	}

	const postNumberMatch = inputString.match(/\d+/);
	if (postNumberMatch) {
		postNumber = postNumberMatch[0];
		middle = inputString.slice(0, inputString.indexOf(postNumber));
		prime = inputString.endsWith("'");
	} else {
		prime = inputString.endsWith("'");
		middle = prime ? inputString.slice(0, inputString.length - 1) : inputString;
	}

	return { preNumber, middle, postNumber, prime };
}

// ─── Cube Simulator (2x2, 4x4) ───

class Cube {
	constructor(layers) {
		this.layers = layers;
		this.stickers = range(layers * layers * 6);
		this.affectedStickers = Array(this.stickers.length).fill(false);
	}

	resetAffectedStickers() {
		this.affectedStickers = Array(this.stickers.length).fill(false);
	}

	getMoveMap() {
		return {
			x: (f) => this.cubeRotate(0, f),
			y: (f) => this.cubeRotate(1, f),
			z: (f) => this.cubeRotate(2, f),
			U: (f, n) => this.turn(1, n, f),
			Uw: (f, n) => this.wideTurn(1, 0, Math.max(n, 1), f),
			u: (f, n) => this.wideTurn(1, 0, Math.max(n, 1), f),
			D: (f, n) => this.turn(1, this.layers - 1 - n, !f),
			Dw: (f, n) => this.wideTurn(1, this.layers - 1, this.layers - 1 - Math.max(n, 1), !f),
			d: (f, n) => this.wideTurn(1, this.layers - 1, this.layers - 1 - Math.max(n, 1), !f),
			F: (f, n) => this.turn(2, n, f),
			Fw: (f, n) => this.wideTurn(2, 0, Math.max(n, 1), f),
			f: (f, n) => this.wideTurn(2, 0, Math.max(n, 1), f),
			B: (f, n) => this.turn(2, this.layers - 1 - n, !f),
			Bw: (f, n) => this.wideTurn(2, this.layers - 1, this.layers - 1 - Math.max(n, 1), !f),
			b: (f, n) => this.wideTurn(2, this.layers - 1, this.layers - 1 - Math.max(n, 1), !f),
			L: (f, n) => this.turn(0, this.layers - 1 - n, !f),
			Lw: (f, n) => this.wideTurn(0, this.layers - 1, this.layers - 1 - Math.max(n, 1), !f),
			l: (f, n) => this.wideTurn(0, this.layers - 1, this.layers - 1 - Math.max(n, 1), !f),
			R: (f, n) => this.turn(0, n, f),
			Rw: (f, n) => this.wideTurn(0, 0, Math.max(n, 1), f),
			r: (f, n) => this.wideTurn(0, 0, Math.max(n, 1), f),
			M: (f) => this.sliceTurn(0, !f),
			E: (f) => this.sliceTurn(1, !f),
			S: (f) => this.sliceTurn(2, f),
		};
	}

	performMove(move, forward) {
		if (!move) return;
		const { preNumber, middle, postNumber, prime } = parseMove(move);
		const moveMap = this.getMoveMap();
		const moveFunc = moveMap[middle];
		if (!moveFunc) {
			console.error('Invalid cube move:', move);
			return;
		}
		const layer = (parseInt(preNumber) - 1) || 0;
		const quarterTurns = parseInt(postNumber) || 1;
		for (let i = 0; i < quarterTurns; i++) {
			moveFunc(prime ? !forward : forward, layer);
		}
	}

	performAlg(alg) {
		if (!alg) return;
		alg.split(' ').forEach((m) => this.performMove(m, true));
	}

	turn(axis, layer, clockwise) {
		this.resetAffectedStickers();
		this.matchTurn(axis, layer, clockwise);
	}

	sliceTurn(axis, clockwise) {
		this.resetAffectedStickers();
		for (let i = 1; i < this.layers - 1; i++) {
			this.matchTurn(axis, i, clockwise);
		}
	}

	wideTurn(axis, startLayer, endLayer, clockwise) {
		this.resetAffectedStickers();
		const l1 = Math.min(startLayer, endLayer);
		const l2 = Math.max(startLayer, endLayer);
		for (let i = l1; i <= l2; i++) {
			this.matchTurn(axis, i, clockwise);
		}
	}

	cubeRotate(axis, clockwise) {
		this.resetAffectedStickers();
		for (let i = 0; i < this.layers; i++) {
			this.matchTurn(axis, i, clockwise);
		}
	}

	matchTurn(axis, layer, clockwise) {
		if (axis === 0) {
			this.turnXAxis(layer, clockwise);
			if (layer === 0) this.turnOuter(5, clockwise);
			else if (layer === this.layers - 1) this.turnOuter(4, !clockwise);
		} else if (axis === 1) {
			this.turnYAxis(layer, clockwise);
			if (layer === 0) this.turnOuter(0, clockwise);
			else if (layer === this.layers - 1) this.turnOuter(2, !clockwise);
		} else if (axis === 2) {
			this.turnZAxis(layer, clockwise);
			if (layer === 0) this.turnOuter(1, clockwise);
			else if (layer === this.layers - 1) this.turnOuter(3, !clockwise);
		}
	}

	turnXAxis(layer, cw) {
		for (let i = 1; i <= this.layers; i++) {
			this.cycle4(cw,
				0 * sq(this.layers) + sq(this.layers) - i - layer * this.layers,
				3 * sq(this.layers) + sq(this.layers) - i - layer * this.layers,
				2 * sq(this.layers) + sq(this.layers) - i - layer * this.layers,
				1 * sq(this.layers) + sq(this.layers) - i - layer * this.layers,
			);
		}
	}

	turnYAxis(layer, cw) {
		for (let i = 0; i < this.layers; i++) {
			this.cycle4(cw,
				1 * sq(this.layers) + i * this.layers + layer,
				4 * sq(this.layers) + i * this.layers + layer,
				3 * sq(this.layers) + (this.layers - i - 1) * this.layers + (this.layers - 1) - layer,
				5 * sq(this.layers) + i * this.layers + layer,
			);
		}
	}

	turnZAxis(layer, cw) {
		for (let i = 0; i < this.layers; i++) {
			this.cycle4(cw,
				0 * sq(this.layers) + (i + 1) * this.layers - 1 - layer,
				5 * sq(this.layers) + i + this.layers * layer,
				2 * sq(this.layers) + (this.layers - i - 1) * this.layers + layer,
				4 * sq(this.layers) + sq(this.layers) - (i + 1) - layer * this.layers,
			);
		}
	}

	turnOuter(face, cw) {
		for (let i = 0; i < Math.floor(this.layers / 2); i++) {
			const off = face * sq(this.layers);
			const tl = off + (this.layers + 1) * i;
			const tr = off + (this.layers - 1) * (this.layers - i);
			const br = off + (this.layers + 1) * (this.layers - i - 1);
			const bl = off + (this.layers - 1) * (i + 1);
			this.cycle4(cw, tl, tr, br, bl);

			const numEdges = this.layers - 2 * (i + 1);
			for (let j = 0; j < numEdges; j++) {
				const top = tl + this.layers * (j + 1);
				const left = tl + (numEdges - j);
				const right = tr + j + 1;
				const bottom = bl + this.layers * (numEdges - j);
				this.cycle4(cw, top, right, bottom, left);
			}
		}
	}

	cycle4(cw, ...indices) {
		if (cw) {
			const tmp = this.stickers[indices[indices.length - 1]];
			for (let i = indices.length - 1; i > 0; i--) {
				this.stickers[indices[i]] = this.stickers[indices[i - 1]];
			}
			this.stickers[indices[0]] = tmp;
		} else {
			const tmp = this.stickers[indices[0]];
			for (let i = 0; i < indices.length - 1; i++) {
				this.stickers[indices[i]] = this.stickers[indices[i + 1]];
			}
			this.stickers[indices[indices.length - 1]] = tmp;
		}
	}

	/**
	 * 2D top-view sticker indekslerini dondurur.
	 * cubingapp main.js Cube.getSvg()'den birebir.
	 */
	getTopViewIndices() {
		if (this.layers === 2) {
			// [Back0, Back1, Left0, U0, U2, Right0, Left1, U1, U3, Right1, Front0, Front1]
			return {
				back: [13, 15],
				left: [16, 18],
				top: [0, 2, 1, 3],
				right: [22, 20],
				front: [4, 6],
			};
		} else if (this.layers === 4) {
			return {
				back: [51, 55, 59, 63],
				left: [64, 68, 72, 76],
				top: [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15],
				right: [92, 88, 84, 80],
				front: [16, 20, 24, 28],
			};
		}
		return null;
	}

	/**
	 * Top-view pattern string olusturur.
	 * Format: [top stickers][front strip][right strip][back strip][left strip]
	 */
	getPattern() {
		const faces = 'UFDBLR'; // face 0=U, 1=F, 2=D, 3=B, 4=L, 5=R
		const layersSq = sq(this.layers);
		const toFace = (stickerIdx) => faces[Math.floor(this.stickers[stickerIdx] / layersSq)];

		const indices = this.getTopViewIndices();
		if (!indices) return null;

		const parts = [
			...indices.top.map(toFace),
			...indices.front.map(toFace),
			...indices.right.map(toFace),
			...indices.back.map(toFace),
			...indices.left.map(toFace),
		];

		return parts.join('');
	}
}

// ─── Pyraminx Simulator ───

class Pyraminx {
	constructor() {
		this.state = [
			0, 0, 0, 0, 0, 0, 0, 0, 0,
			1, 1, 1, 1, 1, 1, 1, 1, 1,
			2, 2, 2, 2, 2, 2, 2, 2, 2,
			3, 3, 3, 3, 3, 3, 3, 3, 3,
		];
	}

	performMove(move) {
		const F1=0,F2=1,F3=2,F4=3,F5=4,F6=5,F7=6,F8=7,F9=8;
		const L1=9,L2=10,L3=11,L4=12,L5=13,L6=14,L7=15,L8=16,L9=17;
		const R1=18,R2=19,R3=20,R4=21,R5=22,R6=23,R7=24,R8=25,R9=26;
		const D1=27,D2=28,D3=29,D4=30,D5=31,D6=32,D7=33,D8=34,D9=35;

		const U_CYCLES = [[F2,L2,R2],[F3,L3,R3],[F4,L4,R4]];
		const U_TIP_CYCLES = [[F1,L1,R1]];
		const L_CYCLES = [[F2,D4,L7],[F6,D3,L8],[F7,D2,L4]];
		const L_TIP_CYCLES = [[F5,D1,L9]];
		const R_CYCLES = [[F4,R7,D4],[F8,R6,D8],[F7,R2,D7]];
		const R_TIP_CYCLES = [[F9,R5,D9]];
		const B_CYCLES = [[L2,R4,D6],[L6,R8,D5],[L7,R7,D2]];
		const B_TIP_CYCLES = [[L9,R9,D9]];

		switch (move) {
			case 'U': cycles(this.state, U_CYCLES, true); cycles(this.state, U_TIP_CYCLES, true); break;
			case "U'": cycles(this.state, U_CYCLES, false); cycles(this.state, U_TIP_CYCLES, false); break;
			case 'L':
			case "L2'": cycles(this.state, L_CYCLES, true); cycles(this.state, L_TIP_CYCLES, true); break;
			case "L'":
			case 'L2': cycles(this.state, L_CYCLES, false); cycles(this.state, L_TIP_CYCLES, false); break;
			case 'R':
			case "R2'": cycles(this.state, R_CYCLES, true); cycles(this.state, R_TIP_CYCLES, true); break;
			case "R'":
			case 'R2': cycles(this.state, R_CYCLES, false); cycles(this.state, R_TIP_CYCLES, false); break;
			case 'B':
			case "B2'": cycles(this.state, B_CYCLES, true); cycles(this.state, B_TIP_CYCLES, true); break;
			case "B'":
			case 'B2': cycles(this.state, B_CYCLES, false); cycles(this.state, B_TIP_CYCLES, false); break;
			default: console.error('Invalid pyraminx move:', move);
		}
	}

	performAlg(alg) {
		alg.replaceAll('(', '').replaceAll(')', '').split(' ').forEach((m) => {
			if (m) this.performMove(m);
		});
	}

	getPattern() {
		return this.state.join('');
	}
}

// ─── Skewb Simulator ───

class Skewb {
	constructor() {
		this.stickers = {
			U:0, UBL:0, URB:0, UFR:0, ULF:0,
			F:1, FUL:1, FRU:1, FDR:1, FLD:1,
			R:2, RUF:2, RBU:2, RDB:2, RFD:2,
			B:3, BLU:3, BUR:3, BDL:3, BRD:3,
			L:4, LFU:4, LUB:4, LDF:4, LBD:4,
			D:5, DFL:5, DRF:5, DLB:5, DBR:5,
		};
	}

	performMove(move) {
		const R_CYCLES = [['U','R','F'],['UFR','RUF','FRU'],['ULF','RBU','FDR'],['FUL','URB','RFD'],['LFU','BUR','DRF']];
		const F_CYCLES = [['U','F','L'],['ULF','FUL','LFU'],['UFR','FLD','LUB'],['FRU','LDF','UBL'],['RUF','DFL','BLU']];
		const Y_CYCLES = [['F','L','B','R'],['ULF','UBL','URB','UFR'],['LFU','BLU','RBU','FRU'],['FUL','LUB','BUR','RUF'],['DFL','DLB','DBR','DRF'],['FLD','LBD','BRD','RFD'],['LDF','BDL','RDB','FDR']];
		const Z_CYCLES = [['U','R','D','L'],['ULF','RUF','DRF','LDF'],['LFU','UFR','RFD','DFL'],['FUL','FRU','FDR','FLD'],['UBL','RBU','DBR','LBD'],['BLU','BUR','BRD','BDL'],['LUB','URB','RDB','DLB']];

		switch (move) {
			case 'R': cycles(this.stickers, R_CYCLES, true); break;
			case "R'": cycles(this.stickers, R_CYCLES, false); break;
			case 'F': cycles(this.stickers, F_CYCLES, true); break;
			case "F'": cycles(this.stickers, F_CYCLES, false); break;
			case 'y': cycles(this.stickers, Y_CYCLES, true); break;
			case 'y2':
			case "y2'": cycles(this.stickers, Y_CYCLES, true); cycles(this.stickers, Y_CYCLES, true); break;
			case "y'": cycles(this.stickers, Y_CYCLES, false); break;
			case 'z': cycles(this.stickers, Z_CYCLES, true); break;
			case 'z2':
			case "z2'": cycles(this.stickers, Z_CYCLES, true); cycles(this.stickers, Z_CYCLES, true); break;
			case "z'": cycles(this.stickers, Z_CYCLES, false); break;
			default: console.error('Invalid skewb move:', move);
		}
	}

	performAlg(alg) {
		alg.replaceAll('(', '').replaceAll(')', '').split(' ').forEach((m) => {
			if (m) this.performMove(m);
		});
	}

	/**
	 * 17 visible sticker degerini cubingapp SVG polygon sirasina gore dondurur.
	 * Sira: U, UBL, URB, UFR, ULF, FUL, F, FRU, RUF, R, RBU, BLU, B, BUR, LFU, L, LUB
	 */
	getPattern() {
		const order = ['U','UBL','URB','UFR','ULF','FUL','F','FRU','RUF','R','RBU','BLU','B','BUR','LFU','L','LUB'];
		return order.map((k) => this.stickers[k]).join('');
	}
}

// ─── SQ1 Simulator ───

class SQ1 {
	constructor() {
		this.top = [0,1,2,3,4,5,6,7];
		this.bottom = [8,9,10,11,12,13,14,15];
	}

	performAlg(alg) {
		const moves = alg.split(' ');
		for (const move of moves) {
			if (move === '/') {
				this.slash();
				continue;
			}
			const parts = move.split(',');
			if (parts.length === 2) {
				this.U(parseInt(parts[0]));
				this.D(parseInt(parts[1]));
			}
		}
	}

	slash() {
		let topCount = 0, bottomCount = 0, topIndex = 0, bottomIndex = 0;
		for (const value of this.top) {
			topCount += value % 2 === 0 ? 2 : 1;
			topIndex++;
			if (topCount === 6) break;
		}
		for (const value of this.bottom) {
			bottomCount += value % 2 === 0 ? 2 : 1;
			bottomIndex++;
			if (bottomCount === 6) break;
		}
		const topTail = this.top.slice(topIndex);
		const bottomTail = this.bottom.slice(bottomIndex);
		this.top = this.top.slice(0, topIndex).concat(bottomTail.reverse());
		this.bottom = this.bottom.slice(0, bottomIndex).concat(topTail.reverse());
	}

	U(n) { this.top = this.turnFace(-n, this.top); }
	D(n) { this.bottom = this.turnFace(n, this.bottom); }

	getTotal(face) {
		return face.reduce((sum, v) => sum + (v % 2 === 0 ? 2 : 1), 0);
	}

	turnFace(n, face) {
		const total = this.getTotal(face);
		if (n < 0) n = total + n;
		let count = 0, index = 0;
		for (const value of face) {
			count += value % 2 === 0 ? 2 : 1;
			index++;
			if (count === n) break;
		}
		return face.slice(index).concat(face.slice(0, index));
	}

	getPattern() {
		return { t: [...this.top], b: [...this.bottom] };
	}
}

// ─── expandNotation (algorithm_engine.ts'den port) ───

function expandNotation(input) {
	// SQ1 detection: / iceriyorsa SQ1 notasyonu
	if (input.includes('/')) {
		return input.replace(/\s+/g, ' ').trim();
	}

	let output = input
		.replace(/["´`']/g, "'")
		.replace(/\[/g, '(')
		.replace(/\]/g, ')')
		.replace(/XYZ/g, 'xyz');
	output = output.replace(/[^RLFBUDMESrlfbudxyz2()']/g, '');
	output = output.replace(/\(/g, ' (');
	output = output.replace(/\)(?!\s)/g, ') ');
	output = output.replace(/'(?![\s)])/g, "' ");
	output = output.replace(/2(?![\s')])/g, '2 ');
	output = output.replace(/([RLFBUDMESrlfbudxyz])(?![\s)'2])/g, '$1 ');
	output = output.replace(/(\s)(?=2)/g, '');
	output = output.replace(/'2/g, "2'");
	output = output.replace(/\s+/g, ' ');
	return output.trim();
}

// ─── Kategori tanimlari ───

const GRAY_MASKS = {
	'Sarah Intermediate': ['F','R','B','L','FUL','FRU','RUF','RBU','BUR','BLU','LUB','LFU'],
	'Sarah Advanced': ['FUL','FRU','RUF','RBU','BUR','BLU','LUB','LFU'],
};

// SQ1 Cube Shape ve CSP icin bottom face mirror
const SQ1_MIRROR_CATEGORIES = new Set(['SQ1 Cube Shape', 'SQ1 CSP']);

const CATEGORY_CONFIG = {
	'2x2 CLL':           { puzzle: '2x2' },
	'2x2 EG1':           { puzzle: '2x2' },
	'2x2 EG2':           { puzzle: '2x2' },
	'4x4 PLL Parity':    { puzzle: '4x4' },
	'Pyraminx LL':        { puzzle: 'pyraminx' },
	'Pyraminx L4E':       { puzzle: 'pyraminx' },
	'Sarah Intermediate': { puzzle: 'skewb' },
	'Sarah Advanced':     { puzzle: 'skewb' },
	'SQ1 Cube Shape':     { puzzle: 'sq1' },
	'SQ1 CP':             { puzzle: 'sq1' },
	'SQ1 CSP':            { puzzle: 'sq1' },
	'SQ1 EO':             { puzzle: 'sq1' },
	'SQ1 EP':             { puzzle: 'sq1' },
	'SQ1 OBL':            { puzzle: 'sq1' },
};

// ─── Main ───

function createPuzzle(type) {
	switch (type) {
		case '2x2': return new Cube(2);
		case '4x4': return new Cube(4);
		case 'pyraminx': return new Pyraminx();
		case 'skewb': return new Skewb();
		case 'sq1': return new SQ1();
	}
	return null;
}

function applyGrayMask(puzzle, category) {
	const gray = GRAY_MASKS[category];
	if (!gray) return;

	if (puzzle instanceof Skewb) {
		gray.forEach((sticker) => {
			puzzle.stickers[sticker] = 6; // 6 = gray
		});
	} else if (puzzle instanceof Cube) {
		const layersSq = sq(puzzle.layers);
		gray.forEach((idx) => {
			puzzle.stickers[idx] = layersSq * 6; // Beyond any valid face
		});
	}
}

function cleanAlgorithm(alg, puzzleType) {
	// SQ1: parantez kaldir, fazla bosluk temizle
	if (puzzleType === 'sq1') {
		return alg.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
	}
	// Diger: parantez kaldir
	return alg.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
}

function main() {
	console.log('Puzzle pattern uretimi basliyor...\n');

	const algsData = JSON.parse(readFileSync('public/trainer/default-algs.json', 'utf8'));
	const result = {};
	let totalCount = 0;
	let errors = 0;

	for (const [category, config] of Object.entries(CATEGORY_CONFIG)) {
		const subsets = algsData[category];
		if (!subsets) {
			console.warn(`Kategori bulunamadi: ${category}`);
			continue;
		}

		if (!result[config.puzzle]) {
			result[config.puzzle] = {};
		}

		let catCount = 0;

		for (const subset of subsets) {
			for (const entry of subset.algorithms) {
				const allAlgs = [entry.algorithm, ...(entry.alternatives || [])];

				for (const algorithm of allAlgs) {
					try {
						const puzzle = createPuzzle(config.puzzle);
						const cleanAlg = cleanAlgorithm(algorithm, config.puzzle);
						const inverted = invertAlg(cleanAlg);

						// cubingapp birebir: gray mask ONCE, inverted alg SONRA
						// Gray sticker'lar hareket eder, nereye giderse gitsin gray kalir
						applyGrayMask(puzzle, category);
						puzzle.performAlg(inverted);

						const pattern = puzzle.getPattern();
						const key = `${category}::${expandNotation(algorithm)}`;

						result[config.puzzle][key] = pattern;
						catCount++;
						totalCount++;
					} catch (e) {
						console.error(`  HATA [${category}] "${algorithm}":`, e.message);
						errors++;
					}
				}
			}
		}

		console.log(`  ${category}: ${catCount} pattern`);
	}

	// SQ1 icin mirror bilgisini metadata olarak ekle
	if (result.sq1) {
		result.sq1._mirror = [...SQ1_MIRROR_CATEGORIES];
	}

	writeFileSync('public/trainer/puzzle-patterns.json', JSON.stringify(result));
	const fileSize = (readFileSync('public/trainer/puzzle-patterns.json').length / 1024).toFixed(1);
	console.log(`\nToplam: ${totalCount} pattern, ${errors} hata`);
	console.log(`Dosya: public/trainer/puzzle-patterns.json (${fileSize} KB)`);
}

main();
