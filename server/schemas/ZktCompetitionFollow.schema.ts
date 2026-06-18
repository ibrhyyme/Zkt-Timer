import {ObjectType, Field, InputType} from 'type-graphql';

// A Pro user's subscription to a single competitor (account user OR ghost
// person) in one ZKT competition. followed_user_id / followed_person_id are
// mutually exclusive (XOR), mirroring the registration/result/assignment shape.
@ObjectType()
export class ZktCompetitionFollow {
	@Field()
	id: string;

	@Field()
	competition_id: string;

	@Field({nullable: true})
	followed_user_id?: string;

	@Field({nullable: true})
	followed_person_id?: string;

	@Field()
	followed_name: string;

	@Field()
	created_at: Date;
}

@InputType()
export class FollowZktCompetitorInput {
	@Field()
	competition_id: string;

	@Field({nullable: true})
	followed_user_id?: string;

	@Field({nullable: true})
	followed_person_id?: string;

	@Field()
	name: string;
}
