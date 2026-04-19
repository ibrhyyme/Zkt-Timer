import {StatsModule, StatsModuleBlock} from '../../server/schemas/StatsModule.schema';

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

export const defaultStatsModuleBlocks = [
	statsModuleBlock('single', 'best', true, 'green', 0), // ses. pb
	statsModuleBlock('average', 'current', true, 'text', 0), // ses. avg
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

		case 'ADD_STATS_MODULE_BLOCK': {
			const {statOptions} = action.payload;

			const blocks = [...state.blocks];
			blocks.push(statOptions);

			return {
				...state,
				blocks,
			};
		}

		case 'REMOVE_STATS_MODULE_BLOCK': {
			const {index} = action.payload;

			const blocks = [...state.blocks];
			blocks.splice(index, 1);

			return {
				...state,
				blocks,
			};
		}

		case 'UPDATE_STATS_MODULE_BLOCK': {
			const {index, statOptions} = action.payload;

			const blocks = [...state.blocks];
			blocks[index] = statOptions;

			return {
				...state,
				blocks,
			};
		}

		case 'RESET_STATS_MODULE_BLOCKS': {
			return {
				...state,
				blocks: [...defaultStatsModuleBlocks],
			};
		}

		default: {
			return {
				...initialState,
				...state,
			};
		}
	}
};
