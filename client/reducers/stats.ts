import {StatsModule, StatsModuleBlock} from '../../server/schemas/StatsModule.schema';
import {withDefaults} from './with_defaults';

function statsModuleBlock(
	statType: StatsModuleBlock['statType'],
	sortBy: StatsModuleBlock['sortBy'],
	session: StatsModuleBlock['session'],
	colorName: StatsModuleBlock['colorName'],
	averageCount: StatsModuleBlock['averageCount']
): StatsModuleBlock {
	return {
		statType,
		sortBy,
		session,
		colorName,
		averageCount,
	};
}

// The stats blocks the stats module showed before it became a table (2026-11-23). Read
// only now: the table takes its first rows from a user's customized blocks
// (quick_stats/stats_table.ts resolveTableRows), and app builds older than the table still
// read and write them on the server, so the shape stays.
export const defaultStatsModuleBlocks = [
	statsModuleBlock('single', 'best', true, 'green', 0), // ses. pb
	statsModuleBlock('mean', 'current', true, 'text', 0), // ses. mean
	statsModuleBlock('average', 'best', true, 'text', 5), // ses. ao5 pb
	statsModuleBlock('average', 'current', true, 'text', 5), // ses. ao5
	statsModuleBlock('average', 'best', true, 'text', 12), // ses. ao12 pb
	statsModuleBlock('average', 'current', true, 'text', 12), // ses. ao12
	statsModuleBlock('average', 'best', true, 'text', 100), // ses. ao100 pb
	statsModuleBlock('average', 'best', false, 'text', 100), // ao100 pb (all-time)
];

const initialState: StatsModule = {
	blocks: defaultStatsModuleBlocks,
};

export default (state = initialState, action) => {
	switch (action.type) {
		case 'INIT_STATS_MODULE': {
			const payload = action.payload || {};
			return {
				...initialState,
				...payload,
				blocks: payload.blocks || initialState.blocks,
			};
		}

		default: {
			return withDefaults(state, initialState);
		}
	}
};
