import { cubeById, cubesForPuzzle, CubeState, LocalCube, mainCubeFor, puzzlesWithCubes } from '../../../lib/cubes/active_cube';
import { filterCubes } from '../../settings/cubes/cube_labels';

/**
 * The Cube filter of the Solves and Stats pages (design .feedback/designs/magnet-cubes.md 8.2).
 * Pure: no React, no storage. The pages hold the chosen id; these rules decide what the picker
 * offers and whether a chosen id still applies.
 */

/** A search box appears above the list once it offers more cubes than this (S-3, "15 tane 3x3"). */
export const CUBE_FILTER_SEARCH_THRESHOLD = 10;

export interface CubeFilterChoice {
	id: string;
	name: string;
	brand: string | null;
	puzzle: string;
	isMain: boolean;
	archived: boolean;
}

export interface CubeFilterGroup {
	/** Stable key: the puzzle key, or 'archived' for the closing archive group. */
	key: string;
	/** Group title. null: a single-puzzle list, no title needed. */
	header: string | null;
	archived: boolean;
	choices: CubeFilterChoice[];
}

export interface CubeFilterGroupOptions {
	/** Physical puzzle of the selected cube type (puzzleOfBucket). Ignored in all mode. */
	puzzle: string | null | undefined;
	/** "Tümü": no cube type picked, every puzzle is offered under its own header. */
	allMode: boolean;
	/** Whether this device holds solves of the cube. Archived cubes are offered only then. */
	hasLocalSolves: (cubeId: string) => boolean;
	/** Display name of a puzzle key (group headers in all mode). */
	puzzleLabel: (puzzle: string) => string;
	/** Puzzle section order (My Cubes order). */
	orderPuzzles: (keys: string[]) => string[];
	/** Header of the closing archive group, given how many cubes it holds. */
	archivedHeader: (count: number) => string;
}

type State = Pick<CubeState, 'cubes' | 'mains'>;

function toChoice(cube: LocalCube, mainId: string | null): CubeFilterChoice {
	return {
		id: cube.id,
		name: cube.name,
		brand: cube.brand,
		puzzle: cube.puzzle,
		isMain: cube.id === mainId,
		archived: !!cube.archived_at,
	};
}

/**
 * What the picker lists (8.2): with a cube type picked only the cubes of its puzzle (a 3x3 cube
 * never shows under 7x7), in "Tümü" every puzzle under its own header. Order as on My Cubes: main
 * first, then last used, then name. Archived cubes close the list, and only when this device
 * holds solves made with them (otherwise picking one shows nothing).
 */
export function cubeFilterGroups(state: State, options: CubeFilterGroupOptions): CubeFilterGroup[] {
	const { allMode, hasLocalSolves } = options;
	const puzzles = allMode
		? options.orderPuzzles(puzzlesWithCubes(state, { includeArchived: true }))
		: options.puzzle
			? [options.puzzle]
			: [];

	const groups: CubeFilterGroup[] = [];
	const archived: CubeFilterChoice[] = [];

	for (const puzzle of puzzles) {
		const mainId = mainCubeFor(puzzle, state)?.id ?? null;
		const active = cubesForPuzzle(puzzle, state).map((cube) => toChoice(cube, mainId));
		if (active.length) {
			groups.push({
				key: puzzle,
				header: allMode ? options.puzzleLabel(puzzle) : null,
				archived: false,
				choices: active,
			});
		}

		for (const cube of cubesForPuzzle(puzzle, state, 'default', { includeArchived: true })) {
			if (cube.archived_at && hasLocalSolves(cube.id)) archived.push(toChoice(cube, null));
		}
	}

	if (archived.length) {
		groups.push({
			key: 'archived',
			header: options.archivedHeader(archived.length),
			archived: true,
			choices: archived,
		});
	}

	return groups;
}

export function countCubeFilterChoices(groups: ReadonlyArray<CubeFilterGroup>): number {
	return groups.reduce((sum, group) => sum + group.choices.length, 0);
}

/** Groups narrowed to the cubes whose name or brand matches the search (empty groups dropped). */
export function searchCubeFilterGroups(groups: ReadonlyArray<CubeFilterGroup>, query: string): CubeFilterGroup[] {
	if (!query || !query.trim()) return [...groups];
	const out: CubeFilterGroup[] = [];
	for (const group of groups) {
		const choices = filterCubes(group.choices, query);
		if (choices.length) out.push({ ...group, choices });
	}
	return out;
}

/**
 * The cube a chosen id stands for, or null when the filter does not apply: an unknown or
 * deleted id (a stale link) is ignored silently, and with a cube type picked the cube has to
 * belong to its puzzle. In "Tümü" any of the person's cubes applies (all its buckets together,
 * the same set its profile counts, K-3).
 */
export function resolveCubeFilter(
	state: Pick<CubeState, 'cubes'>,
	id: string | null | undefined,
	puzzle: string | null | undefined,
	allMode: boolean
): LocalCube | null {
	const cube = cubeById(state, id);
	if (!cube) return null;
	if (allMode) return cube;
	return puzzle && cube.puzzle === puzzle ? cube : null;
}

/** Whether a chosen cube still fits after the cube type changes to `nextPuzzle` (null: "Tümü"). */
export function cubeFitsPuzzle(cube: Pick<LocalCube, 'puzzle'> | null | undefined, nextPuzzle: string | null, nextAllMode: boolean): boolean {
	if (!cube) return false;
	if (nextAllMode) return true;
	return !!nextPuzzle && cube.puzzle === nextPuzzle;
}
