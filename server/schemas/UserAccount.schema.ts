import { Field, Int, InterfaceType, ObjectType } from 'type-graphql';
import { Profile } from './Profile.schema';
import { Integration } from './Integration.schema';
import { Badge } from './Badge.schema';
import { Setting } from './Setting.schema';
import { Report } from './Report.schema';
import { BanLog } from './BanLog.schema';
import PaginatedResponse from './Pagination.schema';
import { TimerBackground } from './TimerBackground.schema';
import { NotificationPreference } from './NotificationPreference.schema';
import { PushTokenInfo } from './PushToken.schema';
import { TopSolve } from './TopSolve.schema';
import { TopAverage } from './TopAverage.schema';

@InterfaceType()
class IPublicUserAccount {
	@Field()
	id: string;

	@Field()
	admin: boolean;

	@Field()
	mod: boolean;

	@Field()
	created_at: Date;

	@Field()
	username: string;

	@Field()
	verified: boolean;

	@Field()
	is_pro: boolean;

	@Field({nullable: true})
	pro_expires_at?: Date;

	@Field()
	is_premium: boolean;

	@Field({nullable: true})
	premium_expires_at?: Date;

	@Field({ nullable: true })
	last_solve_at?: Date;

	@Field()
	banned_forever: boolean;

	@Field({ nullable: true })
	banned_until?: Date;

	@Field(() => Profile)
	profile?: Profile;

	@Field(() => [Integration])
	integrations?: Integration[];

	@Field(() => [Badge])
	badges?: Badge[];

	@Field(() => [TopSolve])
	top_solves?: TopSolve[];

	@Field(() => [TopAverage])
	top_averages?: TopAverage[];
}

@ObjectType()
export class UserAccountSolvesSummary {
	@Field()
	count: number;

	@Field()
	average: number;

	@Field()
	min_time: number;

	@Field()
	max_time: number;

	@Field()
	sum: number;

	@Field()
	cube_type: string;
}

@ObjectType()
export class UserAccountSummary {
	@Field(() => [UserAccountSolvesSummary])
	timer_solves: UserAccountSolvesSummary[];

	@Field(() => Int)
	solves: number;

	@Field(() => Int)
	reports_for: number;

	@Field(() => Int)
	reports_created: number;

	@Field(() => Int)
	profile_views: number;

	@Field(() => Int)
	bans: number;
}

@InterfaceType({ implements: IPublicUserAccount })
class IUserAccount extends IPublicUserAccount {
	@Field()
	email: string;

	@Field()
	first_name: string;

	@Field()
	last_name: string;

	@Field()
	offline_hash: string;

	@Field()
	join_country: string;

	@Field({nullable: true})
	has_password?: boolean;

	@Field(() => TimerBackground)
	timer_background?: TimerBackground;

	@Field(() => [BanLog])
	bans?: BanLog[];
}

@InterfaceType({ implements: IUserAccount })
class IUserAccountForAdmin extends IUserAccount {
	@Field()
	email: string;

	@Field()
	email_verified: boolean;

	@Field()
	first_name: string;

	@Field()
	last_name: string;

	@Field()
	join_ip: string;

	@Field()
	join_country: string;

	@Field(() => [Report])
	reports_for?: Report[];

	@Field(() => NotificationPreference)
	notification_preferences?: NotificationPreference;

	@Field(() => Setting)
	settings?: Setting;

	@Field(() => UserAccountSummary)
	summary?: UserAccountSummary;

	@Field(() => [PushTokenInfo], {nullable: true})
	pushTokens?: PushTokenInfo[];
}

@InterfaceType({ implements: IUserAccountForAdmin })
class IInternalUserAccount extends IUserAccountForAdmin {
	@Field({ nullable: true })
	password?: string;
}

@ObjectType({ implements: IPublicUserAccount })
export class PublicUserAccount extends IPublicUserAccount { }

@ObjectType({ implements: [IPublicUserAccount, IUserAccount] })
export class UserAccount extends IUserAccount { }

@ObjectType({ implements: [IPublicUserAccount, IUserAccount, IUserAccountForAdmin] })
export class UserAccountForAdmin extends IUserAccountForAdmin { }

@ObjectType({ implements: [IPublicUserAccount, IUserAccount, IUserAccountForAdmin, IInternalUserAccount] })
export class InternalUserAccount extends IInternalUserAccount { }

@ObjectType()
export class PaginatedUserAccounts extends PaginatedResponse(PublicUserAccount) { }

@ObjectType()
export class PaginatedUserAccountsForAdmin extends PaginatedResponse(UserAccountForAdmin) { }
