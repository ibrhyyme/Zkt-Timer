import { ObjectType, Field, InputType, Int, Float } from 'type-graphql';

/**
 * One observation from magnet lift-to-start on a phone. Clients batch these and flush
 * periodically, so one request carries many rows. Validated in server/util/magnet_telemetry.ts.
 */
@InputType()
export class MagnetTelemetryInput {
	/** ios | android */
	@Field()
	platform: string;

	@Field()
	device_model: string;

	@Field({ nullable: true })
	os_version?: string;

	@Field({ nullable: true })
	sensor_name?: string;

	/** device | near | lift | reject | unsupported | hint | far_learned | touch_ignored */
	@Field()
	event_type: string;

	@Field({ nullable: true })
	detail?: string;

	@Field(() => Float, { nullable: true })
	delta_ut?: number;

	@Field(() => Int, { nullable: true })
	latency_ms?: number;

	@Field(() => Int, { nullable: true })
	rest_ms?: number;

	@Field(() => Int, { nullable: true })
	approach_ms?: number;

	@Field(() => Float, { nullable: true })
	sigma?: number;

	@Field(() => Float, { nullable: true })
	rate_hz?: number;

	@Field({ nullable: true })
	reversed?: boolean;

	/** JSON-encoded raw window in the test-fixture format, only on flagged events. */
	@Field({ nullable: true })
	samples?: string;

	@Field({ nullable: true })
	app_version?: string;
}

@ObjectType()
export class MagnetTelemetryResult {
	/** How many rows were stored. Zero when the study is switched off. */
	@Field(() => Int)
	accepted: number;

	/** False while the study is off, so the client stops collecting until the next launch. */
	@Field()
	enabled: boolean;
}

@ObjectType()
export class MagnetTelemetryRow {
	@Field()
	id: string;

	@Field({ nullable: true })
	username?: string;

	@Field()
	platform: string;

	@Field()
	device_model: string;

	@Field({ nullable: true })
	os_version?: string;

	@Field({ nullable: true })
	sensor_name?: string;

	@Field()
	event_type: string;

	@Field({ nullable: true })
	detail?: string;

	@Field(() => Float, { nullable: true })
	delta_ut?: number;

	@Field(() => Int, { nullable: true })
	latency_ms?: number;

	@Field(() => Int, { nullable: true })
	rest_ms?: number;

	@Field(() => Int, { nullable: true })
	approach_ms?: number;

	@Field(() => Float, { nullable: true })
	sigma?: number;

	@Field(() => Float, { nullable: true })
	rate_hz?: number;

	@Field()
	reversed: boolean;

	/** The row carries a raw window, downloadable through magnetTelemetrySamples. */
	@Field()
	has_samples: boolean;

	@Field({ nullable: true })
	app_version?: string;

	@Field()
	created_at: Date;
}

/**
 * Per phone model rollup. The columns are the study's questions: does the placement reach
 * the 150 uT threshold with margin (min / median near), how fast are lifts confirmed, how
 * often are lifts refused or rejected, and which phones cannot deliver 40 Hz at all.
 */
@ObjectType()
export class MagnetTelemetrySummary {
	@Field()
	platform: string;

	@Field()
	device_model: string;

	@Field({ nullable: true })
	sensor_name?: string;

	@Field(() => Int)
	distinct_users: number;

	/** Fresh placements (not re-placements, not cubes left at the hot spot through a stop). */
	@Field(() => Int)
	placements: number;

	@Field(() => Float)
	min_near_ut: number;

	@Field(() => Float)
	median_near_ut: number;

	@Field(() => Int)
	lifts: number;

	/** Lifts that started inspection or the solve. */
	@Field(() => Int)
	started: number;

	/** Lifts the controller refused (not armed, not ready, stale, touch priming...). */
	@Field(() => Int)
	refused: number;

	@Field(() => Int)
	median_latency_ms: number;

	@Field(() => Int)
	p95_latency_ms: number;

	@Field(() => Int)
	median_approach_ms: number;

	@Field(() => Int)
	rejects: number;

	@Field(() => Int)
	unsupported: number;

	@Field(() => Int)
	unknown_hints: number;

	@Field(() => Float)
	median_sigma: number;

	@Field(() => Float)
	rate_hz: number;
}
