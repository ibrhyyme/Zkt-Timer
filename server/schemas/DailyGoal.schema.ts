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

	// Whether warm-up mode solves count toward daily goals + activity.
	@Field({ nullable: true })
	count_warmup_solves?: boolean;
}

/** A warm-up mode solve as the daily goal counts it: no time, no scramble. */
@InputType()
export class WarmupSolveInput {
	// The client's solve uuid: a retried upload of the same solve is skipped, not doubled.
	@Field()
	id: string;

	@Field()
	cube_type: string;

	@Field({ nullable: true })
	scramble_subset?: string;

	// Epoch milliseconds, like Solve.started_at.
	@Field(() => Float)
	started_at: number;
}

@ObjectType()
export class WarmupSolveEntry {
	@Field()
	id: string;

	@Field()
	cube_type: string;

	@Field({ nullable: true })
	scramble_subset?: string;

	// Epoch milliseconds. Raw so the client buckets by day in its own timezone.
	@Field(() => Float)
	started_at: number;
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
