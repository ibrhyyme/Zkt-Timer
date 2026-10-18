// Static checks of scripts/migrations/cubes-from-smart-devices.sql (design magnet-cubes.md 7.6).
// No database: the SQL copies of TypeScript rules (the 3x3 predicate, the brand table, the
// serial-name pattern) are parsed out of the file and compared with the functions they copy,
// and the file's safety shape (dry run by default, no destructive statement) is asserted.
// A real rehearsal (dry run, apply, second apply) is the owner's, on the local database.

import * as fs from 'fs';
import * as path from 'path';
import {puzzleOfBucket} from '../../../shared/cube_puzzle';
import {CUBE_TYPES} from '../../../client/util/cubes/cube_types';
import {SCRAMBLE_SUBSETS} from '../../../client/util/cubes/scramble_subsets';
import {SUPPORTED_SMART_CUBE_BRANDS} from '../../../client/components/timer/smart_cube/bluetooth/supported_cubes';
import {
	brandFromBleName,
	isDistinctiveBleName,
	smartCubeDefaultName,
	CUBE_BRAND_MAX,
	CUBE_NAME_MAX,
} from '../../../server/util/cube_validation';

const ROOT = path.resolve(__dirname, '../../..');
const SQL_PATH = path.join(ROOT, 'scripts/migrations/cubes-from-smart-devices.sql');
const SQL = fs.readFileSync(SQL_PATH, 'utf8');
const LINES = SQL.split(/\r?\n/);

/** The file without `--` comments, for statement checks. No string literal in it holds `--`. */
const CODE = LINES.map((line) => line.replace(/--.*$/, '')).join('\n');

function sqlStringList(list: string): string[] {
	return [...list.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
}

function markedLines(marker: string): string[] {
	return LINES.filter((line) => line.trimEnd().endsWith(`-- ${marker}`));
}

// ---------------------------------------------------------------------------
// 3x3 predicate
// ---------------------------------------------------------------------------

const PREDICATE_RE =
	/\(\(s\.cube_type = 'wca' AND s\.scramble_subset IN \(([^)]*)\)\) OR s\.cube_type IN \(([^)]*)\)\)/;

interface ParsedPredicate {
	wcaSubsets: string[];
	cubeTypes: string[];
}

function parsePredicate(line: string): ParsedPredicate {
	const match = PREDICATE_RE.exec(line);
	if (!match) throw new Error(`Unexpected PUZZLE_333_PREDICATE shape: ${line.trim()}`);
	return {wcaSubsets: sqlStringList(match[1]), cubeTypes: sqlStringList(match[2])};
}

/** JS evaluation of the SQL predicate with SQL NULL semantics folded to false (a WHERE drops NULL). */
function sqlPredicate(p: ParsedPredicate, cubeType: string | null, subset: string | null): boolean {
	if (cubeType === null) return false;
	if (cubeType === 'wca' && subset !== null && p.wcaSubsets.includes(subset)) return true;
	return p.cubeTypes.includes(cubeType);
}

