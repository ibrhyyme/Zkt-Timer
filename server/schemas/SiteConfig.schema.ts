import {Field, ObjectType, InputType, Int} from 'type-graphql';

@ObjectType()
export class FeatureOverrideUser {
	@Field()
	id: string;

	@Field()
	username: string;
}

@ObjectType()
export class FeatureOverrideEntry {
	@Field()
	feature: string;

	@Field()
	mode: string;

	@Field(() => [FeatureOverrideUser])
	users: FeatureOverrideUser[];
}

@InputType()
export class FeatureOverrideUserInput {
	@Field()
	id: string;

	@Field()
	username: string;
}

@InputType()
export class FeatureOverrideEntryInput {
	@Field()
	feature: string;

	@Field()
	mode: string;

	@Field(() => [FeatureOverrideUserInput], {nullable: true})
	users?: FeatureOverrideUserInput[];
}
import {PublicUserAccount} from './UserAccount.schema';

@ObjectType()
export class OnlineStats {
	@Field(() => Int)
	totalSockets: number;

	@Field(() => Int)
	uniqueUsers: number;

	@Field(() => Int)
	anonymous: number;
}

@ObjectType()
export class OnlineUser {
	@Field(() => PublicUserAccount)
	user: PublicUserAccount;

	@Field(() => Int)
	tabCount: number;
}

@ObjectType()
export class SiteConfig {
	@Field()
	id: string;

	@Field()
	maintenance_mode: boolean;

	@Field()
	trainer_enabled: boolean;

	@Field()
	community_enabled: boolean;

	@Field()
	leaderboards_enabled: boolean;

	@Field()
	rooms_enabled: boolean;

	@Field()
	battle_enabled: boolean;

	@Field()
	pro_enabled: boolean;

	@Field(() => [FeatureOverrideEntry])
	featureOverrides: FeatureOverrideEntry[];

	@Field()
	updated_at: Date;
}

@ObjectType()
export class BackfillResult {
	@Field(() => Int)
	total: number;

	@Field(() => Int)
	filled: number;

	@Field(() => Int)
	tokenFailed: number;

	@Field(() => Int)
	noWcaId: number;

	@Field(() => Int)
	error: number;

	@Field(() => Int)
	recordsTotal: number;

	@Field(() => Int)
	recordsFilled: number;

	@Field(() => Int)
	recordsError: number;
}

@ObjectType()
export class IpInfo {
	@Field()
	ip: string;

	@Field()
	country: string;

	@Field()
	countryCode: string;

	@Field()
	regionName: string;

	@Field()
	city: string;

	@Field()
	isp: string;

	@Field()
	org: string;

	@Field()
	proxy: boolean;

	@Field()
	mobile: boolean;

	@Field()
	hosting: boolean;

	@Field()
	timezone: string;
}

@ObjectType()
export class WcaStats {
	@Field(() => Int)
	totalUsers: number;

	@Field(() => Int)
	wcaConnected: number;

	@Field(() => Int)
	wcaWithId: number;

	@Field(() => Int)
	wcaWithoutId: number;
}

@InputType()
export class UpdateSiteConfigInput {
	@Field({nullable: true})
	maintenance_mode?: boolean;

	@Field({nullable: true})
	trainer_enabled?: boolean;

	@Field({nullable: true})
	community_enabled?: boolean;

	@Field({nullable: true})
	leaderboards_enabled?: boolean;

	@Field({nullable: true})
	rooms_enabled?: boolean;

	@Field({nullable: true})
	battle_enabled?: boolean;

	@Field({nullable: true})
	pro_enabled?: boolean;

	@Field(() => [FeatureOverrideEntryInput], {nullable: true})
	featureOverrides?: FeatureOverrideEntryInput[];
}
