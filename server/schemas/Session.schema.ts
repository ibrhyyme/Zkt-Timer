import {Field, InputType, ObjectType} from 'type-graphql';

@ObjectType()
export class Session {
	@Field()
	id: string;

	@Field()
	name: string;

	@Field()
	user_id: string;

	@Field()
	order: number;

	@Field()
	created_at: Date;
}

@InputType()
export class SessionInput {
	@Field()
	id?: string;

	@Field()
	name: string;

	@Field()
	order: number;
}

// One (cube_type, scramble_subset) bucket for splitSession. A null subset is the cube
// type's default bucket.
@InputType()
export class SessionBucketInput {
	@Field()
	cube_type: string;

	@Field({nullable: true})
	scramble_subset?: string;
}
