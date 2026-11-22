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

/** The values each kind offers; the first is the default. */
const KIND_VALUES: Record<StatsBlockKind, StatsBlockSortBy[]> = {
	single: ['best', 'worst'],
	ao: ['current', 'best', 'worst', 'bpa', 'wpa', 'target'],
	// A DNF next solve makes a mean of N a DNF, so its worst possible mean says nothing.
	mo: ['current', 'best', 'worst', 'bpa', 'target'],
	mean: [],
	stdev: [],
	count: [],
};

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
