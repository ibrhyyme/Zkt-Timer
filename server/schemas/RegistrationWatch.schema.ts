import {Field, Int, ObjectType} from 'type-graphql';

/**
 * Registration watch (owner-only admin page). Rows are built by
 * RegistrationWatch.resolver.ts, never a raw Prisma row.
 */

@ObjectType()
export class RegistrationWatchCompetitionRow {
	@Field()
	competition_id: string;

	@Field()
	name: string;

	/** YYYY-MM-DD */
	@Field()
	start_date: string;

	/** YYYY-MM-DD */
	@Field()
	end_date: string;

	@Field({nullable: true})
	registration_close?: Date;

	@Field(() => Int, {nullable: true})
	competitor_limit?: number;

	@Field(() => Int)
	accepted_count: number;

	@Field(() => Int)
	event_count: number;

	/** Changes certainly made after registration closed or after groups were out. */
	@Field(() => Int)
	flagged_count: number;

	@Field({nullable: true})
	last_event_at?: Date;

	/** When watching started (first full read). Null until then. */
	@Field({nullable: true})
	baseline_at?: Date;

	@Field({nullable: true})
	confirmed_at?: Date;

	@Field({nullable: true})
	groups_seen_at?: Date;
}

@ObjectType()
export class RegistrationWatchEventRow {
	@Field()
	id: string;

	/** joined | left | events_changed */
	@Field()
	kind: string;

	@Field(() => Int)
	wca_registration_id: number;

	@Field(() => Int, {nullable: true})
	registrant_id?: number;

	@Field({nullable: true})
	wca_id?: string;

	@Field()
	name: string;

	@Field(() => [String])
	events_before: string[];

	@Field(() => [String])
	events_after: string[];

	@Field()
	after_close: boolean;

	@Field()
	after_groups: boolean;

	/** The change happened after this moment and by observed_at. */
	@Field({nullable: true})
	window_start?: Date;

	@Field()
	observed_at: Date;
}

@ObjectType()
export class RegistrationWatchRegistrantRow {
	@Field(() => Int)
	wca_registration_id: number;

	@Field(() => Int, {nullable: true})
	registrant_id?: number;

	@Field({nullable: true})
	wca_id?: string;

	@Field()
	name: string;

	@Field(() => [String])
	event_ids: string[];

	@Field(() => Int)
	competitor_groups: number;

	@Field(() => Int)
	staff_tasks: number;

	/** Has a competitor group but no task while nearly everyone else has one. */
	@Field()
	unstaffed: boolean;

	@Field()
	first_seen_at: Date;
}

@ObjectType()
export class RegistrationWatchDetail {
	@Field(() => RegistrationWatchCompetitionRow)
	competition: RegistrationWatchCompetitionRow;

	@Field(() => [RegistrationWatchEventRow])
	events: RegistrationWatchEventRow[];

	@Field(() => [RegistrationWatchRegistrantRow])
	registrants: RegistrationWatchRegistrantRow[];
}
