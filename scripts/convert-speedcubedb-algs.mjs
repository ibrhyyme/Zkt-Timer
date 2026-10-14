/**
 * Converts the SpeedCubeDB raw dump into Zkt-Timer trainer format.
 *
 * Usage: node scripts/convert-speedcubedb-algs.mjs [--raw <file>] [--out-dir <dir>]
 *
 * Input:  data/speedcubedb/speedcubedb-raw.json (written by scripts/scrape-speedcubedb.mjs)
 * Output: data/speedcubedb/speedcubedb-algs.json      Record<category, AlgorithmSubset[]>,
 *                                                     same shape as public/trainer/default-algs.json
 *         data/speedcubedb/speedcubedb-manifest.json  per-category metadata for the merge
 *         data/speedcubedb/speedcubedb-sources.json   for every entry, the raw case it came from:
 *                                                     sources[category][subsetIndex][entryIndex] =
 *                                                     [page key, case index, orientation index]
 *
 * Rules:
 * - Categories follow the site. Subsets follow the order their first case appears on the page,
 *   and cases keep page order inside a subset. Where the page interleaves subgroups (OLL, PLL,
 *   F2L, Advanced F2L, CLS) grouping them changes the overall case order; nothing else does.
 * - "algorithm" is the site's curated "Standard Alg" when it has one, else its top-voted alg.
 *   "alternatives" are all other algs the site shows, in vote order, without repeats: algs that
 *   are the same after the rewrites below, ignoring brackets and spaces ("R3" and "R'" count as
 *   the same spelling). The main alg's own copy in the site list is found the same way, or by
 *   merging adjacent turns ("R' R'" = "R2") when the Standard Alg is written uncancelled.
 * - Cases with slot tabs (F2L, Advanced F2L, Pyraminx L4E) become one entry per slot,
 *   named "<case> - <slot>", like the existing F2L category.
 * - Names are unique within a category: the site reuses some case names for different cases
 *   (SQ1 Lin PLL+1, Megaminx PLL "N2-", ...); repeats get " (2)", " (3)" in page order. Names
 *   and subsets lose stray spaces. The manifest lists every rename.
 * - "setup" is the site's own setup when it gives one for that case/slot, otherwise the
 *   inverse of "algorithm". The manifest records which, per category.
 * - Notation is rewritten only where the meaning stays the same, so the trainer's
 *   expandNotation() / cleanAlgorithmForCubing() and cubing.js read it as the site means it:
 *   turn amounts other than 1 and 2 ("R3" → "R'", "U3'" → "U", "R4" dropped), group repeats
 *   ("(R U R')3" → three copies, primed and nested groups too), "R '" → "R'", 3x3 wide turns
 *   "Rw" → "r", 2x2 two-layer turns as the rotations they are ("d2" → "y2", "Rw" → "x"),
 *   Square-1 "/" with a space on each side. Skewb's H/S macros keep their amounts. Anything the
 *   rewrites cannot resolve is listed in the manifest ("unhandledNotation"), never guessed.
 *   The raw dump keeps the site's spelling.
 * - A page listed under two sets (PLL under 1LLL, ZBLL U under 1LLL and ZBLL) is emitted once,
 *   under the set that owns it. The manifest's "alsoIncludes" lists what was left out.
 */

import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function parseArgs(argv) {
	const args = {
		raw: join(ROOT, 'data', 'speedcubedb', 'speedcubedb-raw.json'),
		outDir: join(ROOT, 'data', 'speedcubedb'),
	};
	for (let i = 2; i < argv.length; i++) {
		if (argv[i] === '--raw') args.raw = argv[++i];
		else if (argv[i] === '--out-dir') args.outDir = argv[++i];
		else throw new Error(`Unknown argument: ${argv[i]}`);
	}
	return args;
}

const ARGS = parseArgs(process.argv);

