import {ObjectType, Field, InputType} from 'type-graphql';

@ObjectType()
export class RecordWatch {
	@Field()
	id: string;

	@Field(() => [String])
	events: string[];

	@Field()
	scope: string;

	@Field()
	region: string;

	@Field()
	enabled: boolean;

	@Field()
	created_at: Date;
}

@InputType()
export class SaveRecordWatchInput {
	@Field(() => [String])
	events: string[];

	@Field()
	scope: string;

	@Field({nullable: true})
	region?: string;
}
