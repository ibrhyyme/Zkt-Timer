/**
 * WVLS/VHLS kategorileri icin izometrik 3-yuz pattern'lerini hesaplar.
 * cubingapp Cube class'i kullanarak gray mask + inverse alg uygular.
 *
 * Cikti: public/trainer/isometric-patterns.json
 * Format: { "algorithm": "27-char-pattern" }
 *   - Ilk 9 char: U face (column-major)
 *   - Sonraki 9 char: F face (column-major)
 *   - Son 9 char: R face (column-major)
 *   - Her char: U/F/D/B/L/R (yuz rengi) veya X (gray)
 *
 * Kullanim: node scripts/generate-isometric-patterns.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

// ─── cubingapp Cube class portu (minimal) ───

function sq(x) { return x * x; }

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

function invertAlg(alg) {
	if (!alg) return "";
	return alg.split(" ").map(move => {
		if (move.endsWith("'")) return move.slice(0, -1);
		return move + "'";
	}).reverse().join(" ");
}

class Cube {
	constructor(layers) {
		this.layers = layers;
		this.stickers = Array.from({ length: layers * layers * 6 }, (_, i) => i);
		this.affectedStickers = Array(layers * layers * 6).fill(false);
		this.animationQueue = [];
	}

	resetAffectedStickers() {
		this.affectedStickers = Array(this.stickers.length).fill(false);
	}

	getMoveMap() {
		return {
			"x": (f) => this.cubeRotate(0, f),
			"y": (f) => this.cubeRotate(1, f),
			"z": (f) => this.cubeRotate(2, f),
			"U": (f, n) => this.turn(1, n, f),
			"Uw": (f, n) => { n = Math.max(n, 1); this.wideTurn(1, 0, n, f); },
			"u": (f, n) => { n = Math.max(n, 1); this.wideTurn(1, 0, n, f); },
			"D": (f, n) => this.turn(1, this.layers - 1 - n, !f),
			"Dw": (f, n) => { n = Math.max(n, 1); this.wideTurn(1, this.layers - 1, this.layers - 1 - n, !f); },
			"d": (f, n) => { n = Math.max(n, 1); this.wideTurn(1, this.layers - 1, this.layers - 1 - n, !f); },
			"F": (f, n) => this.turn(2, n, f),
			"Fw": (f, n) => { n = Math.max(n, 1); this.wideTurn(2, 0, n, f); },
			"f": (f, n) => { n = Math.max(n, 1); this.wideTurn(2, 0, n, f); },
			"B": (f, n) => this.turn(2, this.layers - 1 - n, !f),
			"Bw": (f, n) => { n = Math.max(n, 1); this.wideTurn(2, this.layers - 1, this.layers - 1 - n, !f); },
			"b": (f, n) => { n = Math.max(n, 1); this.wideTurn(2, this.layers - 1, this.layers - 1 - n, !f); },
			"L": (f, n) => this.turn(0, this.layers - 1 - n, !f),
			"Lw": (f, n) => { n = Math.max(n, 1); this.wideTurn(0, this.layers - 1, this.layers - 1 - n, !f); },
			"l": (f, n) => { n = Math.max(n, 1); this.wideTurn(0, this.layers - 1, this.layers - 1 - n, !f); },
			"R": (f, n) => this.turn(0, n, f),
			"Rw": (f, n) => { n = Math.max(n, 1); this.wideTurn(0, 0, n, f); },
			"r": (f, n) => { n = Math.max(n, 1); this.wideTurn(0, 0, n, f); },
			"M": (f) => this.sliceTurn(0, !f),
			"E": (f) => this.sliceTurn(1, !f),
			"S": (f) => this.sliceTurn(2, f),
		};
	}

	performMove(move, forward = true) {
		if (!move) return;
		const { preNumber, middle, postNumber, prime } = parseMove(move);
		const moveMap = this.getMoveMap();
		const moveFunc = moveMap[middle];
		if (!moveFunc) {
			console.error("Invalid move:", move);
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
		const moves = alg.split(" ");
		for (const move of moves) {
			this.performMove(move, true);
			this.animationQueue = [];
		}
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

	wideTurn(axis, startlayer, endLayer, clockwise) {
		this.resetAffectedStickers();
		const layer1 = Math.min(startlayer, endLayer);
		const layer2 = Math.max(startlayer, endLayer);
		for (let i = layer1; i <= layer2; i++) {
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

	turnXAxis(layer, clockwise) {
		for (let i = 1; i <= this.layers; i++) {
			this.cycle(clockwise,
				0 * sq(this.layers) + sq(this.layers) - i - layer * this.layers,
				3 * sq(this.layers) + sq(this.layers) - i - layer * this.layers,
				2 * sq(this.layers) + sq(this.layers) - i - layer * this.layers,
				1 * sq(this.layers) + sq(this.layers) - i - layer * this.layers,
			);
		}
	}

	turnYAxis(layer, clockwise) {
		for (let i = 0; i < this.layers; i++) {
			this.cycle(clockwise,
				1 * sq(this.layers) + i * this.layers + layer,
				4 * sq(this.layers) + i * this.layers + layer,
				3 * sq(this.layers) + (this.layers - i - 1) * this.layers + (this.layers - 1) - layer,
				5 * sq(this.layers) + i * this.layers + layer,
			);
		}
	}

	turnZAxis(layer, clockwise) {
		for (let i = 0; i < this.layers; i++) {
			this.cycle(clockwise,
				0 * sq(this.layers) + (i + 1) * this.layers - 1 - layer,
				5 * sq(this.layers) + i + this.layers * layer,
				2 * sq(this.layers) + (this.layers - i - 1) * this.layers + layer,
				4 * sq(this.layers) + sq(this.layers) - (i + 1) - layer * this.layers,
			);
		}
	}

	turnOuter(face, clockwise) {
		if (this.layers % 2 !== 0) {
			const center = face * sq(this.layers) + Math.floor(sq(this.layers) / 2);
			this.affectedStickers[center] = true;
		}
		for (let i = 0; i < Math.floor(this.layers / 2); i++) {
			const offset = face * sq(this.layers);
			const topLeft = offset + (this.layers + 1) * i;
			const topRight = offset + (this.layers - 1) * (this.layers - i);
			const bottomRight = offset + (this.layers + 1) * (this.layers - i - 1);
			const bottomLeft = offset + (this.layers - 1) * (i + 1);
			this.cycle(clockwise, topLeft, topRight, bottomRight, bottomLeft);

			const numEdges = this.layers - 2 * (i + 1);
			for (let j = 0; j < numEdges; j++) {
				const top = topLeft + this.layers * (j + 1);
				const right = topRight + j + 1;
				const bottom = bottomLeft + this.layers * (numEdges - j);
				const left = topLeft + (numEdges - j);
				this.cycle(clockwise, top, right, bottom, left);
			}
		}
	}

	cycle(clockwise, ...indices) {
		indices.forEach(i => this.affectedStickers[i] = true);
		if (clockwise) {
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
	 * Sticker degerini yuz harfine cevirir.
	 * cubingapp renk mantigi: Math.floor(sticker / layersSq) → face index
	 * Face order: 0=U, 1=F, 2=D, 3=B, 4=L, 5=R, 6+=gray
	 */
	stickerToFace(stickerValue) {
		const FACES = ['U', 'F', 'D', 'B', 'L', 'R'];
		const faceIdx = Math.floor(stickerValue / sq(this.layers));
		return faceIdx < 6 ? FACES[faceIdx] : 'X';
	}

	/**
	 * U + F + R yuzlerinin pattern string'ini dondurur.
	 * Her yuz 9 char (column-major), toplam 27 char.
	 */
	getIsometricPattern() {
		const layersSq = sq(this.layers);
		let pattern = '';

		// U face: stickers 0..8
		for (let i = 0; i < layersSq; i++) {
			pattern += this.stickerToFace(this.stickers[i]);
		}

		// F face: stickers 9..17
		for (let i = layersSq; i < 2 * layersSq; i++) {
			pattern += this.stickerToFace(this.stickers[i]);
		}

		// R face: stickers 45..53
		for (let i = 5 * layersSq; i < 6 * layersSq; i++) {
			pattern += this.stickerToFace(this.stickers[i]);
		}

		return pattern;
	}
}

