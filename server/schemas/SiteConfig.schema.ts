import {Field, ObjectType, InputType, Int} from 'type-graphql';

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
}
