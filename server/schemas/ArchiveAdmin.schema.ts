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

@ObjectType()
export class ReindexESResult {
	@Field(() => Int)
	total: number;

	@Field(() => Int)
	indexed: number;

	@Field(() => Int)
	failed: number;
}

@ObjectType()
export class ReindexLLResult {
	@Field(() => Int)
	total: number;

	@Field(() => Int)
	scanned: number;

	@Field(() => Int)
	ollUpdated: number;

	@Field(() => Int)
	pllUpdated: number;

	@Field(() => Int)
	failed: number;
}