// SpeedCubeDB set → Zkt-Timer category key. Keys that already exist in default-algs.json are
// reused for the same set so the merge is a replace, not a duplicate. Puzzle prefixes follow
// getPuzzleType() / getCubeType() (client/util/trainer/algorithm_engine.ts, AlgorithmSelector.tsx).
const CATEGORY_KEYS = {
	'3x3/F2L': 'F2L',
	'3x3/AdvancedF2L': 'Advanced F2L',
	'3x3/OLL': 'OLL',
	'3x3/PLL': 'PLL',
	'3x3/COLL': 'COLL',
	'3x3/WV': 'WVLS',
	'3x3/CMLL': 'CMLL',
	'3x3/SBLS': 'SBLS',
	'3x3/EO4A': 'EO4A',
	'3x3/AntiPLL': 'Anti PLL',
	'3x3/SV': 'SV',
	'3x3/ELL': 'ELL',
	'3x3/FRUF': 'FRUF',
	'3x3/CLS': 'CLS',
	'3x3/1LLL': '1LLL',
	'3x3/OLLCP': 'OLLCP',
	'3x3/VLS': 'VLS',
	'3x3/ZBLL': 'ZBLL',
	'2x2/OrtegaOLL': '2x2 Ortega OLL',
	'2x2/OrtegaPBL': '2x2 PBL',
	'2x2/CLL': '2x2 CLL',
	'2x2/EG1': '2x2 EG1',
	'2x2/EG2': '2x2 EG2',
	'4x4/OLLParity': '4x4 OLL Parity',
	'4x4/PLLParity': '4x4 PLL Parity',
	'5x5/L2E': '5x5 L2E',
	'5x5/L2C': '5x5 L2C',
	'SQ1/SQ1CS': 'SQ1 Cube Shape',
	'SQ1/SQ1CO': 'SQ1 CO',
	'SQ1/SQ1EO': 'SQ1 EO',
	'SQ1/SQ1CP': 'SQ1 CP',
	'SQ1/SQ1Parity': 'SQ1 Parity',
	'SQ1/SQ1EP': 'SQ1 EP',
	'SQ1/Lin': 'SQ1 Lin',
	'Megaminx/MegaminxEO': 'Megaminx EO',
	'Megaminx/MegaminxCO': 'Megaminx CO',
	'Megaminx/MegaminxEP': 'Megaminx EP',
	'Megaminx/MegaminxCP': 'Megaminx CP',
	'Megaminx/MegaminxOLL': 'Megaminx OLL',
	'Megaminx/MegaminxPLL': 'Megaminx PLL',
	'Pyraminx/L3E': 'Pyraminx LL',
	'Pyraminx/L4E': 'Pyraminx L4E',
	// Not "Sarah Advanced": the site writes Sarah's notation (H/S macros, lowercase turns), which
	// cubing.js cannot parse; the existing category uses notation it can. Keep both apart.
	'Skewb/SarahsAdvanced': 'Skewb Sarah Advanced',
};

// New categories that cover the same step as an existing one under another key and case split
const OVERLAPS_EXISTING = {
	'EO4A': 'L6E-EO',
	'Skewb Sarah Advanced': 'Sarah Advanced',
};

// cubing.js puzzle id per SpeedCubeDB puzzle
const PUZZLE_TYPES = {
	'3x3': '3x3x3',
	'2x2': '2x2x2',
	'4x4': '4x4x4',
	'5x5': '5x5x5',
	SQ1: 'square1',
	Megaminx: 'megaminx',
	Pyraminx: 'pyraminx',
	Skewb: 'skewb',
};

// ─── Notation ───

/** Comparable form of an alg: no grouping brackets, single spaces. */
function normalize(alg) {
	return alg.replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSquare1(puzzle) {
	return puzzle === 'SQ1';
}

// Turns per full rotation of a face move, per puzzle. Megaminx (R++/D--) is left as written.
const TURN_ORDER = {'3x3': 4, '2x2': 4, '4x4': 4, '5x5': 4, Pyraminx: 3, Skewb: 3};
// Whole-puzzle x/y/z rotations are quarter turns on every cube-shaped puzzle, Skewb included
const ROTATION_ORDER = {'3x3': 4, '2x2': 4, '4x4': 4, '5x5': 4, Skewb: 4};

function cleanName(name) {
	return name.replace(/\s+/g, ' ').trim();
}

/**
 * "(R U R')3" → "(R U R') (R U R') (R U R')", "[R U]2'" → "(U' R') (U' R')", "((R U)2 F)3"
 * from the inside out. The trainer would read the trailing digits as nothing.
 */
function expandGroupRepeats(alg, puzzle) {
	const OPEN = '([{';
	const CLOSE = ')]}';
	for (let pass = 0; pass < 10; pass++) {
		// Find the first closing bracket that carries a repeat count, then its opening bracket
		const m = /[)\]}]\s*(\d+)('?)(?=$|[\s)\]}])/.exec(alg);
		if (!m) return alg;
		const close = m.index;
		let depth = 0;
		let open = -1;
		for (let i = close; i >= 0; i--) {
			if (CLOSE.includes(alg[i])) depth++;
			else if (OPEN.includes(alg[i]) && --depth === 0) {
				open = i;
				break;
			}
		}
		const n = Number(m[1]);
		if (open === -1 || n < 1 || n > 12) return alg;
		const inner = alg.slice(open + 1, close).trim();
		const body = m[2] ? invertMoves(inner, puzzle) : inner;
		if (body === null) return alg;
		alg = alg.slice(0, open) + Array(n).fill(`(${body})`).join(' ') + alg.slice(close + m[0].length);
	}
	return alg;
}

