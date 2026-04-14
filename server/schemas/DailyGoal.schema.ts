import { ObjectType, Field, InputType, Int } from 'type-graphql';

@ObjectType()
export class DailyGoalType {
	@Field()
	id: string;

	@Field()
	cube_type: string;

	@Field({ nullable: true })
	scramble_subset?: string;

	@Field(() => Int)
	target: number;

	@Field()
	enabled: boolean;
}

@InputType()
export class SetDailyGoalInput {
	@Field()
	cube_type: string;

	@Field({ nullable: true })
	scramble_subset?: string;

	@Field(() => Int)
	target: number;

	@Field({ nullable: true })
	enabled?: boolean;
}

@ObjectType()
export class DailyGoalReminderResult {
	@Field()
	enabled: boolean;
}
