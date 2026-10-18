/**
 * The small caption above a stats block value ("Session ao5", "Best single").
 *
 * It used to be glued together from English shorthand ("ses. ao5 pb", "avg", "worst"),
 * which no translation could reach. Each combination is now one whole i18n key, so every
 * language can order the words its own way. The value itself is unchanged.
 */

export interface StatLabelInput {
	statType?: string;
	averageCount?: number;
	sortBy?: string;
	session?: boolean;
}

export interface StatLabel {
	/** Full i18n key under timer_modules.stat_label. */
	key: string;
	/** Interpolation values (the N of aoN). */
	params: { n?: number };
}

export function getStatLabel(options: StatLabelInput): StatLabel {
	const prefix = options.session ? 'session_' : '';
	const n = options.averageCount && options.averageCount > 0 ? options.averageCount : 0;

	let kind: string;
	if (options.statType === 'average') {
		if (!n) kind = 'mean';
		// Only "best" changes what an average block computes; anything else is the
		// current one (getStatsBlockValueFromFilter), so the caption says that too.
		else if (options.sortBy === 'best') kind = 'best_avg';
		else kind = 'current_avg';
	} else {
		// A single is either the best one or the worst one (see getStatsBlockValueFromFilter).
		kind = options.sortBy === 'worst' ? 'worst_single' : 'best_single';
	}

	return {
		key: `timer_modules.stat_label.${prefix}${kind}`,
		params: n ? { n } : {},
	};
}