/**
 * "R3" → "R'", "R3'" → "R", "R4" → "", "2R5" → "2R"; "R2" / "R2'" stay as written (the trainer
 * keeps the 2). x/y/z use the rotation order, everything else the puzzle's face order.
 */
function canonicalAmounts(alg, puzzle) {
	return alg.replace(/(^|[\s([{])(\d*[A-Za-z]+w?)('?)(\d+)('?)(?=$|[\s)\]}])/g, (m, pre, move, primeBefore, amount, primeAfter) => {
		const prime = Boolean(primeBefore) !== Boolean(primeAfter);
		if (amount === '2' && !primeBefore) return m;
		const order = turnOrder(move, puzzle);
		if (!order) return m;
		const n = Number(amount) % order;
		const turns = prime ? (order - n) % order : n;
		if (turns === 0) return pre;
		if (turns === 1) return pre + move;
		if (turns === order - 1) return pre + move + "'";
		return pre + move + '2' + (prime && order !== 4 ? "'" : '');
	});
}

/**
 * Turns per full rotation of one move token, or null when not known. On Skewb only the single
 * corner turns are thirds: Sarah's H and S macros are not, and are left as written.
 */
function turnOrder(move, puzzle) {
	if (/^[xyz]$/.test(move)) return ROTATION_ORDER[puzzle] ?? null;
	if (puzzle === 'Skewb' && !/^[RLUBFDrlubfd]$/.test(move)) return null;
	return TURN_ORDER[puzzle] ?? null;
}

/**
 * Turn amounts the rewrites could not resolve: a digit after a group, a prime before a digit,
 * an amount other than 2 on a token, or a wide "w" left on 3x3/2x2. Reported, not guessed.
 */
function unhandledNotation(alg, puzzle) {
	if (isSquare1(puzzle) || puzzle === 'Megaminx') return false;
	if (/[)\]}]\s*\d/.test(alg) || /'\d/.test(alg)) return true;
	for (const token of normalize(alg).split(' ')) {
		const m = token.match(/^\d*[A-Za-z]+w?(\d+)'?$/);
		if (m && m[1] !== '2') return true;
	}
	return (puzzle === '3x3' || puzzle === '2x2') && /[A-Za-z]w/.test(alg);
}

// On a 2x2 a two-layer turn moves the whole puzzle: "d" and "Dw" are "y'", "r" and "Rw" are "x".
// cubing.js (and so the trainer) has no wide moves on 2x2x2, so they are written as rotations.
const WIDE_2X2 = {u: ['y', false], d: ['y', true], r: ['x', false], l: ['x', true], f: ['z', false], b: ['z', true]};

function wideToRotations2x2(alg) {
	return alg.replace(/(^|[\s([{])(?:([udrlfb])|([UDRLFB])w)('?)(2?)('?)(?=$|[\s)\]}])/g, (m, pre, lower, upper, primeBefore, half, primeAfter) => {
		const [axis, inverted] = WIDE_2X2[(lower ?? upper).toLowerCase()];
		const prime = Boolean(primeBefore) !== Boolean(primeAfter);
		if (half) return pre + axis + '2' + (prime ? "'" : '');
		return pre + axis + (inverted !== prime ? "'" : '');
	});
}

