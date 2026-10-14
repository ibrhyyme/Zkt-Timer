/**
 * Checks every converted SpeedCubeDB algorithm against cubing.js.
 *
 * Usage: node scripts/validate-speedcubedb-algs.mjs [--dir <data dir>]
 *
 * Input:  data/speedcubedb/speedcubedb-algs.json, -manifest.json, -sources.json, -raw.json
 * Output: data/speedcubedb/speedcubedb-validation.json
 *
 * Per entry (one case or slot):
 * - start:  the setup state is a legal starting point for the category, checked against no
 *           particular colour: PLL starts from an oriented last layer of any one face, OLL from
 *           a solved F2L under any one face, F2L from an intact cross (START_GOALS).
 * - image:  the setup state looks exactly like the site's own drawing of the case (the sticker
 *           data in the raw dump), up to a turn of the top layer. 3x3, 2x2, 4x4 and 5x5 cases
 *           drawn from above (jcube).
 * Either check passing proves the setup is the case the entry names. When neither applies and
 * the setup is just the inverse of the main alg, the main alg is reported "unverified": it
 * trivially solves its own inverse, which proves nothing.
 *
 * Per algorithm (the main one and every alternative):
 * - parse:  the alg parses and every move exists on the puzzle (cubing.js KPuzzle).
 * - solve:  setup + alg reaches the category's goal (GOALS). Allowed: a trailing AUF (a turn of
 *           whichever layer is on top after the alg) and any final rotation of the whole puzzle.
 *           Not solving that way, the alg is tried after an AUF, a rotation, or both in front:
 *           "preAuf" / "preRotation" / "preRotationAuf" (a correct alg that starts from another
 *           angle than the setup), else "wrong".
 * - engine: the trainer runs every alg through expandNotation() and then cleanAlgorithmForCubing()
 *           (client/util/trainer/algorithm_engine.ts) before it plays or matches it. An alg that
 *           comes out doing something else, or no longer parsing, is "engineMangled".
 *
 * When the start or image check fails, the inverses of the entry's algs are tried as setups;
 * the one that passes and agrees with the most algs is reported as "suggestedSetup".
 *
 * Categories without a goal (FRUF, Square-1, 5x5 L2E, Skewb Sarah notation) are parsed only.
 */

