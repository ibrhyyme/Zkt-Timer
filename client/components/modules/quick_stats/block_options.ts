import {StatsModuleBlock, StatsBlockSortBy} from '../../../../server/schemas/StatsModule.schema';

/**
 * What a stats block shows, read from its stored fields.
 *
 * The stored shape predates most of these (statType single/average, sortBy, averageCount),
 * so it is kept and read through here instead of migrated: statType 'mean' with a count is
 * a mean of N, without one the whole scope's mean; 'stdev' and 'count' are new values of the
 * same string field. An 'average' without a count was always captioned a mean, so it is one.
 */
export type StatsBlockKind = 'single' | 'ao' | 'mo' | 'mean' | 'stdev' | 'count';

export const STATS_BLOCK_KINDS: StatsBlockKind[] = ['single', 'ao', 'mo', 'mean', 'stdev', 'count'];

/** The values each kind offers, in the order the editor lists them; the first is the default. */
const KIND_VALUES: Record<StatsBlockKind, StatsBlockSortBy[]> = {
	single: ['best', 'worst'],
	ao: ['current', 'best', 'worst', 'bpa', 'wpa', 'target'],
	// A DNF next solve makes a mean of N a DNF, so its worst possible mean says nothing.
	mo: ['current', 'best', 'worst', 'bpa', 'target'],
	mean: [],
	stdev: [],
	count: [],
};

export const MAX_STATS_BLOCKS = 16;
export const MIN_AVERAGE_COUNT = 3;
export const MAX_AVERAGE_COUNT = 10000;

/** Ready-made counts in the editor. 0 is "every solve", only σ offers it. */
export const COUNT_PRESETS: Partial<Record<StatsBlockKind, number[]>> = {
	ao: [5, 12, 25, 50, 100, 200, 500, 1000],
	mo: [3, 5, 12, 50, 100],
	stdev: [0, 5, 12, 50, 100],
};

const DEFAULT_COUNT: Partial<Record<StatsBlockKind, number>> = {ao: 5, mo: 3, stdev: 12};

function storedCount(block: Pick<StatsModuleBlock, 'averageCount'>): number {
	const n = block?.averageCount;
	return typeof n === 'number' && n > 0 ? n : 0;
}

export function getBlockKind(block: Pick<StatsModuleBlock, 'statType' | 'averageCount'>): StatsBlockKind {
	switch (block?.statType) {
		case 'single':
			return 'single';
		case 'stdev':
			return 'stdev';
		case 'count':
			return 'count';
		case 'mean':
			return storedCount(block) ? 'mo' : 'mean';
		default:
			return storedCount(block) ? 'ao' : 'mean';
	}
}

export function getKindValues(kind: StatsBlockKind): StatsBlockSortBy[] {
	return KIND_VALUES[kind];
}

/** The block's value for its kind; a stored one the kind does not offer falls back to the kind's default. */
export function getBlockValue(block: Pick<StatsModuleBlock, 'statType' | 'averageCount' | 'sortBy'>): StatsBlockSortBy | null {
	const values = KIND_VALUES[getBlockKind(block)];
	if (!values.length) {
		return null;
	}
	return values.includes(block.sortBy) ? block.sortBy : values[0];
}

/** N of an aoN / moN, or of σ over an aoN window. 0 for kinds without one and for σ over every solve. */
export function getBlockCount(block: Pick<StatsModuleBlock, 'statType' | 'averageCount'>): number {
	const kind = getBlockKind(block);
	return kind === 'ao' || kind === 'mo' || kind === 'stdev' ? storedCount(block) : 0;
}

export function kindTakesCount(kind: StatsBlockKind): boolean {
	return !!COUNT_PRESETS[kind];
}

/** A mean of N rather than an average: nothing trimmed. */
export function isMeanKind(kind: StatsBlockKind): boolean {
	return kind === 'mo';
}

/**
 * Whether the solves a block opens are one average's window, whose fastest and slowest
 * the solves list brackets as trimmed. A mean trims nothing, and the next-solve values
 * (BPA, WPA, target) open the count - 1 solves the next window keeps, not a window.
 */
export function blockWindowIsTrimmed(block?: StatsModuleBlock): boolean {
	if (!block) {
		return true;
	}
	const kind = getBlockKind(block);
	if (kind === 'stdev') {
		return true;
	}
	if (kind !== 'ao') {
		return false;
	}
	const value = getBlockValue(block);
	return value === 'current' || value === 'best' || value === 'worst';
}

/** The block switched to another kind, keeping what still applies (scope, colour, N, value). */
export function withBlockKind(block: StatsModuleBlock, kind: StatsBlockKind): StatsModuleBlock {
	const statType: StatsModuleBlock['statType'] =
		kind === 'single' ? 'single' : kind === 'ao' ? 'average' : kind === 'mo' || kind === 'mean' ? 'mean' : kind;

	let averageCount = 0;
	if (kind === 'ao' || kind === 'mo') {
		averageCount = storedCount(block) >= MIN_AVERAGE_COUNT ? storedCount(block) : DEFAULT_COUNT[kind];
	} else if (kind === 'stdev') {
		// σ over every solve (0) is a valid choice, so a count is only carried from an average.
		averageCount = storedCount(block) >= MIN_AVERAGE_COUNT ? storedCount(block) : DEFAULT_COUNT.stdev;
	}

	const values = KIND_VALUES[kind];
	const sortBy = values.length ? (values.includes(block.sortBy) ? block.sortBy : values[0]) : 'current';

	return {...block, statType, averageCount, sortBy};
}

/** A typed count, or null when it is not a whole number in range. */
export function parseAverageCount(input: string): number | null {
	const trimmed = String(input ?? '').trim();
	if (!/^\d+$/.test(trimmed)) {
		return null;
	}
	const n = parseInt(trimmed, 10);
	return n >= MIN_AVERAGE_COUNT && n <= MAX_AVERAGE_COUNT ? n : null;
}

/** Moves one block, for the editor's drag list. */
export function moveBlock<T>(blocks: T[], from: number, to: number): T[] {
	if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) {
		return blocks;
	}
	const next = [...blocks];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}
