// Puzzle key: the physical puzzle a cube is, as opposed to the timer's
// (cube_type, scramble_subset) bucket. A 3x3 cube is offered, stamped and counted in
// every 3x3 bucket (`wca::333`, `333`, `333cfop::pll`, `333roux`, ...) and in no other.
//
// Shared by the client (solve stamp, cube picker, cube filter) and the server (Cube.puzzle
// validation, solve/cube consistency, migration checks). Keep it import free.

/** Built-in puzzle keys, in the order the My Cubes page lists them. Custom cube types add their own ids. */
export const PUZZLE_KEYS = ['333', '222', '444', '555', '666', '777', 'clock', 'minx', 'pyram', 'skewb', 'sq1', 'fto'] as const;

export type BuiltinPuzzleKey = (typeof PUZZLE_KEYS)[number];

const PUZZLE_KEY_SET: ReadonlySet<string> = new Set(PUZZLE_KEYS);

/**
 * Timer cube types (client/util/cubes/cube_types.ts) that are not a puzzle key themselves.
 * Every subset of these types is the same physical puzzle. A test walks CUBE_TYPES, so a new
 * built-in type that is missing here (and is not a puzzle key) fails it.
 */
const CUBE_TYPE_PUZZLE: Readonly<Record<string, BuiltinPuzzleKey>> = {
	'333cfop': '333',
	'333roux': '333',
	'333mehta': '333',
	'444yau': '444',
	// Retired types that unmigrated local rows or old imports can still carry
	// (client/db/solves/migrate_wca_subset.ts phases 3 and 4).
	'333sub': '333',
	'333zz': '333',
};

/**
 * WCA event variants that are not their own physical puzzle. `wca` buckets only offer the
 * 11 puzzle ids today; these cover older rows and imports that kept the event id.
 */
const WCA_EVENT_PUZZLE: Readonly<Record<string, BuiltinPuzzleKey>> = {
	'333oh': '333',
	'333bf': '333',
	'333ft': '333',
	'333fm': '333',
	'333mbf': '333',
	'333mbld': '333',
	'444bf': '444',
	'555bf': '555',
};

/** Timer types with no physical puzzle behind them. */
const NO_PUZZLE_CUBE_TYPES: ReadonlySet<string> = new Set(['other', 'none']);

export function isBuiltinPuzzleKey(key: string | null | undefined): key is BuiltinPuzzleKey {
	return !!key && PUZZLE_KEY_SET.has(key);
}

/**
 * Physical puzzle of a timer bucket. Custom cube types are their own puzzle.
 * null means no physical puzzle (`other`, an empty type, or a `wca` bucket without an event).
 *
 *   wca + '333'                               -> '333'  (wca + any WCA event -> its puzzle)
 *   '333', '333cfop', '333roux', '333mehta'   -> '333'  (any subset)
 *   '444yau'                                  -> '444'
 *   '222', '444', ..., 'fto'                  -> itself
 *   custom type id (uuid)                     -> itself (callers validate it where it matters)
 *   'other', null, ''                         -> null
 */
export function puzzleOfBucket(cubeType: string | null | undefined, subset?: string | null): string | null {
	if (!cubeType || NO_PUZZLE_CUBE_TYPES.has(cubeType)) return null;

	if (cubeType === 'wca') {
		if (!subset) return null;
		if (PUZZLE_KEY_SET.has(subset)) return subset;
		return WCA_EVENT_PUZZLE[subset] ?? null;
	}

	if (PUZZLE_KEY_SET.has(cubeType)) return cubeType;
	const mapped = CUBE_TYPE_PUZZLE[cubeType];
	if (mapped) return mapped;

	// Anything else is a user's custom cube type id: its own puzzle.
	return cubeType;
}

/**
 * A key a Cube may be created with: a built-in puzzle key, or one of the caller's custom
 * cube type ids. Timer-only types (`wca`, `333cfop`, `other`, ...) are never a puzzle key.
 */
export function isValidPuzzleKey(key: string | null | undefined, customTypeIds?: ReadonlySet<string>): boolean {
	if (!key) return false;
	if (PUZZLE_KEY_SET.has(key)) return true;
	return !!customTypeIds && customTypeIds.has(key);
}
