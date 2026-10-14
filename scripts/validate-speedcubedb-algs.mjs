/**
 * Checks every converted SpeedCubeDB algorithm against cubing.js.
 *
 * Usage: node scripts/validate-speedcubedb-algs.mjs [--dir <data dir>]
 *
 * Input:  data/speedcubedb/speedcubedb-algs.json + speedcubedb-manifest.json
 * Output: data/speedcubedb/speedcubedb-validation.json
 *
 * Two checks per algorithm (the main one and every alternative):
 * 1. parse:  the alg parses and every move exists on the puzzle (cubing.js KPuzzle).
 * 2. solve:  setup + alg reaches the category's goal. The goal is a sticker mask: PLL needs the
 *            whole puzzle solved, OLL needs F2L solved and the U stickers of the last layer up,
 *            F2L ignores the last layer, and so on (GOALS below). A trailing AUF and any final
 *            whole-puzzle rotation are allowed. An alg that only reaches the goal after an extra
 *            AUF in front is reported as "preAuf" with the AUF it needs: it is a correct alg for
 *            the case, but it starts from a different angle than the entry's setup.
 *
 * 3. engine: the trainer runs every alg through cleanAlgorithmForCubing()
 *            (client/util/trainer/algorithm_engine.ts) before it plays or matches it. If the
 *            cleaned alg does something different from the original (or no longer parses), the
 *            alg is reported as "engineMangled": the trainer would drill a different alg.
 *
 * Categories whose goal cannot be expressed as a sticker mask (Square-1 shape steps, 5x5 L2E)
 * or whose notation cubing.js does not speak (Sarah's Skewb notation) get the parse check only.
 */

