/**
 * Maps every entry of the existing trainer categories to its SpeedCubeDB counterpart, for the
 * categories the SpeedCubeDB data replaces.
 *
 * Usage: node scripts/map-speedcubedb-migration.mjs [--dir <data dir>]
 *
 * Input:  public/trainer/default-algs.json (the categories as shipped today)
 *         data/speedcubedb/speedcubedb-algs.json, -manifest.json, -validation.json
 * Output: data/speedcubedb/speedcubedb-migration.json
 *
 * Why: the trainer keys user data by entry name and by alg text. Per-alg stats (best time, last
 * times, learned status, fail count) use algToId(expandNotation(alg)); custom alternatives use
 * "category::subset::name"; server alternatives use (category, case name); OLLCP accuracy uses
 * the variant's alg id. Replacing a category renames entries (PLL "Aa perm" → "Aa") and changes
 * main algs, which would orphan all of that. This file says which new entry each old one is.
 *
 * Matching, in order:
 * 1. text: the old main alg is, letter for letter (brackets and spaces aside), the main alg or
 *    an alternative of exactly one new entry.
 * 2. case: both main algs are inverted and the cases compared as the category's goal sees them
 *    (all stickers for PLL, which stickers face up and how corners twist for OLL, where the
 *    slot's two pieces are for F2L, the whole puzzle for Square-1), up to the AUF before and
 *    after (U and D turns on 2x2 and Square-1) and the way the puzzle is held. A new entry whose
 *    main alg the validator found broken is keyed by its first working alternative.
 * 3. name: the same name, or the name without " perm".
 * A case match onto a new entry that another old entry also claims (by case or by text) falls
 * back to the name, marked "caseConflict". "SQ1 EP" is also matched against the new "SQ1 Parity"
 * category, which holds the parity EP cases.
 */