describe('PUZZLE_333_PREDICATE', () => {
	const lines = markedLines('PUZZLE_333_PREDICATE');
	const predicates = lines.map(parsePredicate);
	const predicate = predicates[0];

	// Every string the TypeScript side knows about: the puzzle module's own literals (its
	// private maps included), every timer type, every subset, and the SQL lists themselves.
	const puzzleSource = fs.readFileSync(path.join(ROOT, 'shared/cube_puzzle.ts'), 'utf8');
	const universe = new Set<string>([
		...[...puzzleSource.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]),
		...Object.keys(CUBE_TYPES),
		...Object.values(SCRAMBLE_SUBSETS).flatMap((subsets) => subsets.map((s) => s.id)),
		...predicate.wcaSubsets,
		...predicate.cubeTypes,
		'',
	]);

	it('is used by the link steps (5, 6) and the report, and every copy is identical', () => {
		// Step 5 link, step 5 report, step 6 link, step 6 skipped and two step 6 reports.
		expect(lines.length).toBeGreaterThanOrEqual(6);
		for (const p of predicates) expect(p).toEqual(predicate);
	});

	it('lists exactly the timer types puzzleOfBucket maps to 333', () => {
		const expected = [...universe].filter((t) => t !== 'wca' && puzzleOfBucket(t, null) === '333').sort();
		expect([...predicate.cubeTypes].sort()).toEqual(expected);
	});

	it('lists exactly the wca subsets puzzleOfBucket maps to 333', () => {
		const expected = [...universe].filter((s) => puzzleOfBucket('wca', s) === '333').sort();
		expect([...predicate.wcaSubsets].sort()).toEqual(expected);
	});

	it('agrees with puzzleOfBucket on every (type, subset) pair', () => {
		const types: (string | null)[] = [...universe, null];
		const subsets: (string | null)[] = [...universe, null];
		const mismatches: string[] = [];
		for (const t of types) {
			for (const s of subsets) {
				const ts = puzzleOfBucket(t, s) === '333';
				if (sqlPredicate(predicate, t, s) !== ts) mismatches.push(`${t}::${s} ts=${ts}`);
			}
		}
		expect(mismatches).toEqual([]);
	});

	it('links 3x3 method and WCA buckets and nothing else', () => {
		expect(sqlPredicate(predicate, 'wca', '333')).toBe(true);
		expect(sqlPredicate(predicate, '333cfop', 'pll')).toBe(true);
		expect(sqlPredicate(predicate, '333roux', null)).toBe(true);
		expect(sqlPredicate(predicate, 'wca', '222')).toBe(false);
		expect(sqlPredicate(predicate, 'wca', null)).toBe(false);
		expect(sqlPredicate(predicate, '444yau', null)).toBe(false);
		expect(sqlPredicate(predicate, 'other', null)).toBe(false);
		expect(sqlPredicate(predicate, '6b1d3c1e-0f0a-4b8e-9d55-2f1e9a7c1234', null)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Brand CASE
// ---------------------------------------------------------------------------

describe('BRAND_CASE', () => {
	const parsed = markedLines('BRAND_CASE').map((line) => {
		const prefixes = [...line.matchAll(/starts_with\(g\.ble_name, '((?:[^']|'')*)'\)/g)].map((m) =>
			m[1].replace(/''/g, "'")
		);
		const brand = /THEN '((?:[^']|'')*)'/.exec(line);
		if (!brand || !prefixes.length) throw new Error(`Unexpected BRAND_CASE line: ${line.trim()}`);
		return {brand: brand[1].replace(/''/g, "'"), prefixes};
	});

	/** The SQL CASE: the first WHEN whose prefix matches wins, no match is NULL. */
	function sqlBrand(name: string | null): string | null {
		if (name === null) return null;
		for (const entry of parsed) {
			if (entry.prefixes.some((prefix) => name.startsWith(prefix))) return entry.brand;
		}
		return null;
	}

	it('copies SUPPORTED_SMART_CUBE_BRANDS entry by entry, in order', () => {
		expect(parsed).toEqual(
			SUPPORTED_SMART_CUBE_BRANDS.map((entry) => ({
				brand: entry.brand.slice(0, CUBE_BRAND_MAX),
				prefixes: entry.prefixes,
			}))
		);
	});

	it('gives the same brand as brandFromBleName', () => {
		const names = [
			'GANi3_F568',
			'GAN12ui_3A4B',
			'Gan356',
			'MGC_1234',
			'AiCube_01',
			'GiC12345',
			'Hi-Smart',
			'Mi Smart Magic Cube',
			'GoCube_ABCD',
			'Rubiks_X',
			'MHC',
			'WCU_MY3_0001',
			'WCUXMY3',
			'QY-QYSC-S-1234',
			'XMD-TornadoV4-i-9F0A',
			'Unknown cube',
			'',
		];
		for (const prefix of SUPPORTED_SMART_CUBE_BRANDS.flatMap((e) => e.prefixes)) names.push(prefix, `${prefix}_0000`);
		for (const name of names) expect({name, brand: sqlBrand(name)}).toEqual({name, brand: brandFromBleName(name)});
		expect(sqlBrand(null)).toBe(brandFromBleName(null));
	});

	it('matches prefixes literally, never through LIKE wildcards', () => {
		expect(CODE).not.toMatch(/ble_name\s+(I?LIKE|SIMILAR TO)/i);
	});
});

// ---------------------------------------------------------------------------
// Grouping and naming rules shared with the resolver
// ---------------------------------------------------------------------------

describe('rules shared with server/util/cube_validation.ts', () => {
	it('groups by the same serial-name pattern as isDistinctiveBleName', () => {
		const lines = markedLines('DISTINCTIVE_NAME_PATTERN');
		expect(lines).toHaveLength(1);
		const pattern = /~ '((?:[^']|'')*)'/.exec(lines[0]);
		expect(pattern).not.toBeNull();
		const re = new RegExp(pattern![1]);
		for (const name of ['GANi3_F568', 'GAN12ui_3a4b', 'MHC', 'GoCube', 'QY-QYSC-S-12G4', 'Gi1234', 'x0000', 'abc']) {
			expect({name, distinctive: re.test(name)}).toEqual({name, distinctive: isDistinctiveBleName(name)});
		}
	});

	it('names a cube like smartCubeDefaultName (40 characters, Smart Cube fallback)', () => {
		expect(smartCubeDefaultName('')).toBe('Smart Cube');
		expect(SQL).toContain("'Smart Cube'");
		expect(SQL).toContain(`left(display_name, ${CUBE_NAME_MAX})`);
		expect(SQL).toContain(`left(ble_name, ${CUBE_NAME_MAX})`);
	});

	it('gives migrated mains the same set_at as the server (AUTO_MAIN_SET_AT)', () => {
		const modelSource = fs.readFileSync(path.join(ROOT, 'server/models/cube.ts'), 'utf8');
		const auto = /AUTO_MAIN_SET_AT = new Date\('(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z'\)/.exec(modelSource);
		expect(auto).not.toBeNull();
		expect(SQL).toContain(`TIMESTAMP '${auto![1]} 00:00:00'`);
	});
});

