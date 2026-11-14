import { v4 as uuid } from 'uuid';
import { IImportDataContext, ImportableData } from '../ImportData';
import { SessionInput, SolveInput } from '../../../../../@types/generated/graphql';
import { normalizeBucketForImport } from './normalize-bucket';
import { detectCubeTypeFromScramble } from './detect-cube-type';

// Last Cube X full backup (lastcubex_backup_<ms>.csv). One file holds every session:
//   Puzzle;Session;Time(millis);Date(millis);Scramble;Penalty;Remark;Reconstruction
// Every field is double-quoted. The layout is Twisty Timer's full backup with Category renamed
// to Session, so its penalty codes are used: 0 none, 1 +2, 2 DNF, with the +2 already inside
// Time (Twisty adds 2000 ms when the penalty is applied).

const HEADER_PREFIX = 'puzzle;session;time(millis);date(millis);scramble;penalty';

// Puzzle name with everything but letters and digits removed, lowercased.
const PUZZLE_MAP: Record<string, string> = {
	'222': '222',
	'2x2': '222',
	'2x2x2': '222',
	'333': '333',
	'3x3': '333',
	'3x3x3': '333',
	'444': '444',
	'4x4': '444',
	'4x4x4': '444',
	'555': '555',
	'5x5': '555',
	'5x5x5': '555',
	'666': '666',
	'6x6': '666',
	'6x6x6': '666',
	'777': '777',
	'7x7': '777',
	'7x7x7': '777',
	pyraminx: 'pyram',
	pyra: 'pyram',
	megaminx: 'minx',
	mega: 'minx',
	minx: 'minx',
	skewb: 'skewb',
	square1: 'sq1',
	sq1: 'sq1',
	clock: 'clock',
};

// A 3x3 session the cuber named for one-handed solving ("OH", "on hand", "one handed", "tek el").
const OH_NAME = /(^|[^a-z])(oh|on ?hand|one ?hand(ed)?|tek ?el)([^a-z]|$)/i;

const PENALTY_PLUS_TWO = '1';
const PENALTY_DNF = '2';

/**
 * Splits the whole file into rows of fields. Handles quoted fields, "" escapes and line breaks
 * inside quotes (a remark can span lines), so it cannot work line by line.
 */
export function parseSemicolonCsv(txt: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < txt.length; i++) {
		const ch = txt[i];
		if (inQuotes) {
			if (ch === '"') {
				if (txt[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ';') {
			row.push(field);
			field = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && txt[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += ch;
		}
	}

	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

function flatTypeFor(puzzle: string, sessionName: string, scrambles: string[]): string | null {
	const key = puzzle.toLowerCase().replace(/[^a-z0-9]/g, '');
	let flat = PUZZLE_MAP[key] ?? null;

	if (!flat) {
		for (const s of scrambles.slice(0, 5)) {
			flat = detectCubeTypeFromScramble(s);
			if (flat) break;
		}
	}

	if (flat === '333' && (OH_NAME.test(sessionName) || OH_NAME.test(puzzle))) return '333oh';
	return flat;
}

interface LcxGroup {
	puzzle: string;
	name: string;
	rows: string[][];
}

export function parseLastCubeXData(txt: string, _context?: IImportDataContext): ImportableData {
	const rows = parseSemicolonCsv(txt.replace(/^﻿/, ''));
	const header = (rows[0] || []).join(';').toLowerCase();
	if (!header.startsWith(HEADER_PREFIX)) {
		throw new Error('LASTCUBEX_INVALID_FILE');
	}

	// Group by (puzzle, session) in file order: the same session name can exist under two puzzles.
	const groups = new Map<string, LcxGroup>();
	for (const r of rows.slice(1)) {
		if (r.length < 6) continue;
		const key = `${r[0]}\u0000${r[1]}`;
		let g = groups.get(key);
		if (!g) {
			g = { puzzle: r[0], name: r[1], rows: [] };
			groups.set(key, g);
		}
		g.rows.push(r);
	}

	const sessions: SessionInput[] = [];
	const solves: SolveInput[] = [];
	const sessionIdCubeTypeMap: Record<string, string> = {};
	const skippedCubeTypes: Record<string, number> = {};
	let skippedSolveCount = 0;

	for (const g of groups.values()) {
		const flat = flatTypeFor(g.puzzle, g.name, g.rows.map((r) => r[4]));
		const bucket = normalizeBucketForImport(flat);
		if (!bucket) {
			skippedSolveCount += g.rows.length;
			skippedCubeTypes[g.puzzle] = (skippedCubeTypes[g.puzzle] || 0) + g.rows.length;
			continue;
		}

		const sessionId = uuid();
		let count = 0;
		for (const r of g.rows) {
			const timeMs = Number(r[2]);
			const startedAt = Number(r[3]);
			if (!Number.isFinite(timeMs) || timeMs <= 0 || !Number.isFinite(startedAt)) {
				skippedSolveCount++;
				continue;
			}

			const penalty = (r[5] || '').trim();
			const plusTwo = penalty === PENALTY_PLUS_TWO;
			const dnf = penalty === PENALTY_DNF;
			const rawMs = plusTwo ? Math.max(0, timeMs - 2000) : timeMs;

			solves.push({
				time: dnf ? -1 : (plusTwo ? rawMs + 2000 : rawMs) / 1000,
				raw_time: rawMs / 1000,
				plus_two: plusTwo,
				dnf,
				scramble: (r[4] || '').replace(/\s+/g, ' ').trim(),
				cube_type: bucket.cube_type,
				scramble_subset: bucket.scramble_subset,
				session_id: sessionId,
				notes: (r[6] || '').trim(),
				started_at: startedAt,
				ended_at: startedAt + rawMs,
			});
			count++;
		}

		if (count === 0) continue;
		sessions.push({ id: sessionId, name: g.name || g.puzzle, order: sessions.length });
		// ReviewImport's picker reads the subset when there is one, else the flat event.
		sessionIdCubeTypeMap[sessionId] = bucket.scramble_subset ?? flat;
	}

	if (solves.length === 0 && skippedSolveCount === 0) {
		throw new Error('LASTCUBEX_INVALID_FILE');
	}

	return {
		solves,
		sessions,
		sessionIdCubeTypeMap,
		skippedSolveCount: skippedSolveCount || undefined,
		skippedCubeTypes: Object.keys(skippedCubeTypes).length ? skippedCubeTypes : undefined,
	};
}
