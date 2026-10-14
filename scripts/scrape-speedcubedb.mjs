/**
 * Scrapes every algorithm set on speedcubedb.com into a lossless raw JSON dump.
 *
 * Usage: node scripts/scrape-speedcubedb.mjs [--out <file>] [--cache-dir <dir>]
 *        [--concurrency <n>] [--delay <ms>] [--only <puzzle>[/<set>]]
 *
 * 1. Discovers puzzles from the home page and their sets from each puzzle page (site order)
 * 2. Follows "large set" index pages (ZBLL, OLLCP, 1LLL, VLS, Lin, Megaminx OLL/PLL) into their pages
 * 3. Parses every case on every leaf page (image, setup, standard alg, slot/orientation tabs)
 * 4. Calls category.algs.php (the "More Algorithms" button) for every case + orientation,
 *    so each case carries every alternative the site has, in the site's (vote) order
 * 5. Writes data/speedcubedb/speedcubedb-raw.json
 *
 * Responses are cached gzipped under --cache-dir, so a re-run only hits the network for
 * what is missing. Delete the cache directory to force a fresh scrape.
 */

import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {createHash} from 'crypto';
import {gzipSync, gunzipSync} from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = 'https://speedcubedb.com';
const SCRAPER_VERSION = 1;

// ─── CLI ───

function parseArgs(argv) {
	const args = {
		out: join(ROOT, 'data', 'speedcubedb', 'speedcubedb-raw.json'),
		cacheDir: join(ROOT, '.cache', 'speedcubedb'),
		concurrency: 3,
		delay: 250,
		only: null,
	};
	for (let i = 2; i < argv.length; i++) {
		const key = argv[i];
		const val = argv[i + 1];
		if (key === '--out') args.out = val, i++;
		else if (key === '--cache-dir') args.cacheDir = val, i++;
		else if (key === '--concurrency') args.concurrency = Number(val), i++;
		else if (key === '--delay') args.delay = Number(val), i++;
		else if (key === '--only') args.only = val, i++;
		else throw new Error(`Unknown argument: ${key}`);
	}
	return args;
}

const ARGS = parseArgs(process.argv);

// ─── HTTP: cache + rate limit + retry ───

let lastRequestAt = 0;
let active = 0;
const waiting = [];
const stats = {network: 0, cached: 0, retries: 0};

async function acquire() {
	if (active >= ARGS.concurrency) await new Promise((resolve) => waiting.push(resolve));
	active++;
	const wait = lastRequestAt + ARGS.delay - Date.now();
	lastRequestAt = Math.max(Date.now(), lastRequestAt + ARGS.delay);
	if (wait > 0) await sleep(wait);
}

function release() {
	active--;
	const next = waiting.shift();
	if (next) next();
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function cachePath(url) {
	return join(ARGS.cacheDir, createHash('sha1').update(url).digest('hex') + '.html.gz');
}

async function fetchText(path) {
	const url = BASE + path;
	const file = cachePath(url);
	if (existsSync(file)) {
		stats.cached++;
		return gunzipSync(readFileSync(file)).toString('utf-8');
	}

	for (let attempt = 1; ; attempt++) {
		await acquire();
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const text = await res.text();
			// The AJAX fragment may legitimately be empty. Pages are checked for their content
			// container only: the server cuts /a/3x3 and /a/3x3/ZBLL off before the footer on
			// every request, after the content has been sent.
			if (!path.startsWith('/category.algs.php') && !text.includes('<div id="search-result">')) {
				throw new Error('unexpected page');
			}
			stats.network++;
			mkdirSync(ARGS.cacheDir, {recursive: true});
			writeFileSync(file, gzipSync(text));
			return text;
		} catch (err) {
			if (attempt >= 6) throw new Error(`${url}: ${err.message}`);
			stats.retries++;
			await sleep(1000 * 2 ** attempt);
		} finally {
			release();
		}
	}
}

// ─── HTML helpers ───

const NAMED_ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};

function decode(str) {
	return str.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
		if (e[0] === '#') {
			const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return String.fromCodePoint(code);
		}
		return NAMED_ENTITIES[e.toLowerCase()] ?? m;
	});
}

function text(html) {
	return decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attrs(tagSource) {
	const out = {};
	for (const m of tagSource.matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)')/g)) {
		if (!(m[1] in out)) out[m[1]] = decode(m[2] ?? m[3]);
	}
	return out;
}

function between(html, start, end, from = 0) {
	const i = html.indexOf(start, from);
	if (i === -1) return null;
	const j = html.indexOf(end, i + start.length);
	return j === -1 ? null : html.slice(i + start.length, j);
}

