/**
 * Her algoritma için en kısa setup algoritmasını hesaplar.
 * 3x3 kategorilerinde Kociemba solver kullanır, basit inverse ile karşılaştırır.
 * Non-3x3 kategorilerde (2x2, Pyraminx, Skewb, SQ1) algoritma inverse'ünü kullanır.
 *
 * Çıktı: default-algs.json'a her algoritmaya "setup" field'i eklenir.
 *
 * Kullanım: node scripts/generate-setup-algorithms.mjs
 */

import {readFileSync, writeFileSync, copyFileSync} from 'fs';
import {createRequire} from 'module';
import {cube3x3x3} from 'cubing/puzzles';
import {Alg} from 'cubing/alg';

const require = createRequire(import.meta.url);
const Cube = require('cubejs');

// ─── Reid ordering (pattern_utils.ts'den port) ───

const REID_EDGE_ORDER = 'UF UR UB UL DF DR DB DL FR FL BR BL'.split(' ');
const REID_CORNER_ORDER = 'UFR URB UBL ULF DRF DFL DLB DBR'.split(' ');
const REID_CENTER_ORDER = 'U L F R B D'.split(' ');

const REID_TO_FACELETS_MAP = [
	[1, 2, 0], [0, 2, 0], [1, 1, 0], [0, 3, 0], [2, 0, 0], [0, 1, 0],
	[1, 3, 0], [0, 0, 0], [1, 0, 0], [1, 0, 2], [0, 1, 1], [1, 1, 1],
	[0, 8, 1], [2, 3, 0], [0, 10, 1], [1, 4, 1], [0, 5, 1], [1, 7, 2],
	[1, 3, 2], [0, 0, 1], [1, 0, 1], [0, 9, 0], [2, 2, 0], [0, 8, 0],
	[1, 5, 1], [0, 4, 1], [1, 4, 2], [1, 5, 0], [0, 4, 0], [1, 4, 0],
	[0, 7, 0], [2, 5, 0], [0, 5, 0], [1, 6, 0], [0, 6, 0], [1, 7, 0],
	[1, 2, 2], [0, 3, 1], [1, 3, 1], [0, 11, 1], [2, 1, 0], [0, 9, 1],
	[1, 6, 1], [0, 7, 1], [1, 5, 2], [1, 1, 2], [0, 2, 1], [1, 2, 1],
	[0, 10, 0], [2, 4, 0], [0, 11, 0], [1, 7, 1], [0, 6, 1], [1, 6, 2],
];

const CANONICAL_CENTERS = JSON.stringify([0, 1, 2, 3, 4, 5]);

// ─── 3x3 kategorileri (Kociemba solver kullanılacak) ───

const CATEGORIES_3X3 = [
	'PLL', 'OLL', 'F2L', '2-Look PLL', '2-Look OLL',
	'COLL', 'OLLCP', 'ZBLL', 'ZBLS', 'CMLL', '2-Look CMLL', 'OH-CMLL',
	'WVLS', 'L6E-EO', 'L6E-EOLR', 'VHLS',
];

// Non-3x3 kategoriler: setup olarak inverse kullan
const CATEGORIES_NON_3X3 = [
	'2x2 CLL', '2x2 EG1', '2x2 EG2', '2x2 PBL',
	'4x4 PLL Parity',
	'Pyraminx LL', 'Pyraminx L4E',
	'Sarah Intermediate', 'Sarah Advanced',
	'SQ1 Cube Shape', 'SQ1 CP', 'SQ1 CSP', 'SQ1 EO', 'SQ1 EP', 'SQ1 OBL',
];

// ─── Utility fonksiyonlar ───

function rotateLeft(s, i) {
	return s.slice(i) + s.slice(0, i);
}

function patternToFacelets(pattern) {
	const output = [[], []];
	for (let i = 0; i < 12; i++) {
		output[0].push(
			rotateLeft(
				REID_EDGE_ORDER[pattern.patternData['EDGES'].pieces[i]],
				pattern.patternData['EDGES'].orientation[i]
			)
		);
	}
	for (let i = 0; i < 8; i++) {
		output[1].push(
			rotateLeft(
				REID_CORNER_ORDER[pattern.patternData['CORNERS'].pieces[i]],
				pattern.patternData['CORNERS'].orientation[i]
			)
		);
	}
	output.push(REID_CENTER_ORDER);
	return REID_TO_FACELETS_MAP.map(([orbit, perm, ori]) => output[orbit][perm][ori]).join('');
}

