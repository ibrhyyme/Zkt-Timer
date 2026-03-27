import {Field, ObjectType} from 'type-graphql';

@ObjectType()
export class Stats {
	@Field()
	friend_count: number;

	@Field()
	profile_views: number;

	@Field()
	solve_views: number;
}
