import {Field, ObjectType} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';

@ObjectType()
export class SupportTicketMessage {
	@Field()
	id: string;

	@Field()
	ticket_id: string;

	@Field()
	sender_id: string;

	@Field()
	body: string;

	@Field()
	is_admin: boolean;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount, {nullable: true})
	sender?: PublicUserAccount;
}
