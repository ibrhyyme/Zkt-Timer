import {Field, ObjectType} from 'type-graphql';

@ObjectType()
export class Stats {
	@Field()
	profile_views: number;

	@Field()
	solve_views: number;
}