import {readFileSync, writeFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {puzzles} from 'cubing/puzzles';
import {Alg} from 'cubing/alg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const DIR = args[0] === '--dir' ? args[1] : join(ROOT, 'data', 'speedcubedb');

// ─── Goals ───

// End goal per category: what setup + alg must reach. Mask names are built in buildMask();
// "cubing:<name>" is a cubing.js stickering mask (Roux steps, where the M slice is free).
// "f2l-progress": the cross and every slot solved before stay solved, and one more is solved.
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

// Where a case of the category starts from, with the last layer on any one face. Categories
// left out start from states a mask cannot describe (a free slot, a half-built block).
const START_GOALS = {
	'OLL': 'f2l',
	'PLL': 'oll',
	'COLL': 'eoll',
	'ZBLL': 'eoll',
	'1LLL': 'f2l',
	'OLLCP': 'f2l',
	'ELL': 'corners',
	// Anti PLL: a PLL with all four last-layer edges flipped
	'Anti PLL': 'ocll',
	'CMLL': 'cubing:SecondBlock',
	'EO4A': 'cubing-dim:L6EO',
	// CLS: F2L solved except one slot's corner; SBLS: the first block solved
	'CLS': 'f2l-but-a-corner',
	'SBLS': 'cubing-dim:SecondBlock',
	'2x2 CLL': 'f2l',
	'4x4 OLL Parity': 'f2l',
	'4x4 PLL Parity': 'oll',
	'Megaminx EO': 'f2l',
	'Megaminx CO': 'eoll',
	'Megaminx EP': 'oll',
	'Megaminx CP': 'epll',
	'Megaminx OLL': 'f2l',
	'Megaminx PLL': 'oll',
	'F2L': 'cross',
	'Advanced F2L': 'cross',
};

// Moves allowed after the alg, per puzzle and per goal. In front of the alg ("preAuf") only the
// first one: on 2x2 a D turn before the alg would change how the two layers sit against each
// other, which is what tells one CLL/EG case from another.
const AUF_MOVES = {
	'3x3x3': ['U'],
	'2x2x2': ['U', 'D'],
	'4x4x4': ['U'],
	'5x5x5': ['U'],
	megaminx: ['U'],
	pyraminx: ['U'],
};
const GOAL_AUF_MOVES = {
	// Roux 4a leaves the M slice and the U layer wherever they land
	'cubing:L6EO': ['U', 'M'],
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

// Site jcube letters: the site shows cases with z2 (yellow on top), so the face letters are
// cubing.js's colours relabelled: white top → y, yellow → w, red right → o, orange left → r.
const FACE_OF_COLOR = {
	white: 'U', '#ffffff': 'U',
	yellow: 'D', '#f4f400': 'D',
	limegreen: 'F', '#44ee00': 'F',
	'#26f': 'B', '#2266ff': 'B',
	red: 'R', '#ff0000': 'R',
	orange: 'L', '#ff8000': 'L',
};
const SITE_LETTER = {U: 'y', D: 'w', F: 'g', B: 'b', R: 'o', L: 'r'};
const NET_SIZE = {'3x3x3': 3, '2x2x2': 2, '4x4x4': 4, '5x5x5': 5};

async function loadPuzzle(id) {
	const loader = puzzles[id];
	const kpuzzle = await loader.kpuzzle();
	const svg = await loader.svg();

	// Sticker colours and 2D net positions: element id "<ORBIT>-l<slot>-o<facelet>"
	const color = {};
	const stickers = [];
	for (const m of svg.matchAll(/<(?:use|polygon|rect)\b([^>]*)>/g)) {
		const attrs = m[1];
		const idm = attrs.match(/(?<![-\w])id="([A-Z0-9_]+)-l(\d+)-o(\d+)"/);
		const fill = attrs.match(/fill:\s*([^;"]+)/)?.[1].trim();
		if (!idm || !fill) continue;
		color[`${idm[1]}-${idm[2]}-${idm[3]}`] = fill;
		let x;
		let y;
		const tr = attrs.match(/translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\)/);
		if (tr) [x, y] = [+tr[1], +tr[2]];
		const pts = attrs.match(/points="([^"]+)"/);
		if (pts) {
			const n = pts[1].trim().split(/\s+/).map(Number);
			x = 0;
			y = 0;
			for (let i = 0; i < n.length; i += 2) [x, y] = [x + n[i], y + n[i + 1]];
			[x, y] = [x / (n.length / 2), y / (n.length / 2)];
		}
		stickers.push({orbit: idm[1], slot: +idm[2], f: +idm[3], fill, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10});
	}

	const orbits = kpuzzle.definition.orbits.map((o) => ({name: o.orbitName, n: o.numPieces, k: o.numOrientations}));
	// Single-sticker pieces (centers) show their one colour whatever their orientation
	for (const orbit of orbits) orbit.singleSticker = color[`${orbit.name}-0-1`] === undefined;
	const solved = kpuzzle.defaultPattern();

	// Rotation group, generated from the puzzle's whole-puzzle rotations
	const rotations = [];
	const gens = (ROTATION_GENERATORS[id] ?? []).map((m) => kpuzzle.algToTransformation(m));
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

	const powers = (move) => {
		const step = kpuzzle.algToTransformation(move);
		const list = [kpuzzle.identityTransformation()];
		for (let t = step; !isIdentity(t) && list.length <= 12; t = t.applyTransformation(step)) list.push(t);
		return list;
	};
	const aufCache = new Map();
	const aufs = (goal) => {
		const moves = GOAL_AUF_MOVES[goal] ?? AUF_MOVES[id] ?? [];
		const key = moves.join();
		if (!aufCache.has(key)) aufCache.set(key, moves.map(powers));
		return aufCache.get(key);
	};

	const faceColors = [...new Set(Object.values(color))];
	const uColor = color['CORNERS-0-0'];
	const dColor = id === '2x2x2' ? color['CORNERS-4-0'] : null;

	// Opposite colours, from the cube centres (U L F R B D) where there are any
	const opposite = {};
	if (id === '3x3x3') {
		const c = (i) => color[`CENTERS-${i}-0`];
		for (const [a, b] of [[0, 5], [1, 3], [2, 4]]) [opposite[c(a)], opposite[c(b)]] = [c(b), c(a)];
	}

	// 2D net cells per face (row-major, as the site's jcube strings are), for cube puzzles
	let net = null;
	const size = NET_SIZE[id];
	if (size) {
		net = {};
		for (const face of ['U', 'D', 'F', 'B', 'R', 'L']) {
			const cells = stickers.filter((s) => FACE_OF_COLOR[s.fill] === face && !(orbits.find((o) => o.name === s.orbit).singleSticker && s.f > 0));
			const xs = [...new Set(cells.map((s) => s.x))].sort((a, b) => a - b);
			const ys = [...new Set(cells.map((s) => s.y))].sort((a, b) => a - b);
			if (xs.length !== size || ys.length !== size) throw new Error(`${id}: net face ${face} is ${xs.length}x${ys.length}`);
			net[face] = ys.flatMap((y) => xs.map((x) => cells.find((s) => s.x === x && s.y === y)));
		}
	}

	return {id, kpuzzle, color, orbits, solved, rotations, aufs, faceColors, uColor, dColor, opposite, net};
}

function isIdentity(t) {
	for (const o of Object.values(t.transformationData)) {
		for (let i = 0; i < o.permutation.length; i++) {
			if (o.permutation[i] !== i || o.orientationDelta[i] !== 0) return false;
		}
	}
	return true;
}

/** Colour shown at slot `slot`, facelet `f` of an orbit. kpuzzle keeps, per slot, the piece in it
 *  and its twist o; the slot's facelet f shows the piece's facelet (f - o) mod k. */
function stickerColor(P, pattern, orbit, slot, f) {
	const data = pattern.patternData[orbit.name];
	const piece = data.pieces[slot];
	if (orbit.singleSticker) return P.color[`${orbit.name}-${piece}-0`];
	const o = data.orientation[slot];
	return P.color[`${orbit.name}-${piece}-${(((f - o) % orbit.k) + orbit.k) % orbit.k}`];
}

// ─── Masks ───

/**
 * Required stickers: [orbitIndex, slot, facelet, allowedColours[]]. `ll` is the colour of the
 * last layer: U on every end goal, any face colour on a start goal.
 */
async function buildMask(P, goal, ll = P.uColor) {
	const required = [];
	const solvedColor = (orbit, slot, f) => P.color[`${orbit.name}-${slot}-${f}`];

	if (goal.startsWith('cubing:') || goal.startsWith('cubing-dim:')) {
		const dimOnly = goal.startsWith('cubing-dim:');
		const mask = await puzzles[P.id].stickeringMask(goal.slice(goal.indexOf(':') + 1));
		P.orbits.forEach((orbit, oi) => {
			const pieces = mask.orbits[orbit.name]?.pieces ?? [];
			for (let slot = 0; slot < orbit.n; slot++) {
				for (let f = 0; f < (orbit.singleSticker ? 1 : orbit.k); f++) {
					const entry = pieces[slot]?.facelets?.[f];
					const kind = typeof entry === 'string' ? entry : entry?.mask;
					const c = solvedColor(orbit, slot, f);
					if (!c) continue;
					if (kind === 'dim' || (!dimOnly && kind === 'regular')) required.push([oi, slot, f, [c]]);
					// Edge orientation: the facelet shows its own colour or the opposite one
					else if (!dimOnly && kind === 'experimentalOriented2') required.push([oi, slot, f, [c, P.opposite[c]].filter(Boolean)]);
					else if (!dimOnly && kind === 'oriented') required.push([oi, slot, f, [c]]);
				}
			}
		});
		return required;
	}

	P.orbits.forEach((orbit, oi) => {
		for (let slot = 0; slot < orbit.n; slot++) {
			const colors = [];
			for (let f = 0; f < (orbit.singleSticker ? 1 : orbit.k); f++) colors.push(solvedColor(orbit, slot, f));
			if (colors.every((c) => c === undefined)) continue;
			const lastLayer = colors.includes(ll);
			const isCorner = orbit.name.startsWith('CORNERS');
			const isEdge = orbit.name.startsWith('EDGES');
			const isCenter = orbit.name.startsWith('CENTERS');

			const need = (f) => colors[f] !== undefined && required.push([oi, slot, f, [colors[f]]]);
			const needAll = () => colors.forEach((_, f) => need(f));
			const needTop = () => colors.forEach((c, f) => c === ll && need(f));

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
					if (!lastLayer || isCenter) needAll();
					break;
				case 'f2l-but-corner-4':
				case 'f2l-but-corner-5':
				case 'f2l-but-corner-6':
				case 'f2l-but-corner-7':
					// cubing.js corners 4-7 are DRF, DFL, DLB, DBR: the corners of the four slots
					if ((!lastLayer || isCenter) && !(isCorner && slot === Number(goal.slice(-1)))) needAll();
					break;
				case 'cross':
					if (isCenter || (isEdge && colors.includes(oppositeOf(P, ll)))) needAll();
					break;
				case 'oll':
					lastLayer ? needTop() : needAll();
					break;
				case 'coll':
					if (!lastLayer || isCorner || isCenter) needAll();
					else needTop();
					break;
				case 'corners':
					if (!lastLayer || isCorner || isCenter) needAll();
					break;
				case 'ocll':
					if (!lastLayer || isCenter) needAll();
					else if (isCorner) needTop();
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
	return orderMask(P, required);
}

function oppositeOf(P, c) {
	return P.opposite[c] ?? null;
}

/** Centre stickers first: a wrong whole-puzzle rotation then fails on the first comparisons. */
function orderMask(P, mask) {
	const weight = ([oi]) => (P.orbits[oi].singleSticker ? 0 : 1);
	return mask.sort((a, b) => weight(a) - weight(b));
}

function meetsMask(P, pattern, mask) {
	for (const [oi, slot, f, allowed] of mask) {
		const c = stickerColor(P, pattern, P.orbits[oi], slot, f);
		if (allowed.length === 1 ? c !== allowed[0] : !allowed.includes(c)) return false;
	}
	return true;
}

/** Every combination of AUF powers, e.g. [U^a] on 3x3, [U^a D^b] on 2x2. */
function aufCombos(lists) {
	let combos = [null];
	for (const list of lists) {
		const next = [];
		for (const c of combos) for (const t of list) next.push(c ? c.applyTransformation(t) : t);
		combos = next;
	}
	return combos.filter(Boolean);
}

const comboCache = new WeakMap();
function combosFor(P, goal) {
	const lists = P.aufs(goal);
	if (!comboCache.has(lists)) comboCache.set(lists, aufCombos(lists));
	return comboCache.get(lists);
}

/**
 * Goal reached after a trailing AUF (turning the layer on top after the alg) and then any
 * whole-puzzle rotation?
 */
function reachesGoal(P, pattern, mask, goal, useAufs = true) {
	const combos = useAufs ? combosFor(P, goal) : [];
	const afterAuf = combos.length ? combos.map((t) => pattern.applyTransformation(t)) : [pattern];
	for (const p of afterAuf) {
		for (const r of P.rotations) {
			if (meetsMask(P, p.applyTransformation(r), mask)) return true;
		}
	}
	return false;
}

// ─── F2L progress ───

// cubing.js 3x3x3 piece order: edges UF UR UB UL DF DR DB DL FR FL BR BL,
// corners UFR URB UBL ULF DRF DFL DLB DBR, centers U L F R B D
const SLOTS = [
	{edge: 8, corner: 4},
	{edge: 9, corner: 5},
	{edge: 11, corner: 6},
	{edge: 10, corner: 7},
];

function piecesMask(P, edges, corners, centers) {
	const required = [];
	P.orbits.forEach((orbit, oi) => {
		const slots = orbit.name === 'EDGES' ? edges : orbit.name === 'CORNERS' ? corners : orbit.name === 'CENTERS' ? centers : [];
		for (const i of slots) {
			for (let f = 0; f < (orbit.singleSticker ? 1 : orbit.k); f++) required.push([oi, i, f, [P.color[`${orbit.name}-${i}-${f}`]]]);
		}
	});
	return required;
}

/** In the frame where the centres are solved: is the cross intact, and which slots are solved? */
function f2lState(P, pattern) {
	P.centerMask ??= piecesMask(P, [], [], [0, 1, 2, 3, 4, 5]);
	P.crossMask ??= piecesMask(P, [4, 5, 6, 7], [], []);
	P.slotMasks ??= SLOTS.map((s) => piecesMask(P, [s.edge], [s.corner], []));
	for (const r of P.rotations) {
		const p = pattern.applyTransformation(r);
		if (!meetsMask(P, p, P.centerMask)) continue;
		return {cross: meetsMask(P, p, P.crossMask), slots: P.slotMasks.map((m) => meetsMask(P, p, m))};
	}
	return {cross: false, slots: [false, false, false, false]};
}

function f2lProgressed(before, after) {
	if (!after.cross) return false;
	let gained = false;
	for (let i = 0; i < 4; i++) {
		if (before.slots[i] && !after.slots[i]) return false;
		if (!before.slots[i] && after.slots[i]) gained = true;
	}
	return gained;
}

// ─── Notation adapters ───

/** Square-1: the site writes "1,0 / 3,0"; cubing.js wants "(1,0) / (3,0)". */
function toCubingSquare1(alg) {
	const tokens = alg.match(/-?\d+\s*,\s*-?\d+|\//g) ?? [];
	return tokens.map((t) => (t === '/' ? t : `(${t.replace(/\s/g, '')})`)).join(' ');
}

/**
 * Megaminx face names: the site's DR (also written dR) is the lower face touching F and R,
 * which cubing.js calls FR; "bL" and "Br" are typing variants of BL and BR.
 */
function toCubingMegaminx(alg) {
	return alg.replace(/(^|[\s([{])(?:DR|dR)(?=[2'+-]*(?:$|[\s)\]}]))/g, '$1FR').replace(/\bbL\b/g, 'BL').replace(/\bBr\b/g, 'BR');
}

function toCubing(alg, puzzleType) {
	const clean = alg.replace(/[[\]{}]/g, ' ');
	if (puzzleType === 'square1') return toCubingSquare1(clean);
	if (puzzleType === 'megaminx') return toCubingMegaminx(clean);
	return clean;
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

/** What the trainer actually plays: useAlgorithmData expands, TrainingArea then cleans. */
function trainerText(alg) {
	return cleanAlgorithmForCubing(expandNotation(alg));
}

function sameTransformation(a, b) {
	return JSON.stringify(a.transformationData) === JSON.stringify(b.transformationData);
}

// ─── Site drawing ───

/**
 * Does the setup state look like the site's jcube drawing? Allowed: the AUF the main alg leaves
 * out at its end (a setup that is the inverse of the main alg lacks it; on 2x2 that includes
 * the D layer), how the drawing holds the puzzle, and a turn of the top layer.
 */
function imageCheck(P, setupTransformation, image) {
	if (!P.net || !image || image.type !== 'jcube') return null;
	const site = {U: image.us, B: image.ub, F: image.uf, L: image.ul, R: image.ur};
	if (Object.values(site).some((s) => !s)) return null;
	const topTurns = P.aufs('full')[0] ?? [P.kpuzzle.identityTransformation()];
	const views = [];
	for (const end of combosFor(P, 'full')) {
		const state = P.solved.applyTransformation(end).applyTransformation(setupTransformation);
		for (const r of P.rotations) for (const t of topTurns) views.push(state.applyTransformation(r).applyTransformation(t));
	}
	for (let a = 0; a < views.length; a++) {
		const p = views[a];
		let ok = true;
		for (const face of ['U', 'B', 'F', 'L', 'R']) {
			const cells = P.net[face];
			const want = site[face];
			for (let i = 0; i < cells.length && ok; i++) {
				if (want[i] === 'l') continue;
				const c = stickerColor(P, p, P.orbits.find((o) => o.name === cells[i].orbit), cells[i].slot, cells[i].f);
				if (SITE_LETTER[FACE_OF_COLOR[c]] !== want[i]) ok = false;
			}
			if (!ok) break;
		}
		if (ok) return {ok: true, auf: a};
	}
	return {ok: false};
}

// ─── Main ───

function invertText(alg, puzzleType) {
	try {
		return new Alg(toCubing(alg, puzzleType)).invert().expand().toString();
	} catch {
		return null;
	}
}

async function main() {
	const read = (name) => JSON.parse(readFileSync(join(DIR, name), 'utf-8'));
	const algs = read('speedcubedb-algs.json');
	const manifest = read('speedcubedb-manifest.json');
	const sources = read('speedcubedb-sources.json');
	const raw = read('speedcubedb-raw.json');
	const puzzleCache = {};

	const STATUSES = ['ok', 'unverified', 'preAuf', 'preRotation', 'preRotationAuf', 'wrong', 'unparsable', 'parseOnly'];
	const ENTRY_FLAGS = ['startChecked', 'startOk', 'imageChecked', 'imageOk', 'badStart', 'imageMismatch', 'trivialSetup', 'setupUnparsable', 'setupFallback', 'mainFails', 'mainDisagrees', 'suggestedSetup'];
	const zero = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));

	const report = {
		generatedBy: 'scripts/validate-speedcubedb-algs.mjs',
		source: manifest.source,
		scrapedAt: manifest.scrapedAt,
		legend: {
			ok: 'setup + alg reaches the goal (trailing AUF / rotation allowed), and the setup is checked',
			unverified: 'main alg whose setup is its own inverse, with no start or image check available',
			preAuf: 'reaches the goal only with an AUF before the alg; "auf" says which',
			preRotation: 'reaches the goal only when the puzzle is first held from another side',
			preRotationAuf: 'reaches the goal only with both a rotation and an AUF before the alg',
			wrong: 'parses, but setup + alg does not reach the goal from any angle',
			unparsable: 'cubing.js cannot parse it for this puzzle',
			parseOnly: 'category not simulated (no goal); only parsed',
			engineMangled: 'expandNotation() + cleanAlgorithmForCubing() turn it into a different (or unparsable) alg',
			badStart: 'entry: the setup state is not a legal start for the category',
			imageMismatch: "entry: the setup state does not look like the site's drawing of the case",
			trivialSetup: 'entry: the setup state already meets the goal, so its algs are not tested',
			mainFails: 'entry: the main alg does not solve the setup state as written; "firstOkAlternative" does',
			mainDisagrees: 'entry: the main alg passes but every alternative fails, so the main alg and setup are suspect',
			betterSetup: 'entry: no check failed, but another setup (inverse of one of its algs) is solved by more of its algs',
			suggestedSetup: 'entry: a setup (inverse of one of its algs) that passes the failed checks',
		},
		totals: {...zero(STATUSES), engineMangled: 0, ...zero(ENTRY_FLAGS)},
		categories: [],
	};

	for (const meta of manifest.categories) {
		const category = meta.category;
		const goal = GOALS[category] ?? null;
		const startGoal = START_GOALS[category] ?? null;
		const P = (puzzleCache[meta.puzzleType] ??= await loadPuzzle(meta.puzzleType));
		const progressGoal = goal === 'f2l-progress';
		const mask = goal && !progressGoal ? await buildMask(P, goal) : null;
		const startMasks = [];
		if (startGoal && startGoal !== 'cross') {
			const lls = startGoal.startsWith('cubing') ? [P.uColor] : P.faceColors;
			const goals = startGoal === 'f2l-but-a-corner' ? [4, 5, 6, 7].map((i) => `f2l-but-corner-${i}`) : [startGoal];
			for (const g of goals) for (const ll of lls) startMasks.push(await buildMask(P, g, ll));
		}
		const result = {
			category,
			puzzleType: meta.puzzleType,
			goal: goal ?? 'parse only',
			startGoal,
			counts: zero(STATUSES),
			mainAlg: zero(STATUSES),
			entries: zero(ENTRY_FLAGS),
			engineMangled: 0,
			engineMangledMain: 0,
			issues: [],
		};

		const reaches = (p, before) => (progressGoal ? f2lProgressed(before, f2lState(P, p)) : reachesGoal(P, p, mask, goal));
		const startOk = (p) => {
			if (startGoal === 'cross') return f2lState(P, p).cross;
			// A start state is legal up to a turn of the last layer
			return startMasks.some((m) => reachesGoal(P, p, m, startGoal));
		};

		algs[category].forEach((subset, si) => {
			subset.algorithms.forEach((entry, ei) => {
				const [pageKey, caseIndex] = sources[category][si][ei];
				const rawCase = raw.pages[pageKey].cases[caseIndex];
				const where = {subset: subset.subset, name: entry.name};
				const all = [entry.algorithm, ...(entry.alternatives ?? [])];

				// Parse every alg once
				const parsed = all.map((alg) => {
					try {
						return P.kpuzzle.algToTransformation(toCubing(alg, meta.puzzleType));
					} catch (e) {
						return e;
					}
				});

				// Engine check on every alg, simulated or not
				all.forEach((alg, index) => {
					const t = parsed[index];
					let same;
					if (t instanceof Error) {
						same = normalizeText(trainerText(alg)) === normalizeText(alg);
					} else {
						try {
							same = sameTransformation(P.kpuzzle.algToTransformation(toCubing(trainerText(alg), meta.puzzleType)), t);
						} catch {
							same = false;
						}
					}
					if (!same) {
						result.engineMangled++;
						if (index === 0) result.engineMangledMain++;
						result.issues.push({...where, status: 'engineMangled', main: index === 0, alg, trainerReads: trainerText(alg)});
					}
				});

				// Setup state
				let setupText = entry.setup ?? null;
				let setupPattern = null;
				let setupTransformation = null;
				if ((mask || progressGoal) && setupText) {
					try {
						setupTransformation = P.kpuzzle.algToTransformation(toCubing(setupText, meta.puzzleType));
						setupPattern = P.solved.applyTransformation(setupTransformation);
					} catch (e) {
						result.entries.setupUnparsable++;
						result.issues.push({...where, status: 'setupUnparsable', setup: setupText, error: e.message});
						const firstOk = parsed.findIndex((t) => !(t instanceof Error));
						if (firstOk >= 0) {
							setupText = invertText(all[firstOk], meta.puzzleType);
							setupTransformation = parsed[firstOk].invert();
							setupPattern = P.solved.applyTransformation(setupTransformation);
							result.entries.setupFallback++;
						}
					}
				}

				const simulate = (pattern) => {
					const before = progressGoal ? f2lState(P, pattern) : null;
					return all.map((alg, index) => {
						const t = parsed[index];
						if (t instanceof Error) return {status: 'unparsable', error: t.message};
						if (reaches(pattern.applyTransformation(t), before)) return {status: 'ok'};
						const pre = P.aufs(goal)[0] ?? [];
						for (let a = 1; a < pre.length; a++) {
							if (reaches(pattern.applyTransformation(pre[a]).applyTransformation(t), before)) return {status: 'preAuf', auf: a};
						}
						for (const r of P.rotations.slice(1)) {
							if (reaches(pattern.applyTransformation(r).applyTransformation(t), before)) return {status: 'preRotation'};
						}
						for (const r of P.rotations.slice(1)) {
							for (let a = 1; a < pre.length; a++) {
								if (reaches(pattern.applyTransformation(r).applyTransformation(pre[a]).applyTransformation(t), before)) {
									return {status: 'preRotationAuf'};
								}
							}
						}
						return {status: 'wrong'};
					});
				};

				if ((!mask && !progressGoal) || !setupPattern) {
					all.forEach((alg, index) => {
						const status = parsed[index] instanceof Error ? 'unparsable' : 'parseOnly';
						record(result, index, status, status === 'unparsable' ? {...where, alg, error: parsed[index].message} : null);
					});
					return;
				}

				// Entry checks: is the setup the case it claims to be?
				const checks = (pattern, transformation) => {
					const start = startGoal ? startOk(pattern) : null;
					const image = imageCheck(P, transformation, rawCase.images.length === 1 ? rawCase.images[0] : null);
					return {start, image: image ? image.ok : null};
				};
				const entryChecks = checks(setupPattern, setupTransformation);
				if (entryChecks.start !== null) {
					result.entries.startChecked++;
					if (entryChecks.start) result.entries.startOk++;
					else result.entries.badStart++;
				}
				if (entryChecks.image !== null) {
					result.entries.imageChecked++;
					if (entryChecks.image) result.entries.imageOk++;
					else result.entries.imageMismatch++;
				}
				const setupVerified = entryChecks.start === true || entryChecks.image === true;
				const setupFailed = entryChecks.start === false || entryChecks.image === false;

				// A setup that already meets the goal tests nothing
				const trivial = progressGoal ? false : reachesGoal(P, setupPattern, mask, goal);
				if (trivial) {
					result.entries.trivialSetup++;
					result.issues.push({...where, status: 'trivialSetup', setup: setupText});
				}

				const outcomes = simulate(setupPattern);
				const mainIsOwnInverse =
					!(parsed[0] instanceof Error) && reachesGoal(P, setupPattern.applyTransformation(parsed[0]), P.fullMask ??= orderMaskSync(P), 'none', false);

				outcomes.forEach((o, index) => {
					let status = o.status;
					if (index === 0 && status === 'ok' && mainIsOwnInverse && !setupVerified) status = 'unverified';
					const issue = status === 'ok' ? null : {...where, alg: all[index], ...(o.auf ? {auf: preAufName(P, goal, o.auf)} : {}), ...(o.error ? {error: o.error} : {})};
					record(result, index, status, issue);
				});

				const passing = (o) => ['ok', 'preAuf', 'preRotation', 'preRotationAuf'].includes(o.status);
				if (outcomes[0].status !== 'ok' && outcomes[0].status !== 'unparsable') {
					const firstOk = outcomes.findIndex((o) => o.status === 'ok');
					result.entries.mainFails++;
					result.issues.push({...where, status: 'mainFails', main: entry.algorithm, mainStatus: outcomes[0].status, firstOkAlternative: firstOk > 0 ? all[firstOk] : null});
				}
				if (outcomes.length > 2 && passing(outcomes[0]) && outcomes.slice(1).every((o) => o.status === 'wrong')) {
					result.entries.mainDisagrees++;
					result.issues.push({...where, status: 'mainDisagrees', main: entry.algorithm});
				}

				// Look for a better setup when the entry's own fails a check (or the algs disagree)
				if (setupFailed || trivial || outcomes.slice(1).some((o) => o.status === 'wrong')) {
					const currentOk = outcomes.filter((o) => o.status === 'ok').length;
					const current = currentOk * 1000 + outcomes.filter(passing).length;
					let best = null;
					all.forEach((alg, index) => {
						const t = parsed[index];
						if (t instanceof Error) return;
						const candidate = P.solved.applyTransformation(t.invert());
						const c = checks(candidate, t.invert());
						if (c.start === false || c.image === false) return;
						if (!progressGoal && reachesGoal(P, candidate, mask, goal)) return;
						const sim = simulate(candidate);
						const score = sim.filter((o) => o.status === 'ok').length * 1000 + sim.filter(passing).length;
						if (!best || score > best.score) best = {index, score, ok: sim.filter((o) => o.status === 'ok').length, passing: sim.filter(passing).length, checks: c};
					});
					const worthIt = best && (setupFailed || best.score > current);
					if (worthIt) {
						result.entries.suggestedSetup++;
						result.issues.push({
							...where,
							status: setupFailed ? (entryChecks.start === false ? 'badStart' : 'imageMismatch') : 'betterSetup',
							setup: entry.setup,
							suggestedSetup: invertText(all[best.index], meta.puzzleType),
							okWithSetup: currentOk,
							okWithSuggested: best.ok,
							of: all.length,
							suggestionChecked: {start: best.checks.start, image: best.checks.image},
						});
						return;
					}
				}
				if (setupFailed) {
					result.issues.push({...where, status: entryChecks.start === false ? 'badStart' : 'imageMismatch', setup: entry.setup, suggestedSetup: null});
				}
			});
		});

		for (const k of STATUSES) report.totals[k] += result.counts[k];
		for (const k of ENTRY_FLAGS) report.totals[k] += result.entries[k];
		report.totals.engineMangled += result.engineMangled;
		report.categories.push(result);
		const c = result.counts;
		const e = result.entries;
		console.log(
			`${category.padEnd(20)} ${String(result.goal).padEnd(18)} ok ${c.ok} unverified ${c.unverified} pre ${c.preAuf + c.preRotation + c.preRotationAuf} wrong ${c.wrong} unparsable ${c.unparsable} parseOnly ${c.parseOnly}` +
				` | start ${e.startOk}/${e.startChecked} image ${e.imageOk}/${e.imageChecked} trivial ${e.trivialSetup} suggested ${e.suggestedSetup}` +
				` | engine ${result.engineMangled} (main ${result.engineMangledMain})`,
		);
	}

	writeFileSync(join(DIR, 'speedcubedb-validation.json'), JSON.stringify(report, null, '\t') + '\n');
	console.log('[done]', JSON.stringify(report.totals));
}

function normalizeText(alg) {
	return alg.replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Whole-puzzle "solved" mask (every sticker), for the setup-is-the-main's-inverse test. */
function orderMaskSync(P) {
	const required = [];
	P.orbits.forEach((orbit, oi) => {
		for (let slot = 0; slot < orbit.n; slot++) {
			for (let f = 0; f < (orbit.singleSticker ? 1 : orbit.k); f++) {
				const c = P.color[`${orbit.name}-${slot}-${f}`];
				if (c) required.push([oi, slot, f, [c]]);
			}
		}
	});
	return orderMask(P, required);
}

/** "U", "U2", "U'" (or "U2'" style names on puzzles with more than four turns) */
function preAufName(P, goal, power) {
	const move = (GOAL_AUF_MOVES[goal] ?? AUF_MOVES[P.id] ?? [])[0];
	const order = P.aufs(goal)[0].length;
	if (power === 1) return move;
	if (power === order - 1) return `${move}'`;
	if (order === 4 && power === 2) return `${move}2`;
	return power < order / 2 ? `${move}${power}` : `${move}${order - power}'`;
}

function record(result, index, status, issue) {
	result.counts[status]++;
	if (index === 0) result.mainAlg[status]++;
	// "unverified" is a property of the setup, not of the alg: counted, not listed one by one
	if (issue && status !== 'parseOnly' && status !== 'unverified') result.issues.push({...issue, status, main: index === 0});
}

export {loadPuzzle, buildMask, meetsMask, reachesGoal, stickerColor, imageCheck, toCubing, f2lState, GOALS};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
