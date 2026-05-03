import {ObjectType, Field, Int, InputType} from 'type-graphql';

@ObjectType()
export class CompetitionFollow {
	@Field()
	id: string;

	@Field()
	competition_id: string;

	@Field(() => Int)
	followed_registrant_id: number;

	@Field({nullable: true})
	followed_wca_id?: string;

	@Field()
	followed_name: string;

	@Field()
	created_at: Date;
}

@InputType()
export class FollowCompetitorInput {
	@Field()
	competition_id: string;

	@Field(() => Int)
	registrant_id: number;

	@Field({nullable: true})
	wca_id?: string;

	@Field()
	name: string;
}
