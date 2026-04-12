import {Field, Float, Int, ObjectType} from 'type-graphql';

@ObjectType()
export class RankedUser {
	@Field(() => Int)
	rank: number;

	@Field()
	user_id: string;

	@Field()
	username: string;

	@Field()
	is_pro: boolean;

	@Field()
	wca_id: string;

	@Field()
	country_iso2: string;

	@Field(() => Float)
	score: number;

	@Field(() => Int, {nullable: true})
	wca_competition_count?: number;

	@Field(() => Int, {nullable: true})
	wca_medal_gold?: number;

	@Field(() => Int, {nullable: true})
	wca_medal_silver?: number;

	@Field(() => Int, {nullable: true})
	wca_medal_bronze?: number;

	@Field({nullable: true})
	pfp_image_url?: string;
}

@ObjectType()
export class RankingsPage {
	@Field(() => [RankedUser])
	rows: RankedUser[];

	@Field(() => Int)
	total_count: number;

	@Field(() => Int)
	page: number;
}