import {readFileSync, writeFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {puzzles} from 'cubing/puzzles';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const DIR = args[0] === '--dir' ? args[1] : join(ROOT, 'data', 'speedcubedb');

// Goal per category. Mask names are defined in buildMask(); "cubing:<name>" uses a cubing.js
// stickering mask directly (Roux steps, where the M slice is free). "f2l-progress" means the cross
// stays solved and at least one more F2L slot is solved than before the alg: Advanced F2L cases
// have a pair trapped in another slot, and the site lists algs that solve it into either slot
// under the same tab. Not listed (parse only): FRUF (the site's cases
// start in the middle of an F ... F' bracket, so there is no fixed goal), Square-1, 5x5 L2E,
// Skewb Sarah Advanced (Sarah's notation).
const GOALS = {
	'F2L': 'f2l-progress',
	'Advanced F2L': 'f2l-progress',
	'OLL': 'oll',
	'PLL': 'full',
	'COLL': 'coll',
	'WVLS': 'oll',
	'CMLL': 'cubing:CMLL',
	'SBLS': 'cubing:SecondBlock',
	'EO4A': 'cubing:L6EO',
	'Anti PLL': 'full',
	'SV': 'oll',
	'ELL': 'full',
	'CLS': 'oll',
	'1LLL': 'full',
	'OLLCP': 'coll',
	'VLS': 'oll',
	'ZBLL': 'full',
	'2x2 Ortega OLL': 'ortega',
	'2x2 PBL': 'full',
	'2x2 CLL': 'full',
	'2x2 EG1': 'full',
	'2x2 EG2': 'full',
	'4x4 OLL Parity': 'oll',
	'4x4 PLL Parity': 'full',
	'5x5 L2C': 'centers',
	'Megaminx EO': 'eoll',
	'Megaminx CO': 'oll',
	'Megaminx EP': 'epll',
	'Megaminx CP': 'full',
	'Megaminx OLL': 'oll',
	'Megaminx PLL': 'full',
	'Pyraminx LL': 'no-tips',
	'Pyraminx L4E': 'no-tips',
};

// Moves allowed after the alg (and, for "preAuf", before it)
const AUF_MOVES = {
	'3x3x3': ['U'],
	'2x2x2': ['U', 'D'],
	'4x4x4': ['U'],
	'5x5x5': ['U'],
	megaminx: ['U'],
	pyraminx: ['U'],
};

const ROTATION_GENERATORS = {
	'3x3x3': ['x', 'y'],
	'2x2x2': ['x', 'y'],
	'4x4x4': ['x', 'y'],
	'5x5x5': ['x', 'y'],
	megaminx: ['Uv', 'Rv'],
	pyraminx: ['Rv', 'Uv'],
	skewb: ['Rv', 'Lv'],
};

// ─── Puzzle model ───

async function loadPuzzle(id) {
	const loader = puzzles[id];
	const kpuzzle = await loader.kpuzzle();
	const svg = await loader.svg();

	// Sticker colors from the 2D net: element id "<ORBIT>-l<piece>-o<facelet>"
	const color = {};
	for (const m of svg.matchAll(/(?<![-\w])id="([A-Z0-9_]+)-l(\d+)-o(\d+)"[^>]*?style="fill:\s*([^;"]+)/g)) {
		color[`${m[1]}-${m[2]}-${m[3]}`] = m[4].trim();
	}

	const orbits = kpuzzle.definition.orbits.map((o) => ({name: o.orbitName, n: o.numPieces, k: o.numOrientations}));
	const solved = kpuzzle.defaultPattern();

	// Rotation group, generated from the puzzle's whole-puzzle rotations
	const rotations = [];
	const gens = (ROTATION_GENERATORS[id] ?? []).map((m) => kpuzzle.algToTransformation(m));
	if (gens.length) {
		const seen = new Set();
		const queue = [kpuzzle.identityTransformation()];
		while (queue.length) {
			const t = queue.shift();
			const key = JSON.stringify(t.transformationData);
			if (seen.has(key)) continue;
			seen.add(key);
			rotations.push(t);
			for (const g of gens) queue.push(t.applyTransformation(g));
		}
	} else {
		rotations.push(kpuzzle.identityTransformation());
	}

	// Every power of each AUF move: [identity, U, U2, U'] on cubes, five on Megaminx
	const aufs = (AUF_MOVES[id] ?? []).map((m) => {
		const step = kpuzzle.algToTransformation(m);
		const powers = [kpuzzle.identityTransformation()];
		for (let t = step; !isIdentity(t) && powers.length <= 12; t = t.applyTransformation(step)) powers.push(t);
		return powers;
	});

	// Single-sticker pieces (centers) show their one color whatever their orientation
	for (const orbit of orbits) orbit.singleSticker = color[`${orbit.name}-0-1`] === undefined;

	const uColor = color['CORNERS-0-0'];
	const dColor = id === '2x2x2' ? color['CORNERS-4-0'] : null;

	return {id, kpuzzle, color, orbits, solved, rotations, aufs, uColor, dColor};
}

function isIdentity(t) {
	for (const [, o] of Object.entries(t.transformationData)) {
		for (let i = 0; i < o.permutation.length; i++) {
			if (o.permutation[i] !== i || o.orientationDelta[i] !== 0) return false;
		}
	}
	return true;
}

/** Color shown at slot `slot`, facelet `f` of an orbit, for a given pattern. */
function stickerColor(P, pattern, orbit, slot, f) {
	const data = pattern.patternData[orbit.name];
	const piece = data.pieces[slot];
	if (orbit.singleSticker) return P.color[`${orbit.name}-${piece}-0`];
	const o = data.orientation[slot];
	return P.color[`${orbit.name}-${piece}-${(((f - o) % orbit.k) + orbit.k) % orbit.k}`];
}

