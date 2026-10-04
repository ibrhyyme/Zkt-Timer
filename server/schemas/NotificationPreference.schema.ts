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
	support_ticket_reply: boolean;

	// Push opt-outs for competition lifecycle notifications.
	@Field()
	zkt_competition_announced: boolean;

	@Field()
	competition_groups_published: boolean;

	@Field()
	competition_schedule_changed: boolean;

	@Field()
	competition_results_official: boolean;

	@Field()
	created_at: Date;
}