/** Main content of a page, without nav, ads, footer, scripts or styles. */
function content(html) {
	const start = html.indexOf('<div id="search-result">');
	const end = html.indexOf('Log In to Track Your Progress', start);
	let body = start === -1 ? '' : html.slice(start, end === -1 ? undefined : end);
	body = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
	return body;
}

// ─── Discovery ───

const PUZZLE_ORDER_FALLBACK = ['3x3', '2x2', '4x4', '5x5', 'SQ1', 'Megaminx', 'Pyraminx', 'Skewb'];

async function discoverPuzzles() {
	const html = await fetchText('/');
	const seen = [];
	for (const m of html.matchAll(/<a class="search-category" href="\/a\/([^"/]+)"/g)) {
		if (!seen.includes(m[1])) seen.push(m[1]);
	}
	return seen.length ? seen : PUZZLE_ORDER_FALLBACK;
}

/** Sets of a puzzle page in display order, with the section heading each one sits under. */
async function discoverSets(puzzle) {
	const body = content(await fetchText(`/a/${puzzle}`));
	const sets = [];
	let section = null;
	const re = new RegExp(`<h[1-4][^>]*>([\\s\\S]*?)</h[1-4]>|<a\\b([^>]*?)href=["']/?a/${puzzle}/([^"'/]+)["']([^>]*)>([\\s\\S]*?)</a>`, 'g');
	for (const m of body.matchAll(re)) {
		if (m[1] !== undefined) {
			const heading = text(m[1]);
			section = heading === puzzle ? null : heading;
			continue;
		}
		const id = m[3];
		if (sets.some((s) => s.id === id)) continue;
		// Tiles on the 3x3 page prefix the name with a "learnt/total" progress badge
		const name = text(m[5].replace(/<div class="tree-progress">[\s\S]*?<\/div>/g, ''));
		sets.push({id, name, section});
	}
	return sets;
}

/** Tiles on a large-set index page: each one is a page of cases (or another set, as on 1LLL). */
function parseIndexTiles(body) {
	const tiles = [];
	for (const m of body.matchAll(/<a data-search='[^']*' href='a\/([^'/]+)\/([^'/]+)'[^>]*>([\s\S]*?)<\/a>/g)) {
		tiles.push({puzzle: m[1], id: m[2], name: text(between(m[3], '<div class="card-body mt-2">', '</div>') ?? m[3])});
	}
	return tiles;
}

function parseDescription(body) {
	const panel = between(body, 'acknowledgments', '</div></div>');
	if (!panel) return null;
	const inner = panel.slice(panel.indexOf('>') + 1);
	const links = [...inner.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({text: text(m[2]), url: decode(m[1])}));
	const heading = between(inner, '<h1', '</h1>');
	return {
		title: heading ? text(heading.slice(heading.indexOf('>') + 1)) : null,
		text: text(inner.replace(/<h1[\s\S]*?<\/h1>/, '')),
		links,
	};
}

// ─── Leaf page parsing ───

function parseFilters(body) {
	const related = between(body, '<h3 class="me-2 align-self-center">Filter:</h3>', '<div class="container mt-3">') ?? '';
	return [...related.matchAll(/data-filter="([^"]*)"[\s\S]*?<div class="tree-progress">\d+\/(\d+)<\/div>/g)].map((m) => ({
		name: decode(m[1]),
		count: Number(m[2]),
	}));
}

function parseImages(block) {
	const anchor = between(block, 'class="d-flex flex-column align-center"', '</a>') ?? '';
	const images = [];
	for (const m of anchor.matchAll(/<div class="(jcube|icube|sqcube|pcube)[^"]*"([^>]*)>|<img\s([^>]*)>/g)) {
		if (m[3] !== undefined) {
			const src = attrs(m[3]).src;
			images.push({type: 'img', src: src.startsWith('http') ? src : BASE + src});
			continue;
		}
		const data = {};
		for (const [k, v] of Object.entries(attrs(m[2]))) {
			if (k.startsWith('data-') && k !== 'data-width' && k !== 'data-height') data[k.slice(5)] = v;
		}
		images.push({type: m[1], ...data});
	}
	return images;
}

