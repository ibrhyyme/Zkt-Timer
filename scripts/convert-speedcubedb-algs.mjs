/**
 * Converts the SpeedCubeDB raw dump into Zkt-Timer trainer format.
 *
 * Usage: node scripts/convert-speedcubedb-algs.mjs [--raw <file>] [--out-dir <dir>]
 *
 * Input:  data/speedcubedb/speedcubedb-raw.json (written by scripts/scrape-speedcubedb.mjs)
 * Output: data/speedcubedb/speedcubedb-algs.json      Record<category, AlgorithmSubset[]>,
 *                                                     same shape as public/trainer/default-algs.json
 *         data/speedcubedb/speedcubedb-manifest.json  per-category metadata for the merge
 *
 * Rules:
 * - Categories, subsets, cases and alternatives keep the site's order. Alternatives are the
 *   site's vote order, every one of them, with exact duplicates (ignoring brackets and
 *   spacing) dropped.
 * - "algorithm" is the site's curated "Standard Alg" when it has one, else its top-voted alg.
 * - Cases with slot tabs (F2L, Advanced F2L, Pyraminx L4E) become one entry per slot,
 *   named "<case> - <slot>", like the existing F2L category.
 * - "setup" is the site's own setup when it gives one for that case/slot, otherwise the
 *   inverse of "algorithm". The manifest records which, per category.
 * - A page listed under two sets (PLL under 1LLL, ZBLL U under 1LLL and ZBLL) is emitted once,
 *   under the set that owns it. The manifest's "alsoIncludes" lists what was left out.
 */

import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

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
	'Skewb/SarahsAdvanced': 'Sarah Advanced',
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
function invertMoves(alg) {
	const tokens = normalize(alg).split(' ').filter(Boolean);
	const out = [];
	for (const token of tokens) {
		let m;
		if ((m = token.match(/^([A-Za-z0-9]+)(\+\+|--)$/))) {
			out.push(m[1] + (m[2] === '++' ? '--' : '++'));
		} else if ((m = token.match(/^(\d*[A-Za-z]+w?)(\d*)('?)$/))) {
			const [, move, amount, prime] = m;
			if (amount === '2') out.push(move + '2');
			else if (amount === '' || amount === '1') out.push(move + (prime ? '' : "'"));
			else out.push(move + amount + (prime ? '' : "'"));
		} else {
			return null;
		}
	}
	return out.reverse().join(' ');
}

function invert(alg, puzzle) {
	return isSquare1(puzzle) ? invertSquare1(alg) : invertMoves(alg);
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

function orientationEntries(c, puzzle, counters) {
	const entries = [];
	const multi = c.orientations.length > 1;
	for (const o of c.orientations) {
		const name = multi ? `${c.name} - ${o.label ?? `Slot ${o.index + 1}`}` : c.name;
		if (o.algorithms.length === 0) {
			counters.emptyCases.push(name);
			continue;
		}

		const primary = o.index === 0 && c.standardAlg ? c.standardAlg : o.algorithms[0].alg;
		const seen = new Set([normalize(primary)]);
		const alternatives = [];
		for (const a of o.algorithms) {
			const key = normalize(a.alg);
			if (!key) continue;
			if (seen.has(key)) {
				counters.duplicatesDropped++;
				continue;
			}
			seen.add(key);
			alternatives.push(a.alg);
		}

		const entry = {name, algorithm: primary};
		if (alternatives.length) entry.alternatives = alternatives;

		if (o.index === 0 && c.setup) {
			entry.setup = c.setup;
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
		entries.push(entry);
	}
	return entries;
}

/** Subsets of one leaf page, in the site's filter order, then any subgroup it did not list. */
function pageSubsets(page, puzzle, fallbackName, counters) {
	const order = page.filters.map((f) => f.name);
	const bySubgroup = new Map();
	for (const c of page.cases) {
		const subset = c.subgroup ?? fallbackName;
		if (!bySubgroup.has(subset)) bySubgroup.set(subset, []);
		bySubgroup.get(subset).push(...orientationEntries(c, puzzle, counters));
		counters.cases++;
	}
	const names = [...order.filter((n) => bySubgroup.has(n)), ...[...bySubgroup.keys()].filter((n) => !order.includes(n))];
	return names.map((subset) => ({subset, algorithms: bySubgroup.get(subset)})).filter((s) => s.algorithms.length);
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
	const manifest = {
		source: raw.source,
		scrapedAt: raw.scrapedAt,
		generatedBy: 'scripts/convert-speedcubedb-algs.mjs',
		totals: {categories: 0, subsets: 0, cases: 0, entries: 0, algorithms: 0},
		categories: [],
	};

	for (const puzzle of raw.puzzles) {
		for (const s of puzzle.sets) {
			const setKey = `${puzzle.id}/${s.id}`;
			const category = CATEGORY_KEYS[setKey];
			if (!category) throw new Error(`No category key for ${setKey}; add it to CATEGORY_KEYS`);

			const page = raw.pages[s.page];
			const counters = {
				cases: 0,
				algorithms: 0,
				duplicatesDropped: 0,
				setupFromSite: 0,
				setupFromInverse: 0,
				setupMissing: [],
				emptyCases: [],
			};
			const subsets = [];
			const alsoIncludes = [];

			if (page.kind === 'leaf') {
				subsets.push(...pageSubsets(page, puzzle.id, 'Default', counters));
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
					subsets.push(...pageSubsets(child, puzzle.id, child.name, counters));
				}
			}

			algs[category] = subsets;
			const entries = subsets.reduce((n, x) => n + x.algorithms.length, 0);
			manifest.categories.push({
				category,
				displayName: s.name,
				puzzle: puzzle.id,
				puzzleType: PUZZLE_TYPES[puzzle.id],
				section: s.section,
				siteSet: setKey,
				url: page.url,
				replacesExisting: Boolean(existing[category]),
				subsets: subsets.length,
				cases: counters.cases,
				entries,
				algorithms: counters.algorithms,
				duplicatesDropped: counters.duplicatesDropped,
				setup: {fromSite: counters.setupFromSite, fromInverse: counters.setupFromInverse, missing: counters.setupMissing},
				emptyCases: counters.emptyCases,
				alsoIncludes,
				description: page.description,
				notationTokens: tokenInventory(subsets, puzzle.id),
			});
			manifest.totals.categories++;
			manifest.totals.subsets += subsets.length;
			manifest.totals.cases += counters.cases;
			manifest.totals.entries += entries;
			manifest.totals.algorithms += counters.algorithms;
		}
	}

	mkdirSync(ARGS.outDir, {recursive: true});
	writeFileSync(join(ARGS.outDir, 'speedcubedb-algs.json'), JSON.stringify(algs));
	writeFileSync(join(ARGS.outDir, 'speedcubedb-manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');

	console.log(`[done] ${manifest.totals.categories} categories, ${manifest.totals.subsets} subsets, ${manifest.totals.entries} entries, ${manifest.totals.algorithms} algorithms`);
	for (const c of manifest.categories) {
		const flags = [
			c.replacesExisting ? 'replaces existing' : 'new',
			c.setup.missing.length ? `${c.setup.missing.length} without setup` : null,
			c.emptyCases.length ? `${c.emptyCases.length} empty` : null,
			c.alsoIncludes.length ? `+${c.alsoIncludes.length} shared pages` : null,
		].filter(Boolean);
		console.log(`  ${c.category.padEnd(18)} ${String(c.entries).padStart(5)} entries ${String(c.algorithms).padStart(6)} algs  (${flags.join(', ')})`);
	}
}

main();
