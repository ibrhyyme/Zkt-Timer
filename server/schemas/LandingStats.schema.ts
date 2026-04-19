import {Field, Int, ObjectType} from 'type-graphql';

@ObjectType()
export class LandingStats {
	@Field(() => Int)
	upcoming_wca_competition_count: number;

	@Field(() => Int)
	total_competitor_capacity: number;

	@Field(() => Int)
	supported_event_count: number;

	@Field(() => Int)
	supported_language_count: number;

	@Field(() => Int)
	cuber_count: number;

	@Field(() => Int)
	solve_count: number;
}
