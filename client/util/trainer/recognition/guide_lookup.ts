/**
 * Guide Pattern Matching & Lookup
 * Referans `guide_lookup.js` birebir TypeScript portu.
 *
 * Pre-computes a lookup table mapping every (caseName, rotation) to the
 * matching guide group + row from Mark49152's Two-Sided PLL Recognition Guide.
 *
 * The two-sided pattern depends only on (caseName, rotation) — not dTurn,
 * colorShift, or crossColor — so the table has ~73 entries.
 */

import {createSolvedCube, applyAlgorithm} from './cube_sim';
import {inverseScramble} from './scramble';
import {allPllKeys} from './pll_cases';
import pllMap from '../../../../public/trainer/pll-recognition-algs.json';
import guideData from '../../../../public/trainer/pll-guide-data.json';

const pllAlgs = pllMap as Record<string, Record<string, string>>;

// Camera-visible sticker indices: F face top row (left) + R face top row (right).
const VIEW = {
	left: [18, 19, 20],
	right: [9, 10, 11], // F[0,1,2], R[0,1,2]
	fc: 22,
	rc: 13,
	bc: 49,
	lc: 40, // face centers: F, R, B, L
};

// Group precedence (lower = higher priority)
const GROUP_PRECEDENCE: Record<string, number> = {
	three_bar: 0,
	double_lights: 1,
	lights_plus_2bar: 1,
	lone_lights: 1,
	double_2bar: 2,
	outside_2bar: 2,
	inside_2bar: 2,
	bookends_no_bar: 3,
	no_bookends: 3,
};

function toRelative(sticker: number, fc: number, rc: number, bc: number, lc: number): string {
	if (sticker === fc) return 'g';
	if (sticker === rc) return 'o';
	if (sticker === bc) return 'b';
	if (sticker === lc) return 'r';
	return 'x';
}

// Structural match: check if there's a consistent injective mapping
// from guide colors to computed colors (wildcards match anything).
function structuralMatch(computed: string[], guide: string[]): boolean {
	const fwd: Record<string, string> = {};
	const rev: Record<string, string> = {};
	for (let i = 0; i < 6; i++) {
		if (guide[i] === 'x') continue;
		const gc = guide[i];
		const cc = computed[i];
		if (gc in fwd) {
			if (fwd[gc] !== cc) return false;
		} else {
			if (cc in rev) return false;
			fwd[gc] = cc;
			rev[cc] = gc;
		}
	}
	return true;
}

// Mirror: spatial reversal (looking from the other end of the same two faces)
function mirror(cells: string[]): string[] {
	return [cells[5], cells[4], cells[3], cells[2], cells[1], cells[0]];
}

function textMatchesCase(text: string | null | undefined, caseName: string): boolean {
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

interface GuideAnnotation {
	id: string;
	type: string;
	fromRow: number;
	toRow: number;
	text: string;
}

interface GuideRow {
	pattern: {layers: {row: number; col: number; cells: string[]}[]};
	text?: string | null;
	annotationRef?: string;
}

export interface GuideGroup {
	id: string;
	title: string;
	gridRow: number;
	gridCol: number;
	header: {layers: {row: number; col: number; cells: string[]}[]};
	rows: GuideRow[];
	annotations?: GuideAnnotation[];
}

interface GuideData {
	meta: Record<string, unknown>;
	notes: string[];
	precedence: string[];
	cellLegend: Record<string, string>;
	layout: {type: string; columns: number; rows: string[][]; defaultPatternColumns: number};
	groups: GuideGroup[];
}

const typedGuideData = guideData as GuideData;

function effectiveText(row: GuideRow, group: GuideGroup): string | null {
	if (row.text) return row.text;
	if (row.annotationRef && group.annotations) {
		const ann = group.annotations.find((a) => a.id === row.annotationRef);
		if (ann) return ann.text;
	}
	return null;
}

interface BuiltRow {
	groupId: string;
	rowIndex: number;
	cells: string[];
	mirrorCells: string[];
	text: string | null;
	precedence: number;
}

export interface GuideLookupEntry {
	groupId: string;
	rowIndex: number;
}

function buildLookupTable(): Record<string, GuideLookupEntry> {
	const table: Record<string, GuideLookupEntry> = {};

	const guideRows: BuiltRow[] = [];
	for (const group of typedGuideData.groups) {
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

		const alg = pllAlgs[name]?.['noAuf'] || '';
		const inv = rotation ? inverseScramble(rotation) : '';
		const scramble = inv ? `${alg} ${inv}` : alg;

		const state = createSolvedCube();
		applyAlgorithm(state, scramble);

		const fc = state[VIEW.fc];
		const rc = state[VIEW.rc];
		const bc = state[VIEW.bc];
		const lc = state[VIEW.lc];

		const pattern = [
			...VIEW.left.map((i) => toRelative(state[i], fc, rc, bc, lc)),
			...VIEW.right.map((i) => toRelative(state[i], fc, rc, bc, lc)),
		];

		const hits: BuiltRow[] = [];
		for (const gr of guideRows) {
			if (structuralMatch(pattern, gr.cells) || structuralMatch(pattern, gr.mirrorCells)) {
				hits.push(gr);
			}
		}

		if (hits.length === 0) continue;

		let best: BuiltRow;
		if (hits.length === 1) {
			best = hits[0];
		} else {
			const nameHits = hits.filter((h) => textMatchesCase(h.text, name));
			const pool = nameHits.length > 0 ? nameHits : hits;
			best = pool.reduce((a, b) => (a.precedence <= b.precedence ? a : b));
		}

		table[key] = {groupId: best.groupId, rowIndex: best.rowIndex};
	}

	return table;
}

const lookupTable = buildLookupTable();
const groupsById: Record<string, GuideGroup> = Object.fromEntries(
	typedGuideData.groups.map((g) => [g.id, g])
);

// Inverse lookup: groupId -> Set<key>
const inverseTable: Record<string, Set<string>> = {};
for (const [key, info] of Object.entries(lookupTable)) {
	if (!inverseTable[info.groupId]) {
		inverseTable[info.groupId] = new Set<string>();
	}
	inverseTable[info.groupId].add(key);
}

export function keysForGroups(groupIds: string[]): string[] {
	const result = new Set<string>();
	for (const id of groupIds) {
		const keys = inverseTable[id];
		if (keys) keys.forEach((k) => result.add(k));
	}
	return [...result];
}

export function lookupGuideHint(pllCase: {name: string; rotation: string} | null): GuideLookupEntry | null {
	if (!pllCase) return null;
	const key = `${pllCase.name}/${pllCase.rotation}`;
	return lookupTable[key] || null;
}

export function getGuideGroup(groupId: string): GuideGroup | null {
	return groupsById[groupId] || null;
}

export function getGuideData(): GuideData {
	return typedGuideData;
}

export function getFullLookupTable(): Record<string, GuideLookupEntry> {
	return lookupTable;
}
