/**
 * The small caption above a stats block value ("Session ao5", "Best single").
 *
 * It used to be glued together from English shorthand ("ses. ao5 pb", "avg", "worst"),
 * which no translation could reach. Each combination is now one whole i18n key, so every
 * language can order the words its own way. The value itself is unchanged.
 */

import {getBlockCount, getBlockKind, getBlockValue} from './block_options';

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

/** Every caption kind; each also exists with a session_ prefix. */
export const STAT_LABEL_KINDS = [
	'best_single',
	'worst_single',
	'current_avg',
	'best_avg',
	'worst_avg',
	'bpa_avg',
	'wpa_avg',
	'target_avg',
	'current_mo',
	'best_mo',
	'worst_mo',
	'bpa_mo',
	'target_mo',
	'mean',
	'stdev_avg',
	'stdev',
	'count',
];

export function getStatLabel(options: StatLabelInput): StatLabel {
	const block = options as any;
	const prefix = options.session ? 'session_' : '';
	const kind = getBlockKind(block);
	const value = getBlockValue(block);
	const n = getBlockCount(block);

	let name: string;
	switch (kind) {
		case 'single':
			name = `${value}_single`;
			break;
		case 'ao':
			name = `${value}_avg`;
			break;
		case 'mo':
			name = `${value}_mo`;
			break;
		case 'stdev':
			name = n ? 'stdev_avg' : 'stdev';
			break;
		default:
			name = kind;
	}

	return {
		key: `timer_modules.stat_label.${prefix}${name}`,
		params: n ? { n } : {},
	};
}