function parseAlgItem(li) {
	const formatted = between(li, '<div class="formatted-alg">', '</div>');
	if (formatted === null) return null;

	let alg;
	let display = null;
	const mnemonics = [...formatted.matchAll(/<span class="mnemonics">([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
	const full = between(formatted, '<span class="fullalg">', '</span>');
	if (full !== null) {
		alg = text(full);
		const mini = between(formatted, '<span class="minifiedalg">', '<span class="fullalg">');
		if (mini !== null) display = text(mini);
	} else {
		alg = text(formatted);
	}

	const details = li.slice(li.indexOf('<div class="alg-details"'));
	const twisty = details.match(/<div class="cubedb-ftw-"([^>]*)>/);
	const votes = details.match(/fa-thumbs-up me-1'><\/i>(-?\d+)/);
	const movecountHtml = between(details, 'Movecount:</div>', '</div>') ?? '';
	const movecount = {};
	for (const m of movecountHtml.matchAll(/>(\d+)\s+([A-Z]+)</g)) movecount[m[2]] = Number(m[1]);
	const face = details.match(/Face Moves:<\/div><span[^>]*>([^<]*)<\/span>\s*\(([^)]*)\)/);
	const youtube = details.match(/youtube\.com\/watch\?v=([\w-]+)/);

	const item = {alg};
	if (display !== null && display !== alg) item.display = display;
	if (mnemonics.length) item.mnemonics = mnemonics;
	const altId = li.match(/data-showhide="#alg-(\d+)"/);
	if (altId) item.altId = Number(altId[1]);
	item.votes = votes ? Number(votes[1]) : null;
	if (Object.keys(movecount).length) item.movecount = movecount;
	if (face) item.faceMoves = {gen: text(face[1]), faces: text(face[2])};
	if (youtube) item.youtube = youtube[1];
	if (twisty) {
		const t = attrs(twisty[1]);
		item.twisty = {puzzle: t['data-puzzle'], setup: t['data-setup'] ?? '', stickering: t['data-stickering'] ?? ''};
	}
	return item;
}

function parseAlgList(html) {
	return html
		.split("<li class='list-group-item'>")
		.slice(1)
		.map((li) => parseAlgItem(li.indexOf('</li>') === -1 ? li : li.slice(0, li.indexOf('</li>'))))
		.filter(Boolean);
}

function parseCase(block) {
	const head = block.slice(0, block.indexOf('>'));
	const headAttrs = attrs(head);
	const info = between(block, '<!-- Algorithm info -->', '<!-- /Algorithm info -->') ?? '';

	const tabs = between(block, '<ul class="nav nav-tabs tabs-orientation">', '</ul>');
	const labels = tabs
		? [...tabs.matchAll(/data-ori='(\d+)'[^>]*><div class='subcatname'>([\s\S]*?)<\/div>/g)].map((m) => ({
				index: Number(m[1]),
				label: text(m[2].replace(/<span[^>]*badge[^>]*>([\s\S]*?)<\/span>/g, '($1)')),
		  }))
		: [];

	const orientations = [];
	const oriChunks = block.split("<div data-ori='").slice(1);
	for (const chunk of oriChunks) {
		const index = Number(chunk.slice(0, chunk.indexOf("'")));
		const more = chunk.match(/<button class='btn underline-link more-algs no-print'([^>]*)>/);
		const moreAttrs = more ? attrs(more[1]) : null;
		orientations.push({
			index,
			label: labels.find((l) => l.index === index)?.label ?? null,
			algorithms: parseAlgList(chunk),
			more: moreAttrs ? {cat: moreAttrs['data-category'], d: moreAttrs['data-d'], algname: moreAttrs['data-algname']} : null,
		});
	}

	const setupHtml = info.match(/<div class="setup-case[^"]*"><div>setup:<\/div>([\s\S]*?)<\/div>/);
	const standard = between(block, '<div class="">Standard Alg:</div>', '</div>');
	const slugAnchor = info.match(/<h2 class="mb-0">\s*<a[^>]*href="a\/[^"/]+\/[^"/]+\/([^"]+)"/);

	return {
		name: headAttrs['data-alg'],
		subgroup: headAttrs['data-subgroup'] || null,
		slug: slugAnchor ? decode(slugAnchor[1]) : null,
		images: parseImages(info),
		setup: setupHtml ? text(setupHtml[1]) : null,
		standardAlg: standard !== null ? text(standard) : null,
		orientations,
	};
}

function parseLeafPage(body) {
	const blocks = body.split('<div class="row singlealgorithm').slice(1);
	return blocks.map((b) => parseCase(b.slice(0, b.indexOf('<!-- /Algorithm Alternatives -->'))));
}

// ─── More Algorithms ───

async function loadMore(orientation) {
	const {more} = orientation;
	if (!more) return;
	const qs = new URLSearchParams({algname: more.algname, d: more.d, cat: more.cat});
	const html = await fetchText(`/category.algs.php?${qs}`);
	const extra = parseAlgList(html);
	const known = new Set(orientation.algorithms.map((a) => a.altId));
	for (const item of extra) {
		if (item.altId !== undefined) {
			if (known.has(item.altId)) continue;
			known.add(item.altId);
		}
		orientation.algorithms.push(item);
	}
	orientation.moreLoaded = extra.length;
}

/**
 * The cubing.js player settings (puzzle, setup rotation, stickering) are the same for nearly
 * every alternative of a case. Keep the most common one on the case, and only the exceptions
 * on the algorithms, so the dump does not repeat it ~100k times.
 */
function hoistTwisty(c) {
	const counts = new Map();
	for (const o of c.orientations) {
		for (const a of o.algorithms) {
			if (!a.twisty) continue;
			const key = JSON.stringify(a.twisty);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	if (counts.size === 0) return;
	const [common] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
	c.twisty = JSON.parse(common);
	for (const o of c.orientations) {
		for (const a of o.algorithms) {
			if (a.twisty && JSON.stringify(a.twisty) === common) delete a.twisty;
		}
	}
}

// ─── Pages ───

const pages = {};
const pageOrder = [];

async function loadPage(puzzle, id, name) {
	const key = `${puzzle}/${id}`;
	if (pages[key]) return pages[key];
	const body = content(await fetchText(`/a/${puzzle}/${id}`));
	const tiles = parseIndexTiles(body);
	const cases = parseLeafPage(body);
	const page = {
		key,
		puzzle,
		id,
		name,
		url: `${BASE}/a/${puzzle}/${id}`,
		description: parseDescription(body),
	};
	if (cases.length === 0 && tiles.length > 0) {
		page.kind = 'index';
		page.children = tiles.map((t) => `${t.puzzle}/${t.id}`);
		pages[key] = page;
		pageOrder.push(key);
		for (const t of tiles) await loadPage(t.puzzle, t.id, t.name);
	} else {
		page.kind = 'leaf';
		page.filters = parseFilters(body);
		page.cases = cases;
		pages[key] = page;
		pageOrder.push(key);
	}
	return page;
}

// ─── Main ───

async function main() {
	const startedAt = new Date().toISOString();
	const [onlyPuzzle, onlySet] = ARGS.only ? ARGS.only.split('/') : [null, null];

	const puzzles = [];
	for (const puzzle of await discoverPuzzles()) {
		if (onlyPuzzle && puzzle !== onlyPuzzle) continue;
		const sets = (await discoverSets(puzzle)).filter((s) => !onlySet || s.id === onlySet);
		for (const s of sets) {
			const page = await loadPage(puzzle, s.id, s.name);
			s.page = page.key;
			console.log(`[pages] ${page.key} ${page.kind === 'index' ? `index → ${page.children.length} pages` : `${page.cases.length} cases`}`);
		}
		puzzles.push({id: puzzle, url: `${BASE}/a/${puzzle}`, sets});
	}

	const orientations = [];
	for (const key of pageOrder) {
		const page = pages[key];
		if (page.kind !== 'leaf') continue;
		for (const c of page.cases) for (const o of c.orientations) orientations.push(o);
	}
	console.log(`[more] ${orientations.length} case orientations to complete`);
	let done = 0;
	// All at once: acquire() caps the requests actually in flight at --concurrency
	await Promise.all(
		orientations.map(async (o) => {
			await loadMore(o);
			if (++done % 250 === 0) console.log(`[more] ${done}/${orientations.length} (network ${stats.network}, cached ${stats.cached}, retries ${stats.retries})`);
		}),
	);

	let caseCount = 0;
	let algCount = 0;
	for (const key of pageOrder) {
		const page = pages[key];
		if (page.kind !== 'leaf') continue;
		for (const c of page.cases) {
			caseCount++;
			hoistTwisty(c);
			for (const o of c.orientations) {
				algCount += o.algorithms.length;
				delete o.more;
			}
		}
	}

	const out = {
		source: BASE,
		scraperVersion: SCRAPER_VERSION,
		scrapedAt: startedAt,
		totals: {puzzles: puzzles.length, pages: pageOrder.length, cases: caseCount, algorithms: algCount},
		puzzles,
		pages: Object.fromEntries(pageOrder.map((k) => [k, pages[k]])),
	};
	mkdirSync(dirname(ARGS.out), {recursive: true});
	writeFileSync(ARGS.out, JSON.stringify(out, null, '\t') + '\n');
	console.log(`[done] ${caseCount} cases, ${algCount} algorithms → ${ARGS.out}`);
	console.log(`[http] network ${stats.network}, cached ${stats.cached}, retries ${stats.retries}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