/**
 * 24 oryantasyonun tamamını deneyerek center'ları kanonik konuma getirir.
 * {I, x, x2, x', z, z'} × {I, y, y2, y'} = 24 oryantasyon
 */
function fixOrientation24(pattern) {
	if (JSON.stringify(pattern.patternData['CENTERS'].pieces) === CANONICAL_CENTERS) {
		return pattern;
	}

	const bases = ['', 'x', 'x2', "x'", 'z', "z'"];
	const yRots = ['', 'y', 'y2', "y'"];

	for (const base of bases) {
		for (const yRot of yRots) {
			const rotation = [base, yRot].filter(Boolean).join(' ');
			if (!rotation) continue; // identity zaten denendi
			const result = pattern.applyAlg(rotation);
			if (JSON.stringify(result.patternData['CENTERS'].pieces) === CANONICAL_CENTERS) {
				return result;
			}
		}
	}

	return null; // 24 oryantasyonun hiçbiri çalışmadı
}

/**
 * cubing.js'in parse edebileceği formata dönüştürür.
 */
function cleanAlgorithm(alg) {
	let s = alg
		.replace(/\+/g, ' ')
		.replace(/\u2019/g, "'")
		.replace(/["\u201C\u201D]/g, "'")
		.replace(/'2/g, "2'");

	s = s.replace(/([RLFBUD])w/g, (_, m) => m.toLowerCase());
	s = s.replace(/\(([RLFBUDMESrlfbudxyz][2']?)\)/g, '$1');
	s = expandNotation(s);
	return s;
}

/**
 * algorithm_engine.ts'deki expandNotation'ın portu.
 */
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

/**
 * Tek bir move'u invert eder: R → R', R' → R, R2 → R2
 */
function invertMove(move) {
	if (move.endsWith("'")) return move.slice(0, -1);
	if (move.endsWith('2')) return move;
	return move + "'";
}

/**
 * Face move mi kontrol eder (U, D, L, R, F, B + 2 veya ')
 */
function isFaceMove(m) {
	return /^[UDLRFB][2']?$/.test(m);
}

/**
 * Algoritma stringini move count (ETM) olarak say.
 */
function countMoves(algStr) {
	return algStr.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Kociemba çözümünü invert eder: "R U2 F'" → "F U2 R'"
 */
function invertSolution(solution) {
	return solution.trim().split(/\s+/).reverse().map(invertMove).join(' ');
}

/**
 * SQ1 algoritma notasyonunda inverse yapar.
 * SQ1 notasyonu: (a,b) / (c,d) / ... şeklinde tuple'lar.
 * Inverse: sırayı ters çevir, sayıları negate et.
 */
function invertSQ1(alg) {
	// SQ1 notasyonunu parse et
	const tokens = [];
	const parts = alg.split('/');

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i].trim();
		if (part) {
			// (a,b) tuple'ını parse et
			const match = part.match(/\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?/);
			if (match) {
				tokens.push({type: 'tuple', a: parseInt(match[1]), b: parseInt(match[2])});
			}
		}
		if (i < parts.length - 1) {
			tokens.push({type: 'slash'});
		}
	}

	// Reverse ve negate
	tokens.reverse();
	return tokens.map(t => {
		if (t.type === 'slash') return '/';
		return `(${-t.a},${-t.b})`;
	}).join(' ');
}

// ─── Ana fonksiyon ───

async function main() {
	console.log('cubing.js kpuzzle yükleniyor...');
	const kpuzzle = await cube3x3x3.kpuzzle();
	const solved = kpuzzle.defaultPattern();

	console.log('cubejs solver başlatılıyor...');
	Cube.initSolver();
	console.log('Solver hazır.\n');

	const inputPath = 'public/trainer/default-algs.json';
	const backupPath = 'public/trainer/default-algs.backup.json';

	const algsData = JSON.parse(readFileSync(inputPath, 'utf8'));

	// Backup al
	copyFileSync(inputPath, backupPath);
	console.log(`Backup: ${backupPath}\n`);

	// İstatistikler
	let total = 0;
	let kociembaUsed = 0;
	let inverseUsed = 0;
	let skipped = 0;
	let errors = 0;

	// ─── 3x3 kategorileri: Kociemba solver ───

	for (const category of CATEGORIES_3X3) {
		const subsets = algsData[category];
		if (!subsets) {
			console.warn(`Kategori bulunamadı: ${category}`);
			continue;
		}

		let catKociemba = 0;
		let catInverse = 0;
		let catErrors = 0;

		for (const subset of subsets) {
			for (const entry of subset.algorithms) {
				try {
					const cleanAlg = cleanAlgorithm(entry.algorithm);
					const algObj = Alg.fromString(cleanAlg);

					// 1. Recognition state hesapla
					const inverse = algObj.invert();
					const recognitionState = solved.applyAlg(inverse);

					// 2. Center normalizasyonu
					let normalized = recognitionState;
					const centersStr = JSON.stringify(normalized.patternData['CENTERS'].pieces);

					if (centersStr !== CANONICAL_CENTERS) {
						normalized = fixOrientation24(recognitionState);
						if (!normalized) {
							console.error(`  HATA [${category}] "${entry.name}": Center normalize edilemedi`);
							catErrors++;
							errors++;
							total++;
							continue;
						}
					}

					// 3. Facelets → cubejs
					const facelets = patternToFacelets(normalized);
					const cube = Cube.fromString(facelets);

					// 4. Kociemba çözümü (recognition → solved)
					const solution = cube.solve();
					const kociembaSetup = invertSolution(solution);
					const kociembaMoves = countMoves(kociembaSetup);

					// 5. Basit inverse ile karşılaştır (tüm move tipleri: face, wide, M/E/S, rotasyon)
					const algMoves = cleanAlg.replace(/[()]/g, '').trim().split(/\s+/).filter(Boolean);
					const simpleInverse = algMoves.slice().reverse().map(invertMove).join(' ');
					const inverseMoves = countMoves(simpleInverse);

					let bestSetup;
					if (inverseMoves <= kociembaMoves) {
						bestSetup = simpleInverse;
						catInverse++;
					} else {
						bestSetup = kociembaSetup;
						catKociemba++;
					}

					entry.setup = bestSetup;
					total++;
				} catch (e) {
					console.error(`  HATA [${category}] "${entry.name}" (${entry.algorithm}): ${e.message}`);
					catErrors++;
					errors++;
					total++;
				}
			}
		}

		const catTotal = catKociemba + catInverse + catErrors;
		console.log(`  ${category}: ${catTotal} algoritma (kociemba: ${catKociemba}, inverse: ${catInverse}, hata: ${catErrors})`);
		kociembaUsed += catKociemba;
		inverseUsed += catInverse;
	}

	// ─── Non-3x3 kategorileri: inverse kullan ───

	console.log('');
	for (const category of CATEGORIES_NON_3X3) {
		const subsets = algsData[category];
		if (!subsets) {
			console.warn(`Kategori bulunamadı: ${category}`);
			continue;
		}

		let catCount = 0;
		let catSkipped = 0;

		for (const subset of subsets) {
			for (const entry of subset.algorithms) {
				total++;

				try {
					const alg = entry.algorithm;

					// SQ1 notasyonu "/" içerir
					if (alg.includes('/')) {
						entry.setup = invertSQ1(alg);
						catCount++;
						inverseUsed++;
						continue;
					}

					// Genel non-3x3: cleanAlgorithm + cubing.js invert
					const cleanAlg = cleanAlgorithm(alg);
					const algMoves = cleanAlg.replace(/[()]/g, '').trim().split(/\s+/).filter(Boolean);
					const simpleInverse = algMoves.slice().reverse().map(invertMove).join(' ');
					entry.setup = simpleInverse;
					catCount++;
					inverseUsed++;
				} catch (e) {
					console.error(`  HATA [${category}] "${entry.name}": ${e.message}`);
					errors++;
				}
			}
		}

		if (catCount > 0 || catSkipped > 0) {
			console.log(`  ${category}: ${catCount} inverse`);
		}
		skipped += catSkipped;
	}

	// ─── JSON yaz ───

	writeFileSync(inputPath, JSON.stringify(algsData, null, '\t'));
	const fileSize = (readFileSync(inputPath).length / 1024).toFixed(1);

	console.log(`\n${'─'.repeat(50)}`);
	console.log(`Toplam: ${total} algoritma`);
	console.log(`  Kociemba: ${kociembaUsed}`);
	console.log(`  Inverse: ${inverseUsed}`);
	console.log(`  Atlanan: ${skipped}`);
	console.log(`  Hata: ${errors}`);
	console.log(`Dosya: ${inputPath} (${fileSize} KB)`);
}

main().catch(err => {
	console.error('Script başarısız:', err);
	process.exit(1);
});
