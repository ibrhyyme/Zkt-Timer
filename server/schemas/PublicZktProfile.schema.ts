import {Field, ObjectType} from 'type-graphql';

/**
 * Public-facing ZKT (Zeka Kupu Turkiye federation) summary for a profile — the
 * federation counterpart of PublicWcaProfile.
 *
 * The numbers are NOT stored here: they are read live from the federation's
 * public API (Redis-cached) and keyed on the member's ZKT id, which is the only
 * identity that API is keyed on. What IS stored locally is the set of
 * `zkt_show_*` switches, and a section switched off is returned as null so the
 * hidden data never leaves the server.
 */
@ObjectType()
export class ZktEventPb {
	@Field(() => String)
	event_id: string;

	@Field(() => String, {nullable: true})
	single?: string;

	@Field(() => String, {nullable: true})
	average?: string;
}

@ObjectType()
export class PublicZktProfile {
	@Field(() => String, {nullable: true})
	zkt_id?: string;

	@Field(() => String, {nullable: true})
	zkt_name?: string;

	@Field(() => String, {nullable: true})
	zkt_country_iso2?: string;

	@Field(() => Number, {nullable: true})
	zkt_member_no?: number;

	@Field(() => Number, {nullable: true})
	zkt_competition_count?: number;

	@Field(() => Number, {nullable: true})
	zkt_medal_gold?: number;

	@Field(() => Number, {nullable: true})
	zkt_medal_silver?: number;

	@Field(() => Number, {nullable: true})
	zkt_medal_bronze?: number;

	/** Federation records this member currently holds. */
	@Field(() => Number, {nullable: true})
	zkt_record_count?: number;

	/** Best ZKT competition result per event, already formatted by the federation. */
	@Field(() => [ZktEventPb], {nullable: true})
	zkt_personal_bests?: ZktEventPb[];

	@Field(() => Boolean, {nullable: true})
	zkt_show_competitions?: boolean;

	@Field(() => Boolean, {nullable: true})
	zkt_show_medals?: boolean;

	@Field(() => Boolean, {nullable: true})
	zkt_show_records?: boolean;

	@Field(() => Boolean, {nullable: true})
	zkt_show_pbs?: boolean;
}
