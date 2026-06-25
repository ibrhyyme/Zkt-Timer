import { ObjectType, Field, InputType, Int, Float } from 'type-graphql';

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

	// Whether room (Friendly Room) solves count toward daily goals + activity.
	@Field({ nullable: true })
	count_room_solves?: boolean;
}

@ObjectType()
export class RoomSolveEntry {
	// created_at as epoch milliseconds. Returned raw so the client buckets by day
	// in its own timezone — matching how timer solves are grouped (consistency.ts).
	@Field(() => Float)
	created_at: number;

	@Field()
	cube_type: string;
}
