import {Field, InputType, Int} from 'type-graphql';

// Inputs of the online score entry relay (ZktJudge.resolver.ts). The answers are
// the federation site's own JSON, passed through as the JSON scalar: the site
// owns that contract, and mirroring it type by type here would only add a place
// where the two can drift. The client reads them through shared/zkt_judge.ts.

@InputType()
export class ZktJudgeRequestInput {
	/** `zkt-<slug>`. Needed for a JUDGE request; a correction or extra names its card instead. */
	@Field({nullable: true})
	competitionId?: string;

	/** JUDGE (default), CORRECT or EXTRA. */
	@Field({nullable: true})
	purpose?: string;

	@Field({nullable: true})
	groupId?: string;

	@Field({nullable: true})
	competitorKey?: string;

	@Field(() => Int, {nullable: true})
	stationNumber?: number;

	/** Who judges: self (default), competitor (with judgeKey) or external (with judgeName). */
	@Field({nullable: true})
	judgeKind?: string;

	@Field({nullable: true})
	judgeKey?: string;

	@Field({nullable: true})
	judgeName?: string;

	@Field({nullable: true})
	cardId?: string;

	@Field(() => Int, {nullable: true})
	attemptNo?: number;
}

@InputType()
export class ZktJudgeEntryInput {
	@Field()
	submissionId: string;

	@Field()
	cardId: string;

	/** ATTEMPT (default) or NO_SHOW. */
	@Field({nullable: true})
	kind?: string;

	@Field(() => Int, {nullable: true})
	attemptNo?: number;

	/** WCA encoding: centiseconds, -1 DNF, -2 DNS. */
	@Field(() => Int, {nullable: true})
	value?: number;

	@Field(() => Int, {nullable: true})
	rawValue?: number;

	@Field(() => Int, {nullable: true})
	penalty?: number;

	/** CORRECT or EXTRA when the time uses an approved permit. */
	@Field({nullable: true})
	permit?: string;

	@Field(() => Int, {nullable: true})
	deviceSeq?: number;
}
