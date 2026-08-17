import { ObjectType, Field, InputType, Int } from 'type-graphql';

/**
 * A single observation from a smart cube session. Clients batch these and flush
 * periodically, so one request carries many rows.
 */
@InputType()
export class SmartCubeTelemetryInput {
	@Field()
	device_name: string;

	@Field()
	cube_type: string;

	/** timer | room | trainer */
	@Field()
	surface: string;

	/** solve | out_of_sync | late_scramble_move | scan_error | disconnect */
	@Field()
	event_type: string;

	@Field({ nullable: true })
	detection_source?: string;

	@Field(() => Int, { nullable: true })
	detection_lag_ms?: number;

	@Field(() => Int, { nullable: true })
	time_ms?: number;

	@Field(() => Int, { nullable: true })
	turn_count?: number;

	@Field({ nullable: true })
	is_native?: boolean;

	@Field({ nullable: true })
	app_version?: string;
}

@ObjectType()
export class SmartCubeTelemetryResult {
	/** How many rows were stored. Zero when the kill switch is off. */
	@Field(() => Int)
	accepted: number;
}

@ObjectType()
export class SmartCubeTelemetryRow {
	@Field()
	id: string;

	@Field({ nullable: true })
	user_id?: string;

	@Field({ nullable: true })
	username?: string;

	@Field()
	device_name: string;

	@Field()
	cube_type: string;

	@Field()
	surface: string;

	@Field()
	event_type: string;

	@Field({ nullable: true })
	detection_source?: string;

	@Field(() => Int, { nullable: true })
	detection_lag_ms?: number;

	@Field(() => Int, { nullable: true })
	time_ms?: number;

	@Field(() => Int, { nullable: true })
	turn_count?: number;

	@Field()
	is_native: boolean;

	@Field({ nullable: true })
	app_version?: string;

	@Field()
	created_at: Date;
}

/** Per-model rollup, so the admin page answers "which cube misbehaves" without a spreadsheet. */
@ObjectType()
export class SmartCubeTelemetrySummary {
	@Field()
	cube_type: string;

	@Field()
	device_name: string;

	@Field(() => Int)
	solves: number;

	@Field(() => Int)
	distinct_users: number;

	/** Solves finished straight from the move stream. High is good. */
	@Field(() => Int)
	via_tracker: number;

	/** Solves that needed the facelets grace window, i.e. a move packet was lost. */
	@Field(() => Int)
	via_grace: number;

	/** Solves only the 1s poll caught. These are the cubes that used to hang the timer. */
	@Field(() => Int)
	via_poll: number;

	@Field(() => Int)
	out_of_sync_events: number;

	@Field(() => Int)
	late_scramble_events: number;

	@Field(() => Int)
	median_lag_ms: number;

	@Field(() => Int)
	p95_lag_ms: number;
}
