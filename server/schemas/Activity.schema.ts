import {ObjectType, Field, Int} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';

@ObjectType()
export class ActiveUserRow {
	@Field(() => PublicUserAccount)
	user: PublicUserAccount;

	@Field(() => Int)
	active_minutes: number;

	@Field({nullable: true})
	last_seen_at?: Date;
}

@ObjectType()
export class ActivityHeartbeatResult {
	@Field()
	success: boolean;
}

@ObjectType()
export class AdminActiveUsersResult {
	@Field(() => [ActiveUserRow])
	rows: ActiveUserRow[];

	@Field(() => Int)
	total_active_users: number;

	@Field(() => Int)
	total_active_minutes: number;

	@Field(() => [String])
	available_months: string[];
}

@ObjectType()
export class UserPageActivityRow {
	// Normalized page category (see shared/util/activity_path.ts)
	@Field()
	path: string;

	@Field(() => Int)
	minutes: number;
}

@ObjectType()
export class UserDailyActivityResult {
	@Field(() => [UserPageActivityRow])
	rows: UserPageActivityRow[];

	@Field(() => Int)
	total_minutes: number;
}
