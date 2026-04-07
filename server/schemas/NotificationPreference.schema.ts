import {Field, ObjectType} from 'type-graphql';

@ObjectType()
export class NotificationPreference {
	@Field()
	id: string;

	@Field()
	user_id: string;

	@Field()
	marketing_emails: boolean;

	@Field()
	created_at: Date;
}