/** On 3x3 "Rw" is "r". expandNotation() drops the w, which would turn "Rw" into "R". */
function wideToLowercase3x3(alg) {
	return alg.replace(/(^|[\s([{])([UDRLFB])w(?=[2']*(?:$|[\s)\]}]))/g, (m, pre, face) => pre + face.toLowerCase());
}

/** Square-1: one space on each side of every "/" (the pattern generator splits on spaces). */
function spaceSquare1(alg) {
	return alg.replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim();
}

const REWRITES = ['amounts', 'groupRepeats', 'primeSpace', 'wide3x3', 'wide2x2', 'square1Spacing'];

/** Meaning-preserving rewrites (see the header). Returns the new alg and which rules changed it. */
function rewriteAlg(alg, puzzle) {
	const applied = [];
	const step = (kind, fn) => {
		const out = fn(alg);
		if (out !== alg) {
			applied.push(kind);
			alg = out;
		}
	};
	if (isSquare1(puzzle)) {
		step('square1Spacing', spaceSquare1);
	} else {
		step('primeSpace', (a) => a.replace(/([A-Za-z0-9)\]])\s+'(?=\s|$)/g, "$1'"));
		step('groupRepeats', (a) => expandGroupRepeats(a, puzzle));
		step('amounts', (a) => canonicalAmounts(a, puzzle));
		if (puzzle === '3x3') step('wide3x3', wideToLowercase3x3);
		if (puzzle === '2x2') step('wide2x2', wideToRotations2x2);
	}
	if (applied.length) alg = alg.replace(/\s+/g, ' ').trim();
	return {alg, applied, unhandled: unhandledNotation(alg, puzzle)};
}

/** Square-1: "1,0 / 3,0 / -1,-1" or "/ (0,3) / (-3,-3) /" → reversed, every turn negated. */
function invertSquare1(alg) {
	const tokens = alg.match(/\(?\s*-?\d+\s*,\s*-?\d+\s*\)?|\//g) ?? [];
	return tokens
		.reverse()
		.map((t) => {
			if (t === '/') return '/';
			const [a, b] = t.replace(/[()\s]/g, '').split(',').map(Number);
			const pair = `${a === 0 ? 0 : -a},${b === 0 ? 0 : -b}`;
			return t.startsWith('(') ? `(${pair})` : pair;
		})
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Face/slice/rotation notation used by every other puzzle on the site, including Megaminx
 * (R++, D--) and the 4x4/5x5 prefixed wide moves (2R2, 3Rw'). Returns null when a token
 * cannot be inverted with confidence, so the caller can leave the setup out instead of
 * writing a wrong one.
 */
function invertMoves(alg, puzzle) {
	const tokens = normalize(alg).split(' ').filter(Boolean);
	// A half turn is its own inverse only on a puzzle with quarter turns: on Megaminx (fifths)
	// and on Pyraminx/Skewb (thirds) "R2" and "R2'" are different turns.
	const halfTurnSelfInverse = TURN_ORDER[puzzle] === 4;
	const out = [];
	for (const token of tokens) {
		let m;
		if ((m = token.match(/^([A-Za-z0-9]+)(\+\+|--)$/))) {
			out.push(m[1] + (m[2] === '++' ? '--' : '++'));
		} else if ((m = token.match(/^(\d*[A-Za-z]+w?)(\d*)('?)$/))) {
			const [, move, amount, prime] = m;
			if (amount === '2' && halfTurnSelfInverse) out.push(move + '2');
			else if (amount === '' || amount === '1') out.push(move + (prime ? '' : "'"));
			else out.push(move + amount + (prime ? '' : "'"));
		} else {
			return null;
		}
	}
	return out.reverse().join(' ');
}

/**
 * The alg with adjacent turns of the same move merged ("R' R'" → "R2", "U' U'" → "U2",
 * "R2'" → "R2"), as a comparable string. Only used to find the site's own copy of a Standard Alg.
 */
function cancelKey(alg, puzzle) {
	const out = [];
	for (const token of normalize(alg).split(' ')) {
		const m = token.match(/^(\d*[A-Za-z]+w?)(\d*)('?)$/);
		const order = m ? turnOrder(m[1], puzzle) : null;
		if (!m || !order) {
			out.push([token, null]);
			continue;
		}
		const turns = ((Number(m[2] || 1) * (m[3] ? -1 : 1)) % order + order) % order;
		const last = out[out.length - 1];
		if (last && last[0] === m[1] && last[1] !== null) last[1] = (last[1] + turns) % order;
		else out.push([m[1], turns]);
		while (out.length && out[out.length - 1][1] === 0) out.pop();
	}
	return out.map(([move, turns]) => (turns === null ? move : `${move}${turns}`)).join(' ');
}

function invert(alg, puzzle) {
	return isSquare1(puzzle) ? invertSquare1(alg) : invertMoves(alg, puzzle);
}

// ─── Page ownership ───

/**
 * A page can be listed by more than one set. It belongs to the top-level set with the same id
 * if there is one, otherwise to the smallest index that lists it (ZBLL over 1LLL).
 */
function buildOwnership(raw) {
	const owner = {};
	const topLevel = new Set();
	for (const puzzle of raw.puzzles) for (const s of puzzle.sets) topLevel.add(s.page);

	for (const puzzle of raw.puzzles) {
		for (const s of puzzle.sets) {
			const page = raw.pages[s.page];
			if (page.kind !== 'index') continue;
			for (const child of page.children) {
				if (topLevel.has(child)) continue;
				const current = owner[child];
				if (!current || raw.pages[current].children.length > page.children.length) owner[child] = s.page;
			}
		}
	}
	return {owner, topLevel};
}

// ─── Conversion ───

function newCounters() {
	return {
		cases: 0,
		algorithms: 0,
		duplicatesDropped: 0,
		duplicatesBySpelling: 0,
		emptySiteAlgs: 0,
		standardAlgNotOnSite: 0,
		unreachableAlternatives: 0,
		rewritten: Object.fromEntries(REWRITES.map((k) => [k, 0])),
		rewrittenAlgs: 0,
		rewrittenSetups: 0,
		unhandledNotation: [],
		setupFromSite: 0,
		setupFromInverse: 0,
		setupMissing: [],
		emptyCases: [],
		renamed: [],
	};
}

/** One canonical spelling per source string, counted once per distinct string and role. */
function makeCanonical(puzzle, counters) {
	const cache = new Map();
	return (alg, role = 'alg', where = null) => {
		const key = `${role}\u0000${alg}`;
		if (!cache.has(key)) {
			const {alg: out, applied, unhandled} = rewriteAlg(alg, puzzle);
			for (const kind of applied) counters.rewritten[kind]++;
			if (applied.length) role === 'setup' ? counters.rewrittenSetups++ : counters.rewrittenAlgs++;
			if (unhandled) {
				counters.unhandledNotation.push({...(where ?? {}), role, alg: out});
				console.warn(`[warn] unhandled notation (${role}): ${out}`);
			}
			cache.set(key, out);
		}
		return cache.get(key);
	};
}

function orientationEntries(c, caseIndex, pageKey, puzzle, counters, canonical) {
	const entries = [];
	const multi = c.orientations.length > 1;
	for (const o of c.orientations) {
		const caseName = cleanName(c.name);
		const name = multi ? `${caseName} - ${cleanName(o.label ?? `Slot ${o.index + 1}`)}` : caseName;
		counters.unreachableAlternatives += o.unreachableAtLeast ?? 0;

		const siteAlgs = o.algorithms.filter((a) => normalize(a.alg));
		counters.emptySiteAlgs += o.algorithms.length - siteAlgs.length;
		const primarySource = o.index === 0 && c.standardAlg ? c.standardAlg : siteAlgs[0]?.alg;
		if (!primarySource) {
			// The site lists a case with no moves at all (e.g. SQ1 "Square / Square", already solved)
			counters.emptyCases.push(name);
			continue;
		}
		const where = {name};
		const primary = canonical(primarySource, 'alg', where);
		const primaryKey = normalize(primary);
		const rewritten = siteAlgs.map((a) => canonical(a.alg, 'alg', where));
		// The site's own copy of the main alg is the main alg, not an alternative. A Standard Alg
		// may be the top-voted alg written without cancelling ("R' R'" for "R2").
		let copyIndex = rewritten.findIndex((alg) => normalize(alg) === primaryKey);
		if (copyIndex === -1) copyIndex = rewritten.findIndex((alg) => cancelKey(alg, puzzle) === cancelKey(primary, puzzle));
		if (copyIndex === -1) counters.standardAlgNotOnSite++;
		const kept = new Map([[primaryKey, normalize(copyIndex === -1 ? primarySource : siteAlgs[copyIndex].alg)]]);
		const alternatives = [];
		rewritten.forEach((alg, i) => {
			if (i === copyIndex) return;
			const key = normalize(alg);
			if (kept.has(key)) {
				counters.duplicatesDropped++;
				// Same moves only after the rewrites (R3 / R', Fw / f, ...), not in the site's spelling
				if (kept.get(key) !== normalize(siteAlgs[i].alg)) counters.duplicatesBySpelling++;
				return;
			}
			kept.set(key, normalize(siteAlgs[i].alg));
			alternatives.push(alg);
		});

		const entry = {name, algorithm: primary};
		if (alternatives.length) entry.alternatives = alternatives;

		if (o.index === 0 && c.setup) {
			entry.setup = canonical(c.setup, 'setup', where);
			counters.setupFromSite++;
		} else {
			const inverse = invert(primary, puzzle);
			if (inverse) {
				entry.setup = inverse;
				counters.setupFromInverse++;
			} else {
				counters.setupMissing.push(name);
			}
		}
		counters.algorithms += 1 + alternatives.length;
		entries.push({entry, source: [pageKey, caseIndex, o.index]});
	}
	return entries;
}

/** Subsets of one leaf page, in the order their first case appears on the page. */
function pageSubsets(page, puzzle, fallbackName, counters, canonical) {
	if (page.cases.some((c) => c.subgroup) && !page.filters.length) {
		console.warn(`[warn] ${page.key}: cases have subgroups but the page has no filter bar`);
	}
	const bySubgroup = new Map();
	page.cases.forEach((c, i) => {
		const subset = c.subgroup ? cleanName(c.subgroup) : fallbackName;
		if (!bySubgroup.has(subset)) bySubgroup.set(subset, []);
		bySubgroup.get(subset).push(...orientationEntries(c, i, page.key, puzzle, counters, canonical));
		counters.cases++;
	});
	return [...bySubgroup].map(([subset, items]) => ({subset, items})).filter((s) => s.items.length);
}

/** Make entry names unique within the category, in page order: "N2-", "N2- (2)", ... */
function uniqueNames(subsets, counters) {
	const taken = new Set(subsets.flatMap((s) => s.items.map((i) => i.entry.name)));
	const seen = new Set();
	for (const s of subsets) {
		for (const {entry} of s.items) {
			if (!seen.has(entry.name)) {
				seen.add(entry.name);
				continue;
			}
			let n = 2;
			while (taken.has(`${entry.name} (${n})`)) n++;
			const renamed = `${entry.name} (${n})`;
			taken.add(renamed);
			seen.add(renamed);
			counters.renamed.push({subset: s.subset, from: entry.name, to: renamed});
			entry.name = renamed;
		}
	}
}

function tokenInventory(subsets, puzzle) {
	const counts = new Map();
	for (const s of subsets) {
		for (const a of s.algorithms) {
			for (const alg of [a.algorithm, ...(a.alternatives ?? [])]) {
				const tokens = isSquare1(puzzle) ? alg.match(/-?\d+,-?\d+|\/|\S/g) ?? [] : normalize(alg).split(' ');
				for (const t of tokens) {
					const base = isSquare1(puzzle) ? (t === '/' || /,/.test(t) ? t.replace(/-?\d+/g, 'n') : t) : t.replace(/['2]+$/, '').replace(/^\d+/, 'n');
					if (base) counts.set(base, (counts.get(base) ?? 0) + 1);
				}
			}
		}
	}
	return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function main() {
	const raw = JSON.parse(readFileSync(ARGS.raw, 'utf-8'));
	const {owner, topLevel} = buildOwnership(raw);
	let existing = {};
	try {
		existing = JSON.parse(readFileSync(join(ROOT, 'public', 'trainer', 'default-algs.json'), 'utf-8'));
	} catch {}

	const algs = {};
	const sources = {};
	const manifest = {
		source: raw.source,
		scrapedAt: raw.scrapedAt,
		generatedBy: 'scripts/convert-speedcubedb-algs.mjs',
		totals: {categories: 0, subsets: 0, cases: 0, entries: 0, algorithms: 0, siteAlgorithms: raw.totals.algorithms, unreachableAlternatives: 0},
		categories: [],
	};

	for (const puzzle of raw.puzzles) {
		for (const s of puzzle.sets) {
			const setKey = `${puzzle.id}/${s.id}`;
			const category = CATEGORY_KEYS[setKey];
			if (!category) throw new Error(`No category key for ${setKey}; add it to CATEGORY_KEYS`);

			const page = raw.pages[s.page];
			const counters = newCounters();
			const canonical = makeCanonical(puzzle.id, counters);
			const subsets = [];
			const alsoIncludes = [];

			if (page.kind === 'leaf') {
				subsets.push(...pageSubsets(page, puzzle.id, 'Default', counters, canonical));
			} else {
				for (const childKey of page.children) {
					if (topLevel.has(childKey) || owner[childKey] !== s.page) {
						const ref = topLevel.has(childKey) ? childKey : owner[childKey];
						const refCategory = CATEGORY_KEYS[ref];
						const refName = raw.pages[childKey].name;
						alsoIncludes.push({page: childKey, name: refName, category: refCategory});
						continue;
					}
					const child = raw.pages[childKey];
					subsets.push(...pageSubsets(child, puzzle.id, cleanName(child.name), counters, canonical));
				}
			}

			uniqueNames(subsets, counters);
			algs[category] = subsets.map((x) => ({subset: x.subset, algorithms: x.items.map((i) => i.entry)}));
			sources[category] = subsets.map((x) => x.items.map((i) => i.source));
			const entries = subsets.reduce((n, x) => n + x.items.length, 0);
			manifest.categories.push({
				category,
				displayName: s.name,
				puzzle: puzzle.id,
				puzzleType: PUZZLE_TYPES[puzzle.id],
				section: s.section,
				siteSet: setKey,
				url: page.url,
				replacesExisting: Boolean(existing[category]),
				overlapsExisting: OVERLAPS_EXISTING[category] ?? null,
				subsets: subsets.length,
				cases: counters.cases,
				entries,
				algorithms: counters.algorithms,
				duplicatesDropped: counters.duplicatesDropped,
				duplicatesBySpelling: counters.duplicatesBySpelling,
				emptySiteAlgs: counters.emptySiteAlgs,
				standardAlgNotOnSite: counters.standardAlgNotOnSite,
				unreachableAlternatives: counters.unreachableAlternatives,
				rewrittenAlgs: counters.rewrittenAlgs,
				rewrittenSetups: counters.rewrittenSetups,
				rewrites: counters.rewritten,
				unhandledNotation: counters.unhandledNotation,
				setup: {fromSite: counters.setupFromSite, fromInverse: counters.setupFromInverse, missing: counters.setupMissing},
				emptyCases: counters.emptyCases,
				renamedDuplicates: counters.renamed,
				alsoIncludes,
				description: page.description,
				notationTokens: tokenInventory(algs[category], puzzle.id),
			});
			manifest.totals.categories++;
			manifest.totals.subsets += subsets.length;
			manifest.totals.cases += counters.cases;
			manifest.totals.entries += entries;
			manifest.totals.algorithms += counters.algorithms;
			manifest.totals.unreachableAlternatives += counters.unreachableAlternatives;
		}
	}

	mkdirSync(ARGS.outDir, {recursive: true});
	writeFileSync(join(ARGS.outDir, 'speedcubedb-algs.json'), JSON.stringify(algs, null, '\t') + '\n');
	writeFileSync(join(ARGS.outDir, 'speedcubedb-manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');
	// One line per subset keeps the index small and diffable
	const sourceLines = Object.entries(sources).map(
		([category, subs]) => `\t${JSON.stringify(category)}: [\n${subs.map((x) => `\t\t${JSON.stringify(x)}`).join(',\n')}\n\t]`,
	);
	writeFileSync(join(ARGS.outDir, 'speedcubedb-sources.json'), `{\n${sourceLines.join(',\n')}\n}\n`);

	console.log(`[done] ${manifest.totals.categories} categories, ${manifest.totals.subsets} subsets, ${manifest.totals.entries} entries, ${manifest.totals.algorithms} algorithms`);
	for (const c of manifest.categories) {
		const flags = [
			c.replacesExisting ? 'replaces existing' : 'new',
			c.setup.missing.length ? `${c.setup.missing.length} without setup` : null,
			c.emptyCases.length ? `${c.emptyCases.length} empty` : null,
			c.renamedDuplicates.length ? `${c.renamedDuplicates.length} renamed` : null,
			c.alsoIncludes.length ? `+${c.alsoIncludes.length} shared pages` : null,
		].filter(Boolean);
		console.log(`  ${c.category.padEnd(18)} ${String(c.entries).padStart(5)} entries ${String(c.algorithms).padStart(6)} algs  (${flags.join(', ')})`);
	}
}

export {rewriteAlg, canonicalAmounts, expandGroupRepeats, wideToRotations2x2, wideToLowercase3x3, cancelKey, invert, uniqueNames, cleanName};

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
