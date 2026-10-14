/**
 * Maps every entry of the existing trainer categories to its SpeedCubeDB counterpart, for the
 * categories the SpeedCubeDB data replaces.
 *
 * Usage: node scripts/map-speedcubedb-migration.mjs [--dir <data dir>]
 *
 * Input:  public/trainer/default-algs.json (the categories as shipped today)
 *         data/speedcubedb/speedcubedb-algs.json + speedcubedb-manifest.json
 * Output: data/speedcubedb/speedcubedb-migration.json
 *
 * Why: the trainer keys user data by entry name and by alg text. Per-alg stats (best time, last
 * times, learned status, fail count) use algToId(expandNotation(alg)); custom alternatives use
 * "category::subset::name"; server alternatives use (category, case name); OLLCP accuracy uses
 * the variant's alg id. Replacing a category renames entries (PLL "Aa perm" → "Aa") and changes
 * main algs, which would orphan all of that. This file says which new entry each old one is.
 *
 * Matching is by the case itself, not by name: both entries' main algs are inverted to get the
 * case, and the cases are compared as the category's goal sees them (all stickers for PLL, the
 * orientation pattern for OLL, ...), up to AUF before and after and the way the puzzle is held.
 * F2L entries compare where the slot's own two pieces are. When no case matches, the same name
 * (or the name without " perm") is used, and the match is marked "by": "name". Square-1 is
 * matched by name only.
 */

