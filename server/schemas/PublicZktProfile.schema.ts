import {Field, Int, ObjectType} from 'type-graphql';

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
/**
 * A position in the ZKT all-time rankings, as the federation computes it (ties
 * share a position). ZKT competitions are all held in Türkiye, so this is the
 * ZKT counterpart of a WCA country rank, never a world rank.
 */
@ObjectType()
export class ZktRankPosition {
	@Field(() => Int)
	rank: number;

	/** Competitors ranked in this event and type. */
	@Field(() => Int)
	total: number;
}

@ObjectType()
export class ZktEventPb {
	@Field(() => String)
	event_id: string;

	@Field(() => String, {nullable: true})
	single?: string;

	@Field(() => String, {nullable: true})
	average?: string;

	/** Null when the member switched their ranking off (zkt_show_rank). */
	@Field(() => ZktRankPosition, {nullable: true})
	single_rank?: ZktRankPosition;

	@Field(() => ZktRankPosition, {nullable: true})
	average_rank?: ZktRankPosition;
}

@ObjectType()
export class PublicZktProfile {
	@Field(() => String, {nullable: true})
	zkt_id?: string;

	@Field(() => String, {nullable: true})
	zkt_name?: string;

	@Field(() => String, {nullable: true})
	zkt_country_iso2?: string;

	/** Federation profile photo. Only a fallback: a photo uploaded here wins. */
	@Field(() => String, {nullable: true})
	zkt_avatar_url?: string;

	/** Owner only (myZktProfile): the federation desk's lookup handle, never public. */
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

	@Field(() => Boolean, {nullable: true})
	zkt_show_rank?: boolean;

	@Field(() => Boolean, {nullable: true})
	zkt_show_results?: boolean;

	/**
	 * Best ZKT ranking position across every event, single or average — the
	 * counterpart of PublicWcaProfile.best_world_rank. Computed from all PBs even
	 * when the PB list itself is hidden; null when the ranking switch is off.
	 */
	@Field(() => Int, {nullable: true})
	zkt_best_rank?: number;

	@Field(() => String, {nullable: true})
	zkt_best_rank_event?: string;
}