// ---------------------------------------------------------------------------
// Safety shape
// ---------------------------------------------------------------------------

describe('safety', () => {
	it('stops on the first error and runs in a single transaction', () => {
		expect(SQL).toMatch(/^\\set ON_ERROR_STOP on$/m);
		expect(CODE.match(/^\s*BEGIN;/gm)).toHaveLength(1);
		expect(CODE.match(/^\s*COMMIT;/gm)).toHaveLength(1);
	});

	it('ends with the apply switch, and commits only inside it', () => {
		const tail = CODE.trimEnd();
		const start = tail.lastIndexOf('\\if :{?apply}');
		expect(start).toBeGreaterThan(-1);
		const block = tail.slice(start);
		// Nothing but the switch after its start: no statement runs after COMMIT/ROLLBACK.
		expect(block).toMatch(/\\endif$/);
		expect(block).toContain('COMMIT;');
		expect(block).toContain('ROLLBACK;');
		expect(tail.slice(0, start)).not.toMatch(/\b(COMMIT|ROLLBACK)\s*;/i);
		// The value of apply is checked too, so -v apply=0 stays a dry run.
		expect(block).toMatch(/\\if :apply\b/);
	});

	it('has no destructive or schema statement', () => {
		expect(CODE).not.toMatch(/\bDELETE\b/i);
		expect(CODE).not.toMatch(/\bDROP\b/i);
		expect(CODE).not.toMatch(/\bTRUNCATE\b/i);
		expect(CODE).not.toMatch(/\bALTER\b/i);
		expect(CODE).not.toMatch(/accept-data-loss/i);
	});

	it('creates only temporary tables and indexes on them', () => {
		const tables = [...CODE.matchAll(/\bCREATE\s+(TEMP\s+|TEMPORARY\s+)?TABLE\s+(\w+)/gi)];
		expect(tables.length).toBeGreaterThan(0);
		const temp = new Set<string>();
		for (const m of tables) {
			expect({table: m[2], temp: !!m[1]}).toEqual({table: m[2], temp: true});
			temp.add(m[2]);
		}
		for (const m of CODE.matchAll(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b[^;]*?\bON\s+(\w+)/gi)) {
			expect({index_on: m[1], temp: temp.has(m[1])}).toEqual({index_on: m[1], temp: true});
		}
	});

	it('writes only the cube tables and solve.cube_id', () => {
		const updated = [...CODE.matchAll(/\bUPDATE\s+(\w+)/gi)].map((m) => m[1]);
		const inserted = [...CODE.matchAll(/\bINSERT\s+INTO\s+(\w+)/gi)].map((m) => m[1]);
		const allowed = new Set(['cube', 'cube_main', 'solve', 'sd_groups', 'cube_migration_report']);
		for (const table of [...updated, ...inserted]) expect({table, allowed: allowed.has(table)}).toEqual({table, allowed: true});
		// Every UPDATE of solve sets cube_id and nothing else.
		for (const m of CODE.matchAll(/\bUPDATE\s+solve\s+\w+\s+SET\s+([^\n]*)/gi)) {
			expect(m[1].trim()).toMatch(/^cube_id = \w+\.cube_id$/);
		}
	});

	it('never overwrites a solve that already has a cube', () => {
		const solveUpdates = CODE.split(/\bUPDATE\s+solve\b/i).slice(1);
		expect(solveUpdates).toHaveLength(2);
		for (const statement of solveUpdates) {
			const body = statement.split('RETURNING')[0];
			expect(body).toMatch(/\bt\.cube_id IS NULL\b/);
			expect(body).toMatch(/\bs\.trainer_name IS NULL\b/);
		}
	});

	it('keeps steps idempotent (ON CONFLICT on both inserts, legacy ids only when missing)', () => {
		expect(CODE).toMatch(/INSERT INTO cube \([\s\S]*?ON CONFLICT DO NOTHING/);
		expect(CODE).toMatch(/INSERT INTO cube_main [\s\S]*?ON CONFLICT \(user_id, puzzle\) DO NOTHING/);
		expect(CODE).toMatch(/NOT \(c\.legacy_smart_device_ids @> w\.ids\)/);
	});

	it('lets the owner skip the orphan step (Q3) with -v skip_orphans', () => {
		expect(SQL).toMatch(/^\\if :\{\?skip_orphans\}$/m);
	});
});
