import {Field, ObjectType, InputType} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';
import {SupportTicketMessage} from './SupportTicketMessage.schema';

@ObjectType()
export class SupportTicket {
	@Field()
	id: string;

	@Field()
	created_at: Date;

	@Field()
	subject: string;

	@Field()
	message: string;

	@Field({nullable: true})
	resolved_at?: Date;

	@Field()
	created_by_id: string;

	@Field(() => PublicUserAccount, {nullable: true})
	created_by?: PublicUserAccount;

	@Field(() => [SupportTicketMessage], {nullable: true})
	messages?: SupportTicketMessage[];
}

@InputType()
export class SupportTicketInput {
	@Field()
	subject: string;

	@Field()
	message: string;
}
