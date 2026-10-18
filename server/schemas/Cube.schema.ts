import { Field, Float, InputType, Int, ObjectType } from 'type-graphql';

/**
 * My Cubes (design .feedback/designs/magnet-cubes.md, section 3). A cube belongs to one puzzle
 * key (shared/cube_puzzle.ts); each puzzle has at most one main cube per user; a magnet
 * calibration belongs to one cube on one phone model. Validation: server/util/cube_validation.ts.
 */

@ObjectType()
export class CubeCalibration {
	@Field()
	id: string;

	@Field()
	cube_id: string;

	/** ios | android */
	@Field()
	platform: string;

	@Field()
	device_model: string;

	@Field({ nullable: true })
	os_version?: string;

	@Field({ nullable: true })
	app_version?: string;

	@Field({ nullable: true })
	sensor_name?: string;

	@Field(() => Float)
	peak_ut: number;

	@Field(() => Float, { nullable: true })
	rest_ut?: number;

	@Field(() => Float)
	noise_ut: number;

	/** What algo_version produced at the time; clients re-derive from the raw values. */
	@Field(() => Float)
	near_min_ut: number;

	@Field(() => Float)
	far_max_ut: number;

	/** ok | weak */
	@Field()
	quality: string;

	@Field(() => Int)
	sample_count: number;

	@Field(() => Int)
	sweep_ms: number;

	@Field(() => Float)
	rate_hz: number;

	@Field(() => Int)
	algo_version: number;

	@Field()
	measured_at: Date;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;
}

@ObjectType()
export class Cube {
	@Field()
	id: string;

	/** '333', '222', ..., 'fto', or one of the owner's custom cube type ids. Never changes. */
	@Field()
	puzzle: string;

	@Field()
	name: string;

	@Field({ nullable: true })
	brand?: string;

	@Field()
	is_smart: boolean;

	@Field({ nullable: true })
	ble_device_id?: string;

	@Field({ nullable: true })
	ble_name?: string;

	/** SmartDevice rows this cube was migrated from; maps old solve.smart_device_id values on the device. */
	@Field(() => [String])
	legacy_smart_device_ids: string[];

	@Field({ nullable: true })
	archived_at?: Date;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;

	/** Solves linked to this cube on the server (every device, every bucket of its puzzle). */
	@Field(() => Int)
	solve_count: number;

	@Field({ nullable: true })
	first_used_at?: Date;

	@Field({ nullable: true })
	last_used_at?: Date;

	/** The owner's calibrations of this cube, every phone model. */
	@Field(() => [CubeCalibration])
	calibrations: CubeCalibration[];
}

@ObjectType()
export class CubeMain {
	@Field()
	puzzle: string;

	/** null: the puzzle has no main cube (it was just removed). */
	@Field({ nullable: true })
	cube_id?: string;

	/** Client time of the choice; the newer choice wins across devices. */
	@Field()
	set_at: Date;
}

@ObjectType()
export class MyCubeState {
	/** Archived cubes included; the client filters. */
	@Field(() => [Cube])
	cubes: Cube[];

	@Field(() => [CubeMain])
	mains: CubeMain[];
}

/** The cube of a single solve view (Solve.cube). */
@ObjectType()
export class SolveCube {
	@Field()
	id: string;

	@Field()
	name: string;

	@Field({ nullable: true })
	brand?: string;

	@Field()
	puzzle: string;

	@Field()
	is_smart: boolean;
}

@InputType()
export class CubeInput {
	/** Client-made uuid, so a create sent twice (offline retry) makes one cube. */
	@Field({ nullable: true })
	id?: string;

	@Field()
	puzzle: string;

	@Field()
	name: string;

	@Field({ nullable: true })
	brand?: string;

	@Field({ nullable: true })
	is_smart?: boolean;

	/** Make it the puzzle's main cube. The first cube of a puzzle becomes main anyway. */
	@Field({ nullable: true })
	make_main?: boolean;

	/** Client time of the make_main choice (the newer choice wins, as in setMainCube). Server time when absent. */
	@Field({ nullable: true })
	set_at?: Date;
}

