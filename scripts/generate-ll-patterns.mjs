/**
 * Pre-computes algorithm patterns for 2D-LL categories.
 * Output: public/trainer/ll-patterns.json
 *
 * Usage: node scripts/generate-ll-patterns.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

// ─── Reid ordering (ported from pattern_utils.ts) ───

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

// ─── 2D-LL facelet extraction ───

// Kociemba facelet indices for the 21 visible 2D-LL positions:
// Top face (9): U0-U8
// Front top row (3): F18, F19, F20
// Right top row (3): R11, R10, R9 (back→front order from above)
// Back top row (3): B47, B46, B45 (left→right from above)
// Left top row (3): L36, L37, L38
const LL_FACELET_INDICES = [
	0, 1, 2, 3, 4, 5, 6, 7, 8,
	18, 19, 20,
	11, 10, 9,
	47, 46, 45,
	36, 37, 38,
];

// 2D-LL categories (category name contains 'll' or has OLL stickering)
const LL_CATEGORIES = [
	'PLL', 'OLL', '2-Look PLL', '2-Look OLL',
	'COLL', 'OLLCP', 'ZBLL', 'ZBLS', 'CMLL',
	'2-Look CMLL', 'OH-CMLL', 'WVLS', 'VHLS',
];

/**
 * Converts algorithm to a format cubing.js can parse.
 */
function cleanAlgorithm(alg) {
	let s = alg
		.replace(/\+/g, ' ')    // D+U' → D U'
		.replace(/’/g, "'") // curly apostrophe
		.replace(/["“”]/g, "'") // smart quotes
		.replace(/'2/g, "2'");   // U'2 → U2' (cubing.js format)

	// Wide move notation: Rw → r, Lw → l, etc.
	s = s.replace(/([RLFBUD])w/g, (_, m) => m.toLowerCase());

	// Single-move parentheses: (U2) → U2, (U') → U'
	s = s.replace(/\(([RLFBUDMESrlfbudxyz][2']?)\)/g, '$1');

	// Add spacing with expandNotation (ZBLS notation)
	s = expandNotation(s);

	return s;
}

/**
 * Port of expandNotation from algorithm_engine.ts.
 * The algorithm prop passed to AlgorithmCard is expanded with this function,
 * so JSON keys must use the same format.
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

async function main() {
	console.log('Loading cubing.js kpuzzle...');
	const kpuzzle = await cube3x3x3.kpuzzle();
	const solved = kpuzzle.defaultPattern();

	const algsData = JSON.parse(readFileSync('public/trainer/default-algs.json', 'utf8'));

	const patterns = {};
	let count = 0;
	let errors = 0;

	for (const category of LL_CATEGORIES) {
		const subsets = algsData[category];
		if (!subsets) {
			console.warn(`Category not found: ${category}`);
			continue;
		}

		let catCount = 0;
		for (const subset of subsets) {
			for (const entry of subset.algorithms) {
				// Process both primary + alternatives
				const allAlgs = [entry.algorithm, ...(entry.alternatives || [])];

				for (const algorithm of allAlgs) {
					try {
						const cleanAlg = cleanAlgorithm(algorithm);
						const algObj = Alg.fromString(cleanAlg);

						const inverse = algObj.invert();
						const setupState = solved.applyAlg(inverse);

						const facelets = patternToFacelets(setupState);
						const llPattern = LL_FACELET_INDICES.map(i => facelets[i]).join('');

						const expandedAlg = expandNotation(algorithm);
						patterns[expandedAlg] = llPattern;
						catCount++;
						count++;
					} catch (e) {
						console.error(`  ERROR [${category}] "${algorithm}":`, e.message);
						errors++;
					}
				}
			}
		}
		console.log(`  ${category}: ${catCount} patterns generated`);
	}

	writeFileSync('public/trainer/ll-patterns.json', JSON.stringify(patterns));
	const fileSize = (readFileSync('public/trainer/ll-patterns.json').length / 1024).toFixed(1);
	console.log(`\nTotal: ${count} patterns, ${errors} errors`);
	console.log(`File: public/trainer/ll-patterns.json (${fileSize} KB)`);
}

main().catch(err => {
	console.error('Script failed:', err);
	process.exit(1);
});
