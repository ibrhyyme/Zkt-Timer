import {Field, InputType, Int, ObjectType} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';

@ObjectType()
export class BanLog {
	@Field()
	id: string;

	@Field()
	created_by_id: string;

	@Field()
	banned_user_id: string;

	@Field()
	reason: string;

	@Field()
	active: boolean;

	@Field()
	banned_until: Date;

	@Field(() => Int)
	minutes: number;

	@Field()
	forever: boolean;

	@Field()
	created_at: Date;

	// Public shape on purpose: BanLog hangs off UserAccount.bans, so an admin type here
	// would put email and join_ip one relation away from any path that loads bans.
	// The admin panel only reads id and username.
	@Field(() => PublicUserAccount)
	created_by?: PublicUserAccount;

	@Field(() => PublicUserAccount)
	banned_user?: PublicUserAccount;
}

@InputType()
export class BanUserInput {
	@Field()
	user_id: string;

	@Field()
	reason: string;

	// Set to -1 for forever
	@Field(() => Int)
	minutes: number;

	@Field()
	delete_published_solves: boolean;
}
