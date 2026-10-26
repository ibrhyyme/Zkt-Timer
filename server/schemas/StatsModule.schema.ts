import {Field, InputType, Int, ObjectType} from 'type-graphql';
import {ColorName} from '../../shared/colors';
import {Max, Min} from 'class-validator';

/**
 * single: a solve. average: an average of N (5% trimmed each end). mean: a mean of N, or with
 * N = 0 the whole scope's mean without DNFs. stdev: σ over an aoN window, or every solve with
 * N = 0. count: the scope's solves. Stored as plain strings, so new values need no schema change.
 */
export type StatsBlockStatType = 'single' | 'average' | 'mean' | 'stdev' | 'count';

/** bpa / wpa / target: the next solve's best and worst possible average and the time to beat for a new best. */
export type StatsBlockSortBy = 'best' | 'worst' | 'current' | 'bpa' | 'wpa' | 'target';

@ObjectType()
export class StatsModule {
	@Field(() => [StatsModuleBlock])
	blocks: StatsModuleBlock[];
}

@ObjectType()
export class StatsModuleBlock {
	@Field(() => String)
	statType: StatsBlockStatType;

	@Field(() => String)
	sortBy: StatsBlockSortBy;

	@Field()
	session: boolean;

	@Field(() => String)
	colorName: ColorName;

	@Field(() => Int)
	@Min(0)
	@Max(10000)
	averageCount: number;
}

@InputType()
export class StatsModuleBlockInput extends StatsModuleBlock {
	@Field(() => String)
	statType: StatsBlockStatType;

	@Field(() => String)
	sortBy: StatsBlockSortBy;

	@Field()
	session: boolean;

	@Field(() => String)
	colorName: ColorName;

	@Field(() => Int)
	@Min(0)
	@Max(10000)
	averageCount: number;
}
