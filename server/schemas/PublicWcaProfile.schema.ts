import {Field, ObjectType} from 'type-graphql';

/**
 * Public-facing WCA summary metadata for a user's profile.
 *
 * Decoupled from published WcaRecord rows: a user can show competitions /
 * medals / WCA ID / rank independently of whether any individual event
 * record is published. Only safe, public fields are exposed here (never
 * auth_token / refresh_token from the Integration model).
 *
 * Fields gated by a `wca_show_*` toggle are returned as null when the
 * corresponding toggle is off, so disabled data never leaves the server.
 */
@ObjectType()
export class PublicWcaProfile {
	@Field(() => String, {nullable: true})
	wca_id?: string;

	@Field(() => String, {nullable: true})
	wca_country_iso2?: string;

	@Field(() => Number, {nullable: true})
	wca_competition_count?: number;

	@Field(() => Number, {nullable: true})
	wca_medal_gold?: number;

	@Field(() => Number, {nullable: true})
	wca_medal_silver?: number;

	@Field(() => Number, {nullable: true})
	wca_medal_bronze?: number;

	@Field(() => Number, {nullable: true})
	wca_record_nr?: number;

	@Field(() => Number, {nullable: true})
	wca_record_cr?: number;

	@Field(() => Number, {nullable: true})
	wca_record_wr?: number;

	@Field(() => Boolean, {nullable: true})
	wca_show_competitions?: boolean;

	@Field(() => Boolean, {nullable: true})
	wca_show_medals?: boolean;

	@Field(() => Boolean, {nullable: true})
	wca_show_records?: boolean;

	@Field(() => Boolean, {nullable: true})
	wca_show_rank?: boolean;

	@Field(() => Boolean, {nullable: true})
	wca_show_results?: boolean;

	@Field(() => Number, {nullable: true})
	best_world_rank?: number;

	@Field(() => String, {nullable: true})
	best_world_rank_event?: string;
}