/** Only the fields present change. The puzzle never does: linked solves belong to it. */
@InputType()
export class CubeUpdateInput {
	@Field({ nullable: true })
	name?: string;

	/** Empty string or null clears the brand. */
	@Field({ nullable: true })
	brand?: string;

	@Field({ nullable: true })
	is_smart?: boolean;
}

@InputType()
export class CubeCalibrationInput {
	@Field()
	cube_id: string;

	@Field()
	platform: string;

	@Field()
	device_model: string;

	@Field({ nullable: true })
	os_version?: string;

	@Field({ nullable: true })
	app_version?: string;

	@Field({ nullable: true })
	sensor_name?: string;

	@Field(() => Float)
	peak_ut: number;

	@Field(() => Float, { nullable: true })
	rest_ut?: number;

	@Field(() => Float)
	noise_ut: number;

	@Field(() => Float)
	near_min_ut: number;

	@Field(() => Float)
	far_max_ut: number;

	@Field()
	quality: string;

	@Field(() => Int)
	sample_count: number;

	@Field(() => Int)
	sweep_ms: number;

	@Field(() => Float)
	rate_hz: number;

	@Field(() => Int)
	algo_version: number;

	/** Client time of the measurement (kept through the offline queue). */
	@Field()
	measured_at: Date;
}

/** One stored calibration for the admin view, with what the current formula makes of it. */
@ObjectType()
export class AdminCubeCalibrationRow {
	@Field()
	id: string;

	@Field()
	user_id: string;

	@Field({ nullable: true })
	username?: string;

	@Field({ nullable: true })
	email?: string;

	@Field()
	cube_id: string;

	@Field()
	cube_name: string;

	@Field({ nullable: true })
	cube_brand?: string;

	@Field()
	puzzle: string;

	/** Name of a custom cube type when the puzzle is one; null for built-in puzzles. */
	@Field({ nullable: true })
	puzzle_name?: string;

	@Field()
	platform: string;

	@Field()
	device_model: string;

	@Field({ nullable: true })
	os_version?: string;

	@Field({ nullable: true })
	app_version?: string;

	@Field({ nullable: true })
	sensor_name?: string;

	@Field(() => Float)
	peak_ut: number;

	@Field(() => Float, { nullable: true })
	rest_ut?: number;

	@Field(() => Float)
	noise_ut: number;

	@Field(() => Float)
	near_min_ut: number;

	@Field(() => Float)
	far_max_ut: number;

	@Field()
	quality: string;

	/** The current formula's thresholds and quality from the stored raw values. */
	@Field(() => Float, { nullable: true })
	current_near_min_ut?: number;

	@Field(() => Float, { nullable: true })
	current_far_max_ut?: number;

	@Field({ nullable: true })
	current_quality?: string;

	/** Noise above three times the platform's expected rest noise. */
	@Field()
	noisy: boolean;

	@Field(() => Int)
	sample_count: number;

	@Field(() => Int)
	sweep_ms: number;

	@Field(() => Float)
	rate_hz: number;

	@Field(() => Int)
	algo_version: number;

	@Field()
	measured_at: Date;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;
}

/**
 * Rollup per (puzzle, platform, phone model): the input for better per-puzzle defaults
 * (design 6.6). The telemetry columns come from the magnet field study grouped the same way
 * and stay zero while the study is off.
 */
@ObjectType()
export class AdminCubeCalibrationSummary {
	@Field()
	puzzle: string;

	@Field()
	platform: string;

	@Field()
	device_model: string;

	@Field(() => Int)
	calibrations: number;

	@Field(() => Int)
	distinct_users: number;

	@Field(() => Float)
	median_rest_ut: number;

	@Field(() => Float)
	p10_rest_ut: number;

	@Field(() => Float)
	median_peak_ut: number;

	@Field(() => Float)
	median_noise_ut: number;

	/** Share of `weak` calibrations, 0..1. */
	@Field(() => Float)
	weak_ratio: number;

	@Field(() => Int)
	telemetry_placements: number;

	@Field(() => Float)
	telemetry_median_near_ut: number;

	@Field(() => Int)
	telemetry_lifts: number;

	@Field(() => Int)
	telemetry_rejects: number;
}