import {readFileSync, writeFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {loadPuzzle, buildMask, stickerColor, toCubing, GOALS} from './validate-speedcubedb-algs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const args = process.argv.slice(2);
const DIR = args[0] === '--dir' ? args[1] : join(ROOT, 'data', 'speedcubedb');

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

/** The case an entry's main alg solves, as one string, the same for every equivalent angle. */
function caseKey(P, alg, goal, mask, slot) {
	let t;
	try {
		t = P.kpuzzle.algToTransformation(toCubing(alg, P.id));
	} catch {
		return null;
	}
	const inverse = t.invert();
	const turns = P.aufs(goal)[0] ?? [P.kpuzzle.identityTransformation()];
	let best = null;
	for (const end of turns) {
		const state = P.solved.applyTransformation(end).applyTransformation(inverse);
		// F2L cases are defined against the cross, not the centres ("d R U R'" moves the centres)
		const holds = slot === null ? [standardHold(P, state)].filter(Boolean) : crossHolds(P, state);
		for (const held of holds) {
			for (const top of turns) {
				const p = held.applyTransformation(top);
				const key = slot === null ? stickerKey(P, p, mask) : slotKey(P, p, slot);
				if (key !== null && (best === null || key < best)) best = key;
			}
		}
	}
	return best;
}

/** Every way to hold the puzzle with the cross home: a rotation, then a turn of the D layer. */
function crossHolds(P, state) {
	P.dTurns ??= (() => {
		const step = P.kpuzzle.algToTransformation('D');
		const list = [P.kpuzzle.identityTransformation()];
		for (let t = step; list.length < 4; t = t.applyTransformation(step)) list.push(t);
		return list;
	})();
	const holds = [];
	for (const r of P.rotations) {
		for (const d of P.dTurns) {
			const p = state.applyTransformation(r).applyTransformation(d);
			const e = p.patternData.EDGES;
			if ([4, 5, 6, 7].every((i) => e.pieces[i] === i && e.orientation[i] === 0)) holds.push(p);
		}
	}
	return holds;
}

/**
 * The mask's stickers, by colour. Where the goal only asks a last-layer piece to have its top
 * sticker up (OLL, COLL edges, ...), only "up or not" counts: the other colours there depend
 * on how the alg happens to permute the pieces, not on the case.
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
		// Which of the piece's stickers shows the top colour: the twist, not just "up or not"
		for (let g = 0; g < orbit.k; g++) key += stickerColor(P, p, orbit, slot, g) === P.uColor ? '^' : '.';
		key += ',';
	});
	return key;
}

/** F2L: where the slot's corner and edge are (and how they are twisted), with the cross home. */
function slotKey(P, p, slot) {
	const {edge, corner} = SLOT_PIECES[slot];
	const e = p.patternData.EDGES;
	const c = p.patternData.CORNERS;
	const ei = e.pieces.indexOf(edge);
	const ci = c.pieces.indexOf(corner);
	return `e${ei}.${e.orientation[ei]}|c${ci}.${c.orientation[ci]}`;
}

function slotOf(name) {
	const label = name.split(' - ').pop();
	const i = SLOT_LABELS.indexOf(label);
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
	const puzzleCache = {};

	const out = {
		generatedBy: 'scripts/map-speedcubedb-migration.mjs',
		note:
			'For every category the SpeedCubeDB data replaces: each old entry and the new entry for the same case. ' +
			'statsId is algToId(expandNotation(main alg)), the id the trainer stores per-alg stats under. ' +
			'customAltKey is the key custom alternatives are stored under.',
		categories: [],
	};

	for (const meta of manifest.categories.filter((c) => c.replacesExisting)) {
		const category = meta.category;
		const goal = GOALS[category] ?? null;
		const square1 = meta.puzzleType === 'square1';
		const P = square1 ? null : (puzzleCache[meta.puzzleType] ??= await loadPuzzle(meta.puzzleType));
		const keyGoal = goal === 'f2l-progress' ? null : goal;
		const mask = P && keyGoal ? await buildMask(P, keyGoal) : null;

		const flatten = (subsets) => subsets.flatMap((s) => s.algorithms.map((e) => ({subset: s.subset, ...e})));
		const olds = flatten(oldAlgs[category]);
		const news = flatten(newAlgs[category]);

		const keyOf = (e) => {
			if (!P) return null;
			const slot = goal === 'f2l-progress' ? slotOf(e.name) : null;
			if (goal === 'f2l-progress' && slot === null) return null;
			if (!mask && slot === null) return null;
			return caseKey(P, e.algorithm, keyGoal ?? 'full', mask, slot) + (slot === null ? '' : `#${slot}`);
		};
		const newByKey = new Map();
		for (const e of news) {
			const k = keyOf(e);
			if (k && !newByKey.has(k)) newByKey.set(k, e);
		}
		const newByName = new Map();
		for (const e of news) if (!newByName.has(looseName(e.name))) newByName.set(looseName(e.name), e);

		const describe = (e) => ({
			subset: e.subset,
			name: e.name,
			algorithm: e.algorithm,
			statsId: statsId(e.algorithm),
			customAltKey: `${category}::${e.subset}::${e.name}`,
		});

		// First by case. A new entry claimed by several old ones means the old algs do not tell
		// their cases apart (e.g. the old data's "d" read as cubing.js's Dw), so those fall back to
		// the name and carry "caseConflict".
		const byCase = olds.map((e) => {
			const k = keyOf(e);
			return k ? newByKey.get(k) : undefined;
		});
		// Claims include the name match an old entry without a case match would fall back to
		const claims = new Map();
		olds.forEach((e, i) => {
			const m = byCase[i] ?? newByName.get(looseName(e.name));
			if (m) claims.set(m, (claims.get(m) ?? 0) + 1);
		});

		const pairs = [];
		const unmatched = [];
		const usedNew = new Set();
		olds.forEach((e, i) => {
			let match = byCase[i];
			let by = 'case';
			let caseConflict = false;
			if (match && claims.get(match) > 1) {
				caseConflict = true;
				const named = newByName.get(looseName(e.name));
				if (named) [match, by] = [named, 'name'];
			}
			if (!match) {
				match = newByName.get(looseName(e.name));
				by = 'name';
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

		out.categories.push({
			category,
			oldEntries: olds.length,
			newEntries: news.length,
			matchedByCase: pairs.filter((p) => p.by === 'case').length,
			matchedByName: pairs.filter((p) => p.by === 'name').length,
			caseConflicts: pairs.filter((p) => p.caseConflict).length,
			unmatchedOld: unmatched.length,
			renamed: pairs.filter((p) => !p.sameName).length,
			statsIdChanged: pairs.filter((p) => !p.sameStatsId).length,
			newWithoutOld: news.filter((e) => !usedNew.has(e)).length,
			pairs,
			unmatched,
		});
		const c = out.categories.at(-1);
		console.log(
			`${category.padEnd(16)} old ${String(c.oldEntries).padStart(4)}  case ${String(c.matchedByCase).padStart(4)}  name ${String(c.matchedByName).padStart(3)}  conflicts ${String(c.caseConflicts).padStart(2)}  unmatched ${String(c.unmatchedOld).padStart(3)}  renamed ${String(c.renamed).padStart(4)}  statsId changed ${String(c.statsIdChanged).padStart(4)}  new-only ${c.newWithoutOld}`,
		);
	}

	writeFileSync(join(DIR, 'speedcubedb-migration.json'), JSON.stringify(out, null, '\t') + '\n');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