import {readFileSync, writeFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {loadPuzzle, buildMask, stickerColor, toCubing, combosFor, GOALS} from './validate-speedcubedb-algs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const args = process.argv.slice(2);
const DIR = args[0] === '--dir' ? args[1] : join(ROOT, 'data', 'speedcubedb');

// New categories searched as well, per replaced category
const EXTRA_TARGETS = {'SQ1 EP': ['SQ1 Parity']};

// ─── Trainer ids (verbatim port of client/util/trainer/algorithm_engine.ts) ───

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

function algToId(alg) {
	let id = alg
		?.trim()
		.replace(/\s+/g, '-')
		.replace(/[']/g, 'p')
		.replace(/[(]/g, 'o')
		.replace(/[)]/g, 'c');
	if (id == null || id.length === 0) id = 'default-alg-id';
	return id;
}

// The id the trainer stores stats under for an entry's main alg (useAlgorithmData expands first)
const statsId = (alg) => algToId(expandNotation(alg));

// ─── Case keys ───

const SLOT_LABELS = ['Front Right', 'Front Left', 'Back Left', 'Back Right'];
// cubing.js 3x3x3: F2L slot edges FR FL BL BR = 8 9 11 10, corners DRF DFL DLB DBR = 4 5 6 7
const SLOT_PIECES = [
	{edge: 8, corner: 4},
	{edge: 9, corner: 5},
	{edge: 11, corner: 6},
	{edge: 10, corner: 7},
];

function textKey(alg, puzzleType) {
	const cubing = puzzleType === 'square1' ? toCubing(alg, 'square1') : alg;
	return cubing.replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The rotation that holds the puzzle the standard way: fixed centres solved where the puzzle has
 * them (3x3, 5x5, Megaminx), else a reference piece home (the DLB corner on 2x2/4x4, the four
 * axial corners on Pyraminx).
 */
function standardHold(P, pattern) {
	P.holdOrbit ??= (() => {
		const centers = P.orbits.find((o) => o.singleSticker && (o.n === 6 || o.n === 12) && P.color[`${o.name}-0-0`]);
		if (centers) return {orbit: centers.name, pieces: [...Array(centers.n).keys()], twist: false};
		if (P.id === 'pyraminx') return {orbit: 'CORNERS', pieces: [0, 1, 2, 3], twist: false};
		return {orbit: 'CORNERS', pieces: [6], twist: true};
	})();
	const {orbit, pieces, twist} = P.holdOrbit;
	for (const r of P.rotations) {
		const p = pattern.applyTransformation(r);
		const d = p.patternData[orbit];
		if (pieces.every((i) => d.pieces[i] === i && (!twist || d.orientation[i] === 0))) return p;
	}
	return null;
}

/** F2L: hold with the centres home, then turn D until the cross is home. */
function crossHolds(P, state) {
	P.dTurns ??= (() => {
		const step = P.kpuzzle.algToTransformation('D');
		const list = [P.kpuzzle.identityTransformation()];
		for (let t = step; list.length < 4; t = t.applyTransformation(step)) list.push(t);
		return list;
	})();
	const held = standardHold(P, state);
	if (!held) return [];
	return P.dTurns
		.map((d) => held.applyTransformation(d))
		.filter((p) => [4, 5, 6, 7].every((i) => p.patternData.EDGES.pieces[i] === i && p.patternData.EDGES.orientation[i] === 0));
}

/** Square-1 turns of both layers: (a,b) for a, b in 0..11. */
function square1Turns(P) {
	P.sq1Turns ??= (() => {
		const list = [];
		for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) list.push(P.kpuzzle.algToTransformation(`(${a},${b})`));
		return list;
	})();
	return P.sq1Turns;
}

/** The case an alg solves, as one string, the same for every equivalent angle. */
function caseKey(P, alg, goal, mask, slot) {
	let t;
	try {
		t = P.kpuzzle.algToTransformation(toCubing(alg, P.id));
	} catch {
		return null;
	}
	const inverse = t.invert();
	let best = null;
	const consider = (key) => {
		if (key !== null && (best === null || key < best)) best = key;
	};

	if (P.id === 'square1') {
		const turns = square1Turns(P);
		for (const end of turns) {
			const state = P.solved.applyTransformation(end).applyTransformation(inverse);
			for (const top of turns) consider(JSON.stringify(state.applyTransformation(top).patternData));
		}
		return best;
	}

	const turns = slot === null ? combosFor(P, 'full') : P.aufs(goal)[0];
	for (const end of turns) {
		const state = P.solved.applyTransformation(end).applyTransformation(inverse);
		for (const top of turns) {
			const turned = state.applyTransformation(top);
			if (slot === null) {
				const held = standardHold(P, turned);
				if (held) consider(stickerKey(P, held, mask));
			} else {
				for (const held of crossHolds(P, turned)) consider(slotKey(held, slot));
			}
		}
	}
	return best;
}

/**
 * The mask's stickers, by colour. Where the goal only asks a last-layer piece to have its top
 * sticker up (OLL, COLL edges, ...), only which of its stickers shows the top colour counts:
 * the other colours there depend on how the alg permutes the pieces, not on the case.
 */
function stickerKey(P, p, mask) {
	P.keyModes ??= new WeakMap();
	if (!P.keyModes.has(mask)) {
		const perPiece = new Map();
		for (const [oi, slot] of mask) perPiece.set(`${oi}-${slot}`, (perPiece.get(`${oi}-${slot}`) ?? 0) + 1);
		P.keyModes.set(
			mask,
			mask.map(([oi, slot, , allowed]) => {
				const orbit = P.orbits[oi];
				return !orbit.singleSticker && perPiece.get(`${oi}-${slot}`) === 1 && allowed.length === 1 && allowed[0] === P.uColor;
			}),
		);
	}
	const topOnly = P.keyModes.get(mask);
	let key = '';
	mask.forEach(([oi, slot, f], i) => {
		const orbit = P.orbits[oi];
		if (!topOnly[i]) {
			key += (stickerColor(P, p, orbit, slot, f) ?? '?') + ',';
			return;
		}
		for (let g = 0; g < orbit.k; g++) key += stickerColor(P, p, orbit, slot, g) === P.uColor ? '^' : '.';
		key += ',';
	});
	return key;
}

/** F2L: where the slot's corner and edge are (and how they are twisted), with the cross home. */
function slotKey(p, slot) {
	const {edge, corner} = SLOT_PIECES[slot];
	const e = p.patternData.EDGES;
	const c = p.patternData.CORNERS;
	const ei = e.pieces.indexOf(edge);
	const ci = c.pieces.indexOf(corner);
	return `e${ei}.${e.orientation[ei]}|c${ci}.${c.orientation[ci]}`;
}

function slotOf(name) {
	const i = SLOT_LABELS.indexOf(name.split(' - ').pop());
	return i === -1 ? null : i;
}

function looseName(name) {
	return name.toLowerCase().replace(/\s+perm$/, '').replace(/\s+/g, ' ').trim();
}

// ─── Main ───

async function main() {
	const read = (file) => JSON.parse(readFileSync(file, 'utf-8'));
	const oldAlgs = read(join(ROOT, 'public', 'trainer', 'default-algs.json'));
	const newAlgs = read(join(DIR, 'speedcubedb-algs.json'));
	const manifest = read(join(DIR, 'speedcubedb-manifest.json'));
	const validation = read(join(DIR, 'speedcubedb-validation.json'));
	const puzzleCache = {};

	// New entries whose main alg is broken are keyed by their first working alternative
	const workingAlg = new Map();
	for (const c of validation.categories) {
		for (const i of c.issues) {
			if (i.status === 'mainFails' && i.firstOkAlternative) workingAlg.set(`${c.category}::${i.subset}::${i.name}`, i.firstOkAlternative);
		}
	}

	const out = {
		generatedBy: 'scripts/map-speedcubedb-migration.mjs',
		note:
			'For every category the SpeedCubeDB data replaces: each old entry and the new entry for the same case. ' +
			'"by" says how they were matched (text, case, name). statsId is algToId(expandNotation(main alg)), ' +
			'the id the trainer stores per-alg stats under. customAltKey is the key custom alternatives are stored under.',
		categories: [],
	};

	for (const meta of manifest.categories.filter((c) => c.replacesExisting)) {
		const category = meta.category;
		const goal = GOALS[category] ?? null;
		const P = (puzzleCache[meta.puzzleType] ??= await loadPuzzle(meta.puzzleType));
		const progress = goal === 'f2l-progress';
		const mask = goal && !progress ? await buildMask(P, goal) : null;

		const flatten = (cat, subsets) => subsets.flatMap((s) => s.algorithms.map((e) => ({category: cat, subset: s.subset, ...e})));
		const olds = flatten(category, oldAlgs[category]);
		const news = [category, ...(EXTRA_TARGETS[category] ?? [])].flatMap((cat) => flatten(cat, newAlgs[cat]));

		const keyOf = (e, alg = e.algorithm) => {
			if (P.id === 'square1') return caseKey(P, alg, null, null, null);
			const slot = progress ? slotOf(e.name) : null;
			if (progress ? slot === null : !mask) return null;
			const k = caseKey(P, alg, goal, mask, slot);
			return k === null ? null : k + (slot === null ? '' : `#${slot}`);
		};

		// 1. text: an alg string that belongs to exactly one new entry
		const byText = new Map();
		for (const e of news) {
			for (const alg of new Set([e.algorithm, ...(e.alternatives ?? [])].map((a) => textKey(a, meta.puzzleType)))) {
				byText.set(alg, byText.has(alg) && byText.get(alg) !== e ? null : e);
			}
		}
		// 2. case
		const byKey = new Map();
		for (const e of news) {
			const k = keyOf(e, workingAlg.get(`${e.category}::${e.subset}::${e.name}`) ?? e.algorithm);
			if (k !== null && !byKey.has(k)) byKey.set(k, e);
		}
		// 3. name
		const byName = new Map();
		for (const e of news.filter((x) => x.category === category)) if (!byName.has(looseName(e.name))) byName.set(looseName(e.name), e);

		const first = olds.map((e) => {
			const t = byText.get(textKey(e.algorithm, meta.puzzleType));
			if (t) return {match: t, by: 'text'};
			const k = keyOf(e);
			const c = k === null ? undefined : byKey.get(k);
			if (c) return {match: c, by: 'case'};
			const n = byName.get(looseName(e.name));
			return n ? {match: n, by: 'name'} : {match: null, by: null};
		});
		const claims = new Map();
		for (const f of first) if (f.match && f.by === 'case') claims.set(f.match, (claims.get(f.match) ?? 0) + 1);
		const textClaims = new Set(first.filter((f) => f.by === 'text').map((f) => f.match));

		const describe = (e) => ({
			...(e.category !== category ? {category: e.category} : {}),
			subset: e.subset,
			name: e.name,
			algorithm: e.algorithm,
			statsId: statsId(e.algorithm),
			customAltKey: `${e.category}::${e.subset}::${e.name}`,
		});

		const pairs = [];
		const unmatched = [];
		const usedNew = new Set();
		olds.forEach((e, i) => {
			let {match, by} = first[i];
			let caseConflict = false;
			// A case match onto an entry another old entry also claims (by case or by text) is not
			// trustworthy; the name decides, if there is one
			if (by === 'case' && (claims.get(match) > 1 || textClaims.has(match))) {
				caseConflict = true;
				const named = byName.get(looseName(e.name));
				if (named) [match, by] = [named, 'name'];
			}
			if (!match) {
				unmatched.push(describe(e));
				return;
			}
			usedNew.add(match);
			const pair = {by, old: describe(e), new: describe(match), sameName: match.name === e.name, sameStatsId: statsId(match.algorithm) === statsId(e.algorithm)};
			if (caseConflict) pair.caseConflict = true;
			pairs.push(pair);
		});

		const count = (fn) => pairs.filter(fn).length;
		const targets = pairs.map((p) => p.new.customAltKey);
		out.categories.push({
			category,
			...(EXTRA_TARGETS[category] ? {alsoSearched: EXTRA_TARGETS[category]} : {}),
			oldEntries: olds.length,
			newEntries: news.filter((e) => e.category === category).length,
			matchedByText: count((p) => p.by === 'text'),
			matchedByCase: count((p) => p.by === 'case'),
			matchedByName: count((p) => p.by === 'name'),
			caseConflicts: count((p) => p.caseConflict),
			unmatchedOld: unmatched.length,
			newEntriesClaimedTwice: targets.length - new Set(targets).size,
			renamed: count((p) => !p.sameName),
			statsIdChanged: count((p) => !p.sameStatsId),
			newWithoutOld: news.filter((e) => e.category === category && !usedNew.has(e)).length,
			pairs,
			unmatched,
		});
		const c = out.categories.at(-1);
		console.log(
			`${category.padEnd(16)} old ${String(c.oldEntries).padStart(4)}  text ${String(c.matchedByText).padStart(4)}  case ${String(c.matchedByCase).padStart(4)}  name ${String(c.matchedByName).padStart(3)}  conflicts ${String(c.caseConflicts).padStart(2)}  unmatched ${String(c.unmatchedOld).padStart(3)}  twice ${c.newEntriesClaimedTwice}  renamed ${String(c.renamed).padStart(4)}  statsId changed ${String(c.statsIdChanged).padStart(4)}  new-only ${c.newWithoutOld}`,
		);
	}

	writeFileSync(join(DIR, 'speedcubedb-migration.json'), JSON.stringify(out, null, '\t') + '\n');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
