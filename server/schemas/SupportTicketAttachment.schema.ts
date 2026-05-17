import {Field, Int, ObjectType} from 'type-graphql';

@ObjectType()
export class SupportTicketAttachment {
	@Field()
	id: string;

	@Field()
	message_id: string;

	@Field()
	storage_path: string;

	@Field()
	mime_type: string;

	@Field()
	kind: string;

	@Field(() => Int)
	size_bytes: number;

	@Field({nullable: true})
	original_name?: string;

	@Field()
	created_at: Date;
}