// ─── Algorithm temizleme (generate-ll-patterns.mjs'den) ───

function expandNotation(input) {
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

function cleanAlgorithm(alg) {
	let s = alg
		.replace(/\+/g, ' ')
		.replace(/\u2019/g, "'")
		.replace(/["\u201C\u201D]/g, "'")
		.replace(/'2/g, "2'");
	s = s.replace(/([RLFBUD])w/g, (_, m) => m.toLowerCase());
	s = s.replace(/\(([RLFBUDMESrlfbudxyz][2']?)\)/g, '$1');
	// Parantezleri kaldir (cubingapp da ayni seyi yapiyor)
	s = s.replace(/\(/g, '').replace(/\)/g, '');
	s = expandNotation(s);
	return s;
}

// ─── Kategori konfigurasyonu ───

// WVLS/VHLS icin gray mask: tum 12 LL side sticker
// cubingapp Winter-Variation.json'dan: [9,12,15,29,32,35,36,39,42,45,48,51]
const ISOMETRIC_CATEGORIES = {
	'WVLS': { gray: [9, 12, 15, 29, 32, 35, 36, 39, 42, 45, 48, 51] },
	'VHLS': { gray: [9, 12, 15, 29, 32, 35, 36, 39, 42, 45, 48, 51] },
};

// ─── Ana script ───

function main() {
	console.log('Isometric pattern uretici baslatiliyor...');

	const algsData = JSON.parse(readFileSync('public/trainer/default-algs.json', 'utf8'));
	const patterns = {};
	let count = 0;
	let errors = 0;

	for (const [category, config] of Object.entries(ISOMETRIC_CATEGORIES)) {
		const subsets = algsData[category];
		if (!subsets) {
			console.warn(`  Kategori bulunamadi: ${category}`);
			continue;
		}

		let catCount = 0;
		for (const subset of subsets) {
			for (const entry of subset.algorithms) {
				const allAlgs = [entry.algorithm, ...(entry.alternatives || [])];

				for (const algorithm of allAlgs) {
					try {
						const cleanAlg = cleanAlgorithm(algorithm);
						const inverted = invertAlg(cleanAlg);

						const cube = new Cube(3);

						// Gray mask uygula (solved state uzerinde)
						for (const idx of config.gray) {
							cube.stickers[idx] = sq(3) * 6; // 54 = gray
						}

						// Inverse algoritmmayi uygula
						cube.performAlg(inverted);

						// U + F + R pattern'i al
						const pattern = cube.getIsometricPattern();

						const expandedAlg = expandNotation(algorithm);
						patterns[expandedAlg] = pattern;
						catCount++;
						count++;
					} catch (e) {
						console.error(`  HATA [${category}] "${algorithm}":`, e.message);
						errors++;
					}
				}
			}
		}
		console.log(`  ${category}: ${catCount} pattern uretildi`);
	}

	writeFileSync('public/trainer/isometric-patterns.json', JSON.stringify(patterns));
	const fileSize = (readFileSync('public/trainer/isometric-patterns.json').length / 1024).toFixed(1);
	console.log(`\nToplam: ${count} pattern, ${errors} hata`);
	console.log(`Dosya: public/trainer/isometric-patterns.json (${fileSize} KB)`);
}

main();
