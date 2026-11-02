import {Field, Int, ObjectType} from 'type-graphql';

// A member's result-by-result ZKT history, mirroring the federation's
// GET /api/public/v1/persons/:zktId/results/ field-for-field so the resolver can
// return the payload verbatim. Unlike the round-results surface, values here
// arrive already formatted by the federation (it owns FMC/MBLD/Ao12 rules for
// its own results), the same convention as the person summary's PBs.

@ObjectType()
export class ZktPersonSolve {
	@Field()
	text: string;

	/** Dropped from the average; rendered in parentheses. */
	@Field()
	trimmed: boolean;
}

/** One chance of a Çift Şans round; both are kept so no solve disappears. */
@ObjectType()
export class ZktPersonChance {
	@Field(() => Int)
	chance: number;

	@Field({nullable: true})
	single?: string;

	@Field({nullable: true})
	average?: string;

	@Field(() => [ZktPersonSolve])
	solves: ZktPersonSolve[];

	/** The chance the round result is built from. */
	@Field()
	counting: boolean;

	@Field()
	noShow: boolean;
}

@ObjectType()
export class ZktPersonResultRow {
	@Field()
	competitionId: string;

	@Field()
	competitionName: string;

	@Field({nullable: true})
	competitionSlug?: string;

	/** ISO date (YYYY-MM-DD) of the competition start. */
	@Field()
	date: string;

	/** Federation's Turkish label; carries a " · <day>" suffix on the rare row it disambiguates. */
	@Field()
	roundLabel: string;

	@Field(() => Int)
	roundNumber: number;

	@Field()
	isFinal: boolean;

	@Field(() => Int, {nullable: true})
	ranking?: number;

	@Field({nullable: true})
	single?: string;

	@Field({nullable: true})
	average?: string;

	@Field({nullable: true})
	singleTag?: string;

	@Field({nullable: true})
	averageTag?: string;

	/** Ao12 rounds only: the best floating Ao5, what counts towards PBs. */
	@Field({nullable: true})
	bestAo5?: string;

	@Field(() => [ZktPersonChance], {nullable: true})
	chances?: ZktPersonChance[];

	@Field(() => [ZktPersonSolve])
	solves: ZktPersonSolve[];

	/** 1/2/3 on a chain final only. */
	@Field(() => Int, {nullable: true})
	podium?: number;
}

@ObjectType()
export class ZktPersonEventResults {
	@Field()
	eventId: string;

	@Field(() => [ZktPersonResultRow])
	rows: ZktPersonResultRow[];
}

@ObjectType()
export class ZktPersonResultTotals {
	@Field(() => Int)
	completedSolves: number;

	@Field(() => Int)
	roundCount: number;
}

@ObjectType()
export class ZktPersonResults {
	@Field(() => [ZktPersonEventResults])
	events: ZktPersonEventResults[];

	@Field(() => ZktPersonResultTotals)
	totals: ZktPersonResultTotals;
}