/** Required stickers: [orbitIndex, slot, facelet, expectedColor][] */
async function buildMask(P, goal) {
	const required = [];
	const solvedColor = (orbit, slot, f) => P.color[`${orbit.name}-${slot}-${f}`];

	if (goal.startsWith('cubing:')) {
		const mask = await puzzles[P.id].stickeringMask(goal.slice(7));
		P.orbits.forEach((orbit, oi) => {
			const pieces = mask.orbits[orbit.name]?.pieces ?? [];
			for (let slot = 0; slot < orbit.n; slot++) {
				for (let f = 0; f < orbit.k; f++) {
					const entry = pieces[slot]?.facelets?.[f];
					const kind = typeof entry === 'string' ? entry : entry?.mask;
					if (kind === 'regular' || kind === 'dim') {
						const c = solvedColor(orbit, slot, f);
						if (c) required.push([oi, slot, f, c]);
					}
				}
			}
		});
		return required;
	}

	P.orbits.forEach((orbit, oi) => {
		for (let slot = 0; slot < orbit.n; slot++) {
			const colors = [];
			for (let f = 0; f < orbit.k; f++) colors.push(solvedColor(orbit, slot, f));
			if (colors.every((c) => c === undefined)) continue;
			const lastLayer = colors.includes(P.uColor);
			const isCorner = orbit.name.startsWith('CORNERS');
			const isEdge = orbit.name.startsWith('EDGES');
			const isCenter = orbit.name.startsWith('CENTERS');

			const need = (f) => colors[f] !== undefined && required.push([oi, slot, f, colors[f]]);
			const needAll = () => colors.forEach((_, f) => need(f));
			const needTop = () => colors.forEach((c, f) => c === P.uColor && need(f));

			switch (goal) {
				case 'full':
					needAll();
					break;
				case 'no-tips':
					if (orbit.name !== 'CORNERS2') needAll();
					break;
				case 'centers':
					if (isCenter) needAll();
					break;
				case 'f2l':
					if (!lastLayer) needAll();
					break;
				case 'oll':
					lastLayer ? needTop() : needAll();
					break;
				case 'coll':
					if (!lastLayer || isCorner || isCenter) needAll();
					else needTop();
					break;
				case 'eoll':
					if (!lastLayer || isCenter) needAll();
					else if (isEdge) needTop();
					break;
				case 'epll':
					if (!lastLayer || isEdge || isCenter) needAll();
					else needTop();
					break;
				case 'ortega':
					colors.forEach((c, f) => (c === P.uColor || c === P.dColor) && need(f));
					break;
				default:
					throw new Error(`Unknown goal ${goal}`);
			}
		}
	});
	return required;
}

/** Center stickers first: a wrong whole-puzzle rotation then fails on the first comparisons. */
function orderMask(P, mask) {
	const weight = ([oi]) => (P.orbits[oi].singleSticker ? 0 : 1);
	return mask.sort((a, b) => weight(a) - weight(b));
}

// cubing.js 3x3x3 piece order: edges UF UR UB UL DF DR DB DL FR FL BR BL,
// corners UFR URB UBL ULF DRF DFL DLB DBR, centers U L F R B D
const SLOTS = [
	{edge: 8, corner: 4},
	{edge: 9, corner: 5},
	{edge: 11, corner: 6},
	{edge: 10, corner: 7},
];

function piecesMask(P, edges, corners) {
	const required = [];
	P.orbits.forEach((orbit, oi) => {
		const slots = orbit.name === 'EDGES' ? edges : orbit.name === 'CORNERS' ? corners : [];
		for (const i of slots) {
			for (let f = 0; f < orbit.k; f++) required.push([oi, i, f, P.color[`${orbit.name}-${i}-${f}`]]);
		}
	});
	return required;
}

/** Cross intact → number of solved F2L slots, after the best rotation and trailing AUF; else -1. */
function f2lProgress(P, pattern) {
	P.crossMask ??= orderMask(P, [...piecesMask(P, [4, 5, 6, 7], []), ...centerMask(P)]);
	P.slotMasks ??= SLOTS.map((s) => piecesMask(P, [s.edge], [s.corner]));
	let best = -1;
	for (const r of P.rotations) {
		const rotated = pattern.applyTransformation(r);
		if (!meetsMask(P, rotated, P.crossMask)) continue;
		for (const t of P.aufs[0]) {
			const p = rotated.applyTransformation(t);
			best = Math.max(best, P.slotMasks.filter((m) => meetsMask(P, p, m)).length);
		}
	}
	return best;
}

function centerMask(P) {
	const required = [];
	P.orbits.forEach((orbit, oi) => {
		if (orbit.name !== 'CENTERS') return;
		for (let i = 0; i < orbit.n; i++) required.push([oi, i, 0, P.color[`${orbit.name}-${i}-0`]]);
	});
	return required;
}

