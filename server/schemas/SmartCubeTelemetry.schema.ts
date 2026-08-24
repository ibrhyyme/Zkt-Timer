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

	/** solve | out_of_sync | late_scramble_move | scramble_resync | scan_error | disconnect */
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

	/** Cube battery percentage at the moment of the event, when the cube reports one. */
	@Field(() => Int, { nullable: true })
	battery_level?: number;

	/** Ms added because the final move packet was lost; zero on clean solves. */
	@Field(() => Int, { nullable: true })
	time_correction_ms?: number;

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

	@Field(() => Int, { nullable: true })
	battery_level?: number;

	@Field(() => Int, { nullable: true })
	time_correction_ms?: number;

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

	/**
	 * Mid-scramble re-anchors where the cube's state was recognised as a point on the
	 * scramble, so the user's progress was kept. These cost the user nothing.
	 */
	@Field(() => Int)
	scramble_realign_events: number;

	/**
	 * Mid-scramble re-anchors where it was not, so the matcher had to start over and the
	 * user lost their place. This is the number that should stay near zero: it is the
	 * failure users described as "the scramble reset itself".
	 */
	@Field(() => Int)
	scramble_reset_events: number;

	@Field(() => Int)
	median_lag_ms: number;

	@Field(() => Int)
	p95_lag_ms: number;

	/**
	 * Mean battery on solves that finished cleanly versus solves that needed a recovery.
	 * If a weak transmitter really is behind the dropped packets, these two numbers pull
	 * apart; if they sit on top of each other, battery is not the story.
	 */
	@Field(() => Int)
	avg_battery_clean: number;

	@Field(() => Int)
	avg_battery_recovered: number;

	/**
	 * Median ms added by the dropped-packet correction, over the solves that needed it.
	 * A model sitting near zero here is one whose move stream arrives intact.
	 */
	@Field(() => Int)
	median_time_correction_ms: number;
}
