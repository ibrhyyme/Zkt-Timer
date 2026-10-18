import {Field, InputType, Int, ObjectType} from 'type-graphql';

/**
 * Trainer algorithm sets (design .feedback/designs/trainer-sets.md section 4.1).
 *
 * Every field here must also be read by the select constants in server/models/alg_set.ts
 * (Prisma select consistency; server/resolvers/__tests__/alg_set_select.test.ts checks it).
 * No set type returns PublicUserAccount: the owner is the small AlgSetOwner (B-11).
 */

@ObjectType()
export class AlgSetItem {
	@Field()
	id: string;

	/** default-algs.json category key ("OLL"). */
	@Field()
	category: string;

	/** Case name, unique inside the category ("OLL 45"). */
	@Field()
	case_name: string;

	/** Filled by the server from default-algs.json when the row was added. */
	@Field()
	subset: string;

	/** Puzzle key (333, 222, 444, pyram, skewb, sq1). */
	@Field()
	puzzle: string;

	/** The algorithm the owner chose, as the library or the alternative pool writes it. */
	@Field()
	algorithm: string;

	@Field(() => Int)
	position: number;
}

@ObjectType()
export class AlgSetOwner {
	@Field()
	id: string;

	@Field()
	username: string;

	@Field()
	verified: boolean;

	/** Storage path of the profile picture; the client turns it into a URL (getStorageURL). */
	@Field({nullable: true})
	avatar_path?: string;
}

@ObjectType()
export class AlgSetSummary {
	@Field()
	id: string;

	/** Share code used in every URL: /trainer/sets/<code>. */
	@Field()
	code: string;

	@Field()
	name: string;

	@Field({nullable: true})
	description?: string;

	/** private | link | public (shared/trainer/alg_sets.ts ALG_SET_VISIBILITIES). */
	@Field()
	visibility: string;

	@Field(() => Int)
	item_count: number;

	@Field(() => Int)
	save_count: number;

	/** Distinct item categories, sorted. */
	@Field(() => [String])
	categories: string[];

	/** Distinct item puzzle keys, sorted. */
	@Field(() => [String])
	puzzles: string[];

	/** First items by position, for list thumbnails. */
	@Field(() => [AlgSetItem])
	preview: AlgSetItem[];

	@Field(() => AlgSetOwner)
	owner: AlgSetOwner;

	@Field({nullable: true})
	published_at?: Date;

	@Field()
	updated_at: Date;

	@Field()
	created_at: Date;

	/** True only when the caller is the owner or staff and moderation hid the set. */
	@Field()
	hidden: boolean;
}

@ObjectType()
export class AlgSet extends AlgSetSummary {
	/** All rows by position. A field resolver: rows are read only when the query asks. */
	@Field(() => [AlgSetItem])
	items?: AlgSetItem[];

	@Field()
	is_owner: boolean;

	@Field()
	is_saved: boolean;
}

@ObjectType()
export class SavedAlgSet {
	@Field()
	set_id: string;

	@Field()
	saved_at: Date;

	/** Null when the set is no longer shared with the caller (private, hidden, owner banned). */
	@Field(() => AlgSetSummary, {nullable: true})
	set?: AlgSetSummary;

	@Field()
	unavailable: boolean;
}

@ObjectType()
export class MyAlgSets {
	@Field(() => [AlgSetSummary])
	own: AlgSetSummary[];

	@Field(() => [SavedAlgSet])
	saved: SavedAlgSet[];
}

@ObjectType()
export class CommunityAlgSetPage {
	@Field(() => [AlgSetSummary])
	items: AlgSetSummary[];

	@Field(() => Int)
	total: number;

	@Field()
	has_more: boolean;
}

@InputType()
export class AlgSetCreateInput {
	@Field()
	name: string;

	@Field({nullable: true})
	description?: string;

	/** Defaults to private. */
	@Field({nullable: true})
	visibility?: string;
}

@InputType()
export class AlgSetUpdateInput {
	/** Left out: unchanged. */
	@Field({nullable: true})
	name?: string;

	/** Left out: unchanged. Null or empty: cleared. */
	@Field({nullable: true})
	description?: string;

	/** Left out: unchanged. Refused on a set hidden by moderation. */
	@Field({nullable: true})
	visibility?: string;
}

@InputType()
export class AlgSetItemInput {
	@Field()
	category: string;

	@Field()
	case_name: string;

	/** The variant the owner picked; stored as the matching library or pool text. */
	@Field()
	algorithm: string;
}

/** Report.alg_set: the set a report is about, for the admin report screen. */
@ObjectType()
export class ReportAlgSet {
	@Field()
	id: string;

	@Field()
	code: string;

	@Field()
	name: string;

	@Field()
	visibility: string;

	@Field()
	hidden: boolean;

	@Field({nullable: true})
	hidden_reason?: string;
}