function meetsMask(P, pattern, mask) {
	for (const [oi, slot, f, c] of mask) {
		if (stickerColor(P, pattern, P.orbits[oi], slot, f) !== c) return false;
	}
	return true;
}

/** Goal reached after some whole-puzzle rotation and some trailing AUF combination? */
function reachesGoal(P, pattern, mask) {
	for (const r of P.rotations) {
		const rotated = pattern.applyTransformation(r);
		if (tryAufs(P, rotated, mask, 0)) return true;
	}
	return false;
}

function tryAufs(P, pattern, mask, depth) {
	if (depth === P.aufs.length) return meetsMask(P, pattern, mask);
	for (const t of P.aufs[depth]) {
		if (tryAufs(P, pattern.applyTransformation(t), mask, depth + 1)) return true;
	}
	return false;
}

// ─── Notation adapters ───

/** Square-1: the site writes "1,0 / 3,0"; cubing.js wants "(1,0) / (3,0)". */
function toCubingSquare1(alg) {
	const tokens = alg.match(/-?\d+\s*,\s*-?\d+|\//g) ?? [];
	return tokens.map((t) => (t === '/' ? t : `(${t.replace(/\s/g, '')})`)).join(' ');
}

function toCubing(alg, puzzleType) {
	const clean = alg.replace(/[[\]{}]/g, ' ');
	return puzzleType === 'square1' ? toCubingSquare1(clean) : clean;
}

// ─── Trainer engine (verbatim port of client/util/trainer/algorithm_engine.ts) ───

function expandNotation(input) {
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

function cleanAlgorithmForCubing(alg) {
	let s = alg
		.replace(/\+/g, ' ')
		.replace(/’/g, "'")
		.replace(/["“”]/g, "'")
		.replace(/'2/g, "2'");
	s = s.replace(/([RLFBUD])w/g, (_, m) => m.toLowerCase());
	s = s.replace(/\(([RLFBUDMESrlfbudxyz][2']?)\)/g, '$1');
	s = expandNotation(s);
	return s;
}

function sameTransformation(a, b) {
	return JSON.stringify(a.transformationData) === JSON.stringify(b.transformationData);
}

// ─── Main ───

async function main() {
	const algs = JSON.parse(readFileSync(join(DIR, 'speedcubedb-algs.json'), 'utf-8'));
	const manifest = JSON.parse(readFileSync(join(DIR, 'speedcubedb-manifest.json'), 'utf-8'));
	const puzzleCache = {};

	const report = {
		generatedBy: 'scripts/validate-speedcubedb-algs.mjs',
		source: manifest.source,
		scrapedAt: manifest.scrapedAt,
		legend: {
			ok: 'setup + alg reaches the goal (trailing AUF / rotation allowed)',
			preAuf: 'reaches the goal only with an extra AUF before the alg; "auf" says which',
			preRotation: 'reaches the goal only when the puzzle is first held from another side',
			wrong: 'parses, but setup + alg does not reach the goal',
			unparsable: 'cubing.js cannot parse it for this puzzle',
			parseOnly: 'category not simulated (see goal); only parsed',
			engineMangled: 'cleanAlgorithmForCubing() turns it into a different (or unparsable) alg',
		},
		totals: {ok: 0, preAuf: 0, preRotation: 0, wrong: 0, unparsable: 0, parseOnly: 0, engineMangled: 0},
		categories: [],
	};

	for (const meta of manifest.categories) {
		const category = meta.category;
		const goal = GOALS[category] ?? null;
		const P = (puzzleCache[meta.puzzleType] ??= await loadPuzzle(meta.puzzleType));
		const progressGoal = goal === 'f2l-progress';
		const mask = goal && !progressGoal ? orderMask(P, await buildMask(P, goal)) : null;
		const result = {
			category,
			puzzleType: meta.puzzleType,
			goal: goal ?? 'parse only',
			counts: {ok: 0, preAuf: 0, preRotation: 0, wrong: 0, unparsable: 0, parseOnly: 0},
			mainAlg: {ok: 0, preAuf: 0, preRotation: 0, wrong: 0, unparsable: 0, parseOnly: 0},
			engineMangled: 0,
			engineMangledMain: 0,
			engineMangledExamples: [],
			issues: [],
		};

		for (const subset of algs[category]) {
			for (const entry of subset.algorithms) {
				let setupPattern = null;
				let slotsBefore = 0;
				if ((mask || progressGoal) && entry.setup) {
					try {
						setupPattern = P.solved.applyAlg(toCubing(entry.setup, meta.puzzleType));
						if (progressGoal) slotsBefore = f2lProgress(P, setupPattern);
					} catch (e) {
						result.issues.push({subset: subset.subset, name: entry.name, setup: entry.setup, status: 'setupUnparsable', error: e.message});
					}
				}

				const all = [entry.algorithm, ...(entry.alternatives ?? [])];
				all.forEach((alg, index) => {
					let transformation;
					try {
						transformation = P.kpuzzle.algToTransformation(toCubing(alg, meta.puzzleType));
					} catch (e) {
						record(result, index, 'unparsable', {subset: subset.subset, name: entry.name, alg, error: e.message});
						return;
					}
					let cleanedOk = false;
					try {
						cleanedOk = sameTransformation(
							P.kpuzzle.algToTransformation(toCubing(cleanAlgorithmForCubing(alg), meta.puzzleType)),
							transformation,
						);
					} catch {}
					if (!cleanedOk) {
						result.engineMangled++;
						if (index === 0) result.engineMangledMain++;
						if (result.engineMangledExamples.length < 10) {
							result.engineMangledExamples.push({alg, cleaned: cleanAlgorithmForCubing(alg)});
						}
					}

					if ((!mask && !progressGoal) || !setupPattern) {
						record(result, index, 'parseOnly');
						return;
					}
					const reaches = (p) => (progressGoal ? f2lProgress(P, p) > slotsBefore : reachesGoal(P, p, mask));
					if (reaches(setupPattern.applyTransformation(transformation))) {
						record(result, index, 'ok');
						return;
					}
					const pre = P.aufs[0] ?? [];
					for (let a = 1; a < pre.length; a++) {
						const p = setupPattern.applyTransformation(pre[a]).applyTransformation(transformation);
						if (reaches(p)) {
							record(result, index, 'preAuf', {subset: subset.subset, name: entry.name, alg, auf: aufName(P, a)});
							return;
						}
					}
					for (const r of P.rotations.slice(1)) {
						const p = setupPattern.applyTransformation(r).applyTransformation(transformation);
						if (reaches(p)) {
							record(result, index, 'preRotation', {subset: subset.subset, name: entry.name, alg});
							return;
						}
					}
					record(result, index, 'wrong', {subset: subset.subset, name: entry.name, alg});
				});
			}
		}

		for (const k of Object.keys(result.counts)) report.totals[k] += result.counts[k];
		report.totals.engineMangled += result.engineMangled;
		report.categories.push(result);
		const c = result.counts;
		console.log(
			`${category.padEnd(18)} ${String(result.goal).padEnd(20)} ok ${c.ok}  preAuf ${c.preAuf}  preRot ${c.preRotation}  wrong ${c.wrong}  unparsable ${c.unparsable}  parseOnly ${c.parseOnly}` +
				`   | main alg: wrong ${result.mainAlg.wrong}, preAuf ${result.mainAlg.preAuf}, preRot ${result.mainAlg.preRotation}, unparsable ${result.mainAlg.unparsable}` +
				`   | engine mangles ${result.engineMangled} (main ${result.engineMangledMain})`,
		);
	}

	writeFileSync(join(DIR, 'speedcubedb-validation.json'), JSON.stringify(report, null, '\t') + '\n');
	console.log('[done]', JSON.stringify(report.totals));
}

function aufName(P, power) {
	const move = AUF_MOVES[P.id][0];
	const order = P.aufs[0].length;
	if (power === 1) return move;
	if (power === order - 1) return `${move}'`;
	if (order === 4 && power === 2) return `${move}2`;
	return power < order / 2 ? `${move}${power}` : `${move}${order - power}'`;
}

function record(result, index, status, issue) {
	result.counts[status]++;
	if (index === 0) result.mainAlg[status]++;
	if (issue) result.issues.push({...issue, main: index === 0, status});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
