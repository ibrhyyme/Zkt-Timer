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
