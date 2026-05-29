import { Field, Float, Int, ObjectType } from 'type-graphql';

/**
 * Per-case statistics — user's OLL/PLL case-based performance data.
 *
 * Data source: step_name='oll'/'pll' records in solve_method_step table
 * grouped by oll_case_key or pll_case_key. Wrapper (server/util/solve/solve_method.ts)
 * automatically populates these fields after each smart cube solve.
 */
@ObjectType()
export class CaseStat {
	@Field()
	caseKey: string;

	@Field()
	caseName: string;

	@Field()
	caseType: string;

	@Field(() => Int)
	count: number;

	@Field(() => Float)
	averageTime: number;

	@Field(() => Float)
	bestTime: number;

	@Field(() => Float)
	avgRecognition: number;

	@Field(() => Float)
	avgExecution: number;

	@Field(() => Float)
	avgTps: number;

	@Field(() => Float)
	avgTurns: number;

	@Field(() => Float, { nullable: true })
	lastSeenAt: number | null;
}
