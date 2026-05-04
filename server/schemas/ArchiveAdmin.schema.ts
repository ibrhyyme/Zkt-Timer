import {ObjectType, Field, Int} from 'type-graphql';

@ObjectType()
export class BulkArchiveResult {
	@Field(() => Int)
	total: number;

	@Field(() => Int)
	imported: number;

	@Field(() => Int)
	skipped: number;

	@Field(() => Int)
	failed: number;

	@Field({nullable: true})
	lastProcessedId?: string;

	@Field(() => [String])
	failedIds: string[];
}
