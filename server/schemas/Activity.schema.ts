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
