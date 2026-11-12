import {Field, Int, ObjectType} from 'type-graphql';
import {UserAccountForAdmin} from './UserAccount.schema';

/** One month ('YYYY-MM') or one day ('YYYY-MM-DD'), Istanbul calendar. */
@ObjectType()
export class GrowthBucket {
	@Field()
	key: string;

	@Field(() => Int)
	count: number;

	/** Signups only: accounts in this bucket with at least one solve on the server. */
	@Field(() => Int, {nullable: true})
	activated?: number;

	/** Signups only: accounts in this bucket holding Pro or Premium today. */
	@Field(() => Int, {nullable: true})
	pro?: number;
}

@ObjectType()
export class GrowthCountry {
	/** ISO 3166 alpha-2 from CF-IPCountry, or 'NONE'. */
	@Field()
	country: string;

	@Field(() => Int)
	count: number;
}

@ObjectType()
export class AdminGrowthReport {
	/** 'signups' | 'solves' */
	@Field()
	metric: string;

	/** Every month with data, oldest first. Empty when the caller asked to skip it. */
	@Field(() => [GrowthBucket])
	months: GrowthBucket[];

	/** Filled only when both a year and a month are selected. */
	@Field(() => [GrowthBucket])
	days: GrowthBucket[];

	/** Signups only: join countries inside the selected year/month, largest first. */
	@Field(() => [GrowthCountry])
	countries: GrowthCountry[];

	/** Signups in the selected scope, so the country list can say what it leaves out. */
	@Field(() => Int)
	scope_total: number;
}

@ObjectType()
export class AdminProUserRow {
	@Field(() => UserAccountForAdmin)
	user: UserAccountForAdmin;

	/** 'pro' | 'premium' */
	@Field()
	tier: string;

	/** 'lifetime' | 'yearly' | 'monthly' | 'other' | 'promo' | 'competition' | 'admin' */
	@Field()
	source: string;

	/** 'active' | 'cancelled' | 'billing_issue' */
	@Field()
	status: string;

	@Field(() => Date, {nullable: true})
	expires_at?: Date;

	@Field(() => Date, {nullable: true})
	last_event_at?: Date;

	@Field({nullable: true})
	promo_code?: string;
}
