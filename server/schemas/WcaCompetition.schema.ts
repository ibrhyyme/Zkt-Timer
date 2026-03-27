import {ObjectType, Field, InputType, Float, Int} from 'type-graphql';

@ObjectType()
export class WcaCompetition {
	@Field()
	id: string;

	@Field()
	name: string;

	@Field()
	city: string;

	@Field()
	country_iso2: string;

	@Field()
	venue: string;

	@Field()
	start_date: string;

	@Field()
	end_date: string;

	@Field()
	date_range: string;

	@Field(() => [String])
	event_ids: string[];

	@Field(() => Float)
	latitude_degrees: number;

	@Field(() => Float)
	longitude_degrees: number;

	@Field()
	url: string;

	@Field(() => Int, {nullable: true})
	competitor_limit?: number;
}

@InputType()
export class WcaCompetitionFilterInput {
	@Field({nullable: true})
	country_iso2?: string;
}
