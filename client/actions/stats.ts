import {StatsModule} from '../../server/schemas/StatsModule.schema';

export function initStatsModuleStore(statsModule: StatsModule) {
	return {
		type: 'INIT_STATS_MODULE',
		payload: statsModule,
	};
}
