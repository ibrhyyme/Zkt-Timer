import { Field, Float, Int, ObjectType } from 'type-graphql';

/**
 * Per-case istatistikleri — kullanicinin OLL/PLL case bazinda performans verisi.
 *
 * Veri kaynagi: solve_method_step tablosundaki step_name='oll'/'pll' kayitlari
 * group by oll_case_key veya pll_case_key. Wrapper (server/util/solve/solve_method.ts)
 * her smart cube solve sonrasi bu alanlari otomatik dolduruyor.
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
