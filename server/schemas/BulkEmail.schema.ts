import { Field, InputType, Int, ObjectType } from 'type-graphql';

@InputType()
export class SendBulkEmailInput {
	@Field(() => [String])
	userIds: string[];

	@Field()
	sendToAll: boolean;

	@Field()
	subject: string;

	@Field()
	content: string;
}

@ObjectType()
export class BulkEmailResult {
	@Field(() => Int)
	successCount: number;

	@Field(() => Int)
	failCount: number;
}
