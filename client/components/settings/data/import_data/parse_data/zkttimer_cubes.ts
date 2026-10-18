import { isValidPuzzleKey, puzzleOfBucket } from '../../../../../../shared/cube_puzzle';

/**
 * Cubes in a Zkt Timer export file (design .feedback/designs/magnet-cubes.md, section 4.6).
 *
 * Export writes the account's cubes next to the solves; every solve already carries its cube_id.
 * Import maps each file cube onto the target account: the same cube id (a backup restored to the
 * same account), else the same puzzle and name, else a new cube is created. Solves then carry the
 * target account's id, or null when their cube could not be mapped.
 *
 * Pure: no network, no storage. ReviewImport.tsx runs the plan (it needs a fresh cube list and
 * the createCube mutation).
 */

/** One cube as it is written to an export file. */
export interface ExportedCube {
	id: string;
	puzzle: string;
	name: string;
	brand: string | null;
	is_smart: boolean;
	/** Archived in the exporting account. Not in the design's field list; optional on read. */
	archived?: boolean;
}

/** Same bounds as server/util/cube_validation.ts (CUBE_NAME_MAX, CUBE_BRAND_MAX). */
const NAME_MAX = 40;
const BRAND_MAX = 30;
/** A file can never hold more cubes than an account may own (MAX_CUBES_PER_USER). */
const FILE_CUBES_MAX = 300;

interface CubeLike {
	id: string;
	puzzle: string;
	name: string;
	brand?: string | null;
	is_smart?: boolean;
	archived_at?: number | null;
}

