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
