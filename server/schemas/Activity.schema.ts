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
