#!/usr/bin/env node
/**
 * PLL Recognition Guide Lookup Generator
 *
 * Referans `src/scripts/guide_lookup.js` build-time tek seferlik calistirmasi.
 * Her (caseName, rotation) -> {groupId, rowIndex} eslemesini onceden hesaplar.
 *
 * Calistirma: node scripts/generate-pll-recognition-guide-lookup.mjs
 * Cikti: public/trainer/pll-guide-lookup.json (73-entry JSON)
 *
 * Coverage hedefi: 73/73 (sifir conflict). Az olursa hata firlatir.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const pllMap = JSON.parse(readFileSync(resolve(ROOT, 'public/trainer/pll-recognition-algs.json'), 'utf8'));
const guideData = JSON.parse(readFileSync(resolve(ROOT, 'public/trainer/pll-guide-data.json'), 'utf8'));

// ──────────────────── cube_sim (referans birebir) ────────────────────

function cycleCW(s, a, b, c, d) {
	const t = s[d]; s[d] = s[c]; s[c] = s[b]; s[b] = s[a]; s[a] = t;
}
function cycleCCW(s, a, b, c, d) {
	const t = s[a]; s[a] = s[b]; s[b] = s[c]; s[c] = s[d]; s[d] = t;
}
function applyCW(s, cs) { for (let i = 0; i < cs.length; i++) { const c = cs[i]; cycleCW(s, c[0], c[1], c[2], c[3]); } }
function applyCCW(s, cs) { for (let i = 0; i < cs.length; i++) { const c = cs[i]; cycleCCW(s, c[0], c[1], c[2], c[3]); } }

const MOVES = {
	U: [[0,2,8,6],[1,5,7,3],[18,36,45,9],[19,37,46,10],[20,38,47,11]],
	R: [[9,11,17,15],[10,14,16,12],[20,2,51,29],[23,5,48,32],[26,8,45,35]],
	F: [[18,20,26,24],[19,23,25,21],[6,9,29,44],[7,12,28,41],[38,8,15,27]],
	D: [[27,29,35,33],[28,32,34,30],[24,15,51,42],[25,16,52,43],[44,26,17,53]],
	L: [[36,38,44,42],[37,41,43,39],[6,24,33,47],[3,21,30,50],[18,27,53,0]],
	B: [[45,47,53,51],[46,50,52,48],[2,36,33,17],[1,39,34,14],[11,0,42,35]],
	x: [[18,0,53,27],[19,1,52,28],[20,2,51,29],[21,3,50,30],[22,4,49,31],[23,5,48,32],[24,6,47,33],[25,7,46,34],[26,8,45,35],[9,11,17,15],[10,14,16,12],[36,42,44,38],[37,39,43,41]],
	y: [[18,36,45,9],[19,37,46,10],[20,38,47,11],[21,39,48,12],[22,40,49,13],[23,41,50,14],[24,42,51,15],[25,43,52,16],[26,44,53,17],[0,2,8,6],[1,5,7,3],[27,33,35,29],[28,30,34,32]],
	z: [[0,11,35,42],[1,14,34,39],[2,17,33,36],[3,10,32,43],[4,13,31,40],[5,16,30,37],[6,9,29,44],[7,12,28,41],[8,15,27,38],[18,20,26,24],[19,23,25,21],[45,51,53,47],[46,48,52,50]],
};

function createSolvedCube() {
	const state = new Int8Array(54);
	for (let i = 0; i < 54; i++) state[i] = Math.floor(i / 9);
	return state;
}
function applyMove(state, token) {
	const base = token[0];
	const mod = token.length > 1 ? token[1] : '';
	const cycles = MOVES[base];
	if (!cycles) return;
	if (mod === '2') { applyCW(state, cycles); applyCW(state, cycles); }
	else if (mod === "'") applyCCW(state, cycles);
	else applyCW(state, cycles);
}
function applyAlgorithm(state, alg) {
	const tokens = alg.trim().split(/\s+/);
	for (let i = 0; i < tokens.length; i++) if (tokens[i]) applyMove(state, tokens[i]);
}

// ──────────────────── scramble helpers ────────────────────

function inverseScramble(s) {
	return s.split(' ').map((it) => {
		if (it.length === 0) return '';
		if (it[it.length - 1] === '2') return it;
		if (it[it.length - 1] === "'") return it.slice(0, -1);
		return `${it}'`;
	}).reverse().join(' ');
}

// ──────────────────── pll_cases ────────────────────

function allPllKeys() {
	const plls = Object.keys(pllMap);
	const getRots = (first) => {
		switch (first) {
			case 'H': return [''];
			case 'N': case 'E': case 'Z': return ['', 'y'];
			default: return ['', 'y', 'y2', "y'"];
		}
	};
	const keys = [];
	for (const pll of plls) for (const rot of getRots(pll[0])) keys.push(`${pll}/${rot}`);
	return keys;
}

// ──────────────────── guide_lookup (referans birebir) ────────────────────

const VIEW = {left: [18,19,20], right: [9,10,11], fc: 22, rc: 13, bc: 49, lc: 40};
const GROUP_PRECEDENCE = {
	three_bar: 0, double_lights: 1, lights_plus_2bar: 1, lone_lights: 1,
	double_2bar: 2, outside_2bar: 2, inside_2bar: 2,
	bookends_no_bar: 3, no_bookends: 3,
};

function toRelative(s, fc, rc, bc, lc) {
	if (s === fc) return 'g';
	if (s === rc) return 'o';
	if (s === bc) return 'b';
	if (s === lc) return 'r';
	return 'x';
}

function structuralMatch(computed, guide) {
	const fwd = {}, rev = {};
	for (let i = 0; i < 6; i++) {
		if (guide[i] === 'x') continue;
		const gc = guide[i], cc = computed[i];
		if (gc in fwd) { if (fwd[gc] !== cc) return false; }
		else { if (cc in rev) return false; fwd[gc] = cc; rev[cc] = gc; }
	}
	return true;
}

function mirror(cells) {
	return [cells[5], cells[4], cells[3], cells[2], cells[1], cells[0]];
}

function textMatchesCase(text, caseName) {
	if (!text) return false;
	const m = text.match(/=\s*(.+)$/);
	if (!m) return false;
	const label = m[1].trim();
	if (label.includes('/')) {
		const prefix = label[0];
		const suffixes = label.slice(1).split('/');
		return caseName[0] === prefix && suffixes.includes(caseName.slice(1));
	}
	return caseName.startsWith(label);
}

function effectiveText(row, group) {
	if (row.text) return row.text;
	if (row.annotationRef && group.annotations) {
		const ann = group.annotations.find((a) => a.id === row.annotationRef);
		if (ann) return ann.text;
	}
	return null;
}

function buildLookupTable() {
	const table = {};
	const guideRows = [];
	for (const group of guideData.groups) {
		for (let ri = 0; ri < group.rows.length; ri++) {
			const row = group.rows[ri];
			const cells = row.pattern.layers[0].cells.map((c) => c.replace('!', ''));
			guideRows.push({
				groupId: group.id,
				rowIndex: ri,
				cells,
				mirrorCells: mirror(cells),
				text: effectiveText(row, group),
				precedence: GROUP_PRECEDENCE[group.id],
			});
		}
	}

	for (const key of allPllKeys()) {
		const sep = key.indexOf('/');
		const name = key.slice(0, sep);
		const rotation = key.slice(sep + 1);
		const alg = pllMap[name]['noAuf'];
		const inv = rotation ? inverseScramble(rotation) : '';
		const scramble = inv ? `${alg} ${inv}` : alg;
		const state = createSolvedCube();
		applyAlgorithm(state, scramble);
		const fc = state[VIEW.fc], rc = state[VIEW.rc], bc = state[VIEW.bc], lc = state[VIEW.lc];
		const pattern = [
			...VIEW.left.map((i) => toRelative(state[i], fc, rc, bc, lc)),
			...VIEW.right.map((i) => toRelative(state[i], fc, rc, bc, lc)),
		];
		const hits = [];
		for (const gr of guideRows) {
			if (structuralMatch(pattern, gr.cells) || structuralMatch(pattern, gr.mirrorCells)) hits.push(gr);
		}
		if (hits.length === 0) continue;
		let best;
		if (hits.length === 1) best = hits[0];
		else {
			const nameHits = hits.filter((h) => textMatchesCase(h.text, name));
			const pool = nameHits.length > 0 ? nameHits : hits;
			best = pool.reduce((a, b) => (a.precedence <= b.precedence ? a : b));
		}
		table[key] = {groupId: best.groupId, rowIndex: best.rowIndex};
	}
	return table;
}

// ──────────────────── run ────────────────────

const allKeys = allPllKeys();
console.log(`Total PLL keys: ${allKeys.length}`);
const table = buildLookupTable();
const covered = Object.keys(table).length;
const missing = allKeys.filter((k) => !(k in table));

console.log(`Coverage: ${covered}/${allKeys.length}`);
if (missing.length > 0) {
	console.error('MISSING keys:', missing);
	process.exit(1);
}

const outPath = resolve(ROOT, 'public/trainer/pll-guide-lookup.json');
writeFileSync(outPath, JSON.stringify(table, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