function cleanText(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Match key of a cube: puzzle plus its name, case and spacing ignored. */
function nameKey(puzzle: string, name: string): string {
	// Plain toLowerCase on purpose: a Turkish locale fold turns 'I' into a dotless 'ı'.
	return `${puzzle}\u0000${cleanText(name, NAME_MAX).toLowerCase()}`;
}

/** The cube list written to an export file. */
export function exportCubeList(cubes: ReadonlyArray<CubeLike>): ExportedCube[] {
	return cubes.map((cube) => {
		const out: ExportedCube = {
			id: cube.id,
			puzzle: cube.puzzle,
			name: cube.name,
			brand: cube.brand || null,
			is_smart: !!cube.is_smart,
		};
		if (cube.archived_at) out.archived = true;
		return out;
	});
}

/**
 * The `cubes` array of an import file, checked field by field. Anything malformed is dropped,
 * never thrown on: a broken cube list must not stop the solves from importing.
 */
export function readExportedCubes(raw: unknown): ExportedCube[] {
	if (!Array.isArray(raw)) return [];
	const out: ExportedCube[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		if (out.length >= FILE_CUBES_MAX) break;
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const id = typeof row.id === 'string' ? row.id.trim() : '';
		const puzzle = typeof row.puzzle === 'string' ? row.puzzle.trim() : '';
		const name = cleanText(row.name, NAME_MAX);
		if (!id || !puzzle || !name || seen.has(id)) continue;
		seen.add(id);
		const brand = cleanText(row.brand, BRAND_MAX);
		const cube: ExportedCube = { id, puzzle, name, brand: brand || null, is_smart: row.is_smart === true };
		if (row.archived === true) cube.archived = true;
		out.push(cube);
	}
	return out;
}

interface SolveLike {
	cube_id?: string | null;
	cube_type?: string | null;
	scramble_subset?: string | null;
	trainer_name?: string | null;
}

/** Physical puzzle a solve can be linked to, or null (trainer solves and 'other' never link). */
function solvePuzzle(solve: SolveLike): string | null {
	if (solve.trainer_name) return null;
	return puzzleOfBucket(solve.cube_type, solve.scramble_subset);
}

/** A cube the import creates. Every file cube in `fileIds` maps onto it. */
export interface CubeToCreate {
	puzzle: string;
	name: string;
	brand: string | null;
	is_smart: boolean;
	/** Archive it right after creating it (archived in the file and only kept for its solves). */
	archive: boolean;
	fileIds: string[];
}

export interface CubeImportPlan {
	/** File cube id to an existing cube of the target account. */
	matched: Record<string, string>;
	toCreate: CubeToCreate[];
	/** File cubes left out: unknown puzzle in this account, or archived with no solve to carry. */
	skipped: number;
}

/**
 * Which file cubes map onto existing cubes and which are created.
 *
 * - Same id and puzzle in the target account: that cube (a backup restored to its own account,
 *   even after a rename).
 * - Else the same puzzle and name (case and spacing ignored), active cubes first.
 * - Else a new cube. Two file cubes with the same puzzle and name become one.
 * - The puzzle must be valid in this account (a built-in key or one of its custom types).
 * - An archived file cube is only brought back when an importable solve uses it, and then archived.
 */
export function planCubeImport(
	fileCubes: ReadonlyArray<ExportedCube>,
	solves: ReadonlyArray<SolveLike>,
	targetCubes: ReadonlyArray<CubeLike>,
	customTypeIds?: ReadonlySet<string>
): CubeImportPlan {
	const plan: CubeImportPlan = { matched: {}, toCreate: [], skipped: 0 };
	if (!fileCubes.length) return plan;

	const fileById = new Map(fileCubes.map((c) => [c.id, c]));
	const used = new Set<string>();
	for (const solve of solves) {
		const id = solve.cube_id;
		if (!id) continue;
		const cube = fileById.get(id);
		if (cube && solvePuzzle(solve) === cube.puzzle) used.add(id);
	}

	const targetById = new Map(targetCubes.map((c) => [c.id, c]));
	const targetByName = new Map<string, CubeLike>();
	// Active cubes win a name clash, so the archived twin is only used when it is the only one.
	const ordered = [...targetCubes].sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at));
	for (const cube of ordered) {
		const key = nameKey(cube.puzzle, cube.name);
		if (!targetByName.has(key)) targetByName.set(key, cube);
	}

	const created = new Map<string, CubeToCreate>();

	for (const cube of fileCubes) {
		const sameId = targetById.get(cube.id);
		if (sameId && sameId.puzzle === cube.puzzle) {
			plan.matched[cube.id] = sameId.id;
			continue;
		}
		if (!isValidPuzzleKey(cube.puzzle, customTypeIds)) {
			plan.skipped++;
			continue;
		}
		const key = nameKey(cube.puzzle, cube.name);
		const sameName = targetByName.get(key);
		if (sameName) {
			plan.matched[cube.id] = sameName.id;
			continue;
		}
		if (cube.archived && !used.has(cube.id)) {
			plan.skipped++;
			continue;
		}
		const pending = created.get(key);
		if (pending) {
			pending.fileIds.push(cube.id);
			// Active wins: one active twin keeps the new cube out of the archive.
			if (!cube.archived) pending.archive = false;
			continue;
		}
		const entry: CubeToCreate = {
			puzzle: cube.puzzle,
			name: cube.name,
			brand: cube.brand,
			is_smart: cube.is_smart,
			archive: !!cube.archived,
			fileIds: [cube.id],
		};
		created.set(key, entry);
		plan.toCreate.push(entry);
	}

	return plan;
}

/**
 * Solves with the file's cube ids replaced by the target account's. A solve keeps a cube only
 * when its id maps and the cube is the solve's puzzle; everything else is null. Returns new
 * objects, the input list is left as it was (retries and the review screen keep using it).
 */
export function linkSolvesToCubes<T extends SolveLike>(
	solves: ReadonlyArray<T>,
	idMap: Readonly<Record<string, { id: string; puzzle: string }>>
): T[] {
	return solves.map((solve) => {
		const target = solve.cube_id ? idMap[solve.cube_id] : undefined;
		const cubeId = target && solvePuzzle(solve) === target.puzzle ? target.id : null;
		return { ...solve, cube_id: cubeId };
	});
}
