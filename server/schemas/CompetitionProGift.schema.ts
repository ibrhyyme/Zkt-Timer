import {Field, InputType, Int, ObjectType} from 'type-graphql';

/** A federation competition the admin can attach a Pro gift to, with its gift if it has one. */
@ObjectType()
export class ProGiftCompetitionOption {
	@Field()
	zkt_competition_id: string;

	@Field({nullable: true})
	slug?: string;

	@Field()
	name: string;

	@Field()
	date_start: string;

	@Field()
	date_end: string;

	@Field()
	status: string;

	@Field()
	results_published: boolean;

	@Field({nullable: true})
	campaign_id?: string;
}

@ObjectType()
export class CompetitionProCampaignInfo {
	@Field()
	id: string;

	@Field()
	zkt_competition_id: string;

	@Field({nullable: true})
	competition_slug?: string;

	@Field()
	competition_name: string;

	@Field()
	competition_date: Date;

	@Field(() => Int)
	newcomer_days: number;

	@Field(() => Int)
	returning_days: number;

	@Field()
	status: string;

	@Field({nullable: true})
	processed_at?: Date;

	@Field()
	created_at: Date;

	@Field(() => Int)
	granted_count: number;

	@Field(() => Int)
	waiting_count: number;

	@Field(() => Int)
	other_count: number;
}

@ObjectType()
export class CompetitionProGiftInfo {
	@Field()
	id: string;

	@Field()
	name: string;

	@Field({nullable: true})
	username?: string;

	@Field()
	kind: string;

	@Field(() => Int)
	days: number;

	@Field()
	status: string;

	@Field({nullable: true})
	skip_reason?: string;

	@Field({nullable: true})
	granted_at?: Date;

	@Field({nullable: true})
	pro_until?: Date;
}

@InputType()
export class CompetitionProCampaignInput {
	@Field()
	zkt_competition_id: string;

	@Field(() => Int)
	newcomer_days: number;

	@Field(() => Int)
	returning_days: number;
}
