import { Field, ObjectType, InputType, Float, Int } from 'type-graphql';
import { GraphQLBigInt } from 'graphql-scalars';
import { PublicUserAccount } from './UserAccount.schema';
import { SolveMethodStep } from './SolveStepMethod.schema';
import { SolveView } from './SolveView.schema';
import { SmartDevice } from './SmartDevice.schema';
import { SolveCube } from './Cube.schema';

@InputType()
export class SolveInput {
	@Field()
	id?: string;

	@Field(() => Float)
	time?: number;

	@Field(() => Float)
	raw_time?: number;

	@Field()
	cube_type?: string;

	@Field({ nullable: true })
	scramble_subset?: string;

	@Field()
	scramble?: string;

	@Field()
	session_id?: string;

	@Field(() => GraphQLBigInt)
	started_at?: number;

	@Field(() => GraphQLBigInt)
	ended_at?: number;

	@Field()
	dnf?: boolean;

	@Field()
	plus_two?: boolean;

	@Field()
	bulk?: boolean;

	@Field()
	notes?: string;

	@Field()
	from_timer: boolean;

	@Field()
	trainer_name?: string;

	@Field()
	is_smart_cube?: boolean;

	@Field()
	is_virtual_cube?: boolean;

	@Field()
	training_session_id?: string;

	@Field()
	smart_device_id?: string;

	/**
	 * Physical cube (Cube.id) the solve was made with. Unknown, foreign or wrong-puzzle ids are
	 * stored as null, never refused (server/util/solve_links.ts).
	 */
	@Field({ nullable: true })
	cube_id?: string;

	@Field(() => Int)
	smart_turn_count?: number;

	@Field()
	smart_turns?: string;

	/** Gyro-detected whole-cube rotations, core frame, smart_turns format (Pro). */
	@Field()
	smart_rotations?: string;

	/**
	 * Raw gyro stream for the realistic replay (gyro_codec.ts, Pro). Input only: it is read
	 * back through the solveGyro query, never with the solve, so no sync read carries it.
	 */
	@Field()
	smart_gyro?: string;

	/**
	 * Which solving method to break this solve down with ('cfop' | 'cfop2' |
	 * 'roux' | 'zz'). Sent by the client from the user's analysis setting; the
	 * server falls back to CFOP when absent so older clients keep working.
	 */
	@Field({ nullable: true })
	analysis_method?: string;

	@Field(() => Float)
	smart_put_down_time?: number;

	@Field(() => Float)
	smart_pick_up_time?: number;

	@Field(() => Float)
	inspection_time?: number;

	// "<method>:<ms>,<ms>,..." — see shared/util/solve/multiphase.ts
	@Field({ nullable: true })
	phase_splits?: string;
}

@ObjectType()
export class Solve {
	@Field()
	id: string;

	@Field(() => Float)
	time: number;

	@Field(() => Float)
	raw_time: number;

	@Field()
	cube_type: string;

	@Field({ nullable: true })
	scramble_subset?: string;

	@Field()
	scramble: string;

	@Field()
	from_timer: boolean;

	@Field()
	training_session_id?: string;

	@Field()
	session_id: string;

	@Field()
	user_id: string;

	@Field()
	bulk: boolean;

	@Field(() => GraphQLBigInt)
	started_at: number;

	@Field(() => GraphQLBigInt)
	ended_at: number;

	@Field()
	dnf: boolean;

	@Field()
	plus_two: boolean;

	@Field()
	notes: string;

	@Field()
	trainer_name: string;

	@Field()
	created_at: Date;

	@Field()
	is_smart_cube: boolean;

	@Field()
	is_virtual_cube: boolean;

	@Field()
	smart_device_id: string;

	@Field({ nullable: true })
	cube_id?: string;

	@Field(() => Int)
	smart_turn_count: number;

	@Field()
	smart_turns: string;

	@Field()
	smart_rotations: string;

	@Field(() => Float)
	smart_put_down_time: number;

	@Field(() => Float)
	smart_pick_up_time: number;

	@Field(() => Float)
	inspection_time: number;

	@Field()
	share_code: string;

	// "<method>:<ms>,<ms>,..." — see shared/util/solve/multiphase.ts
	@Field({ nullable: true })
	phase_splits?: string;

	@Field(() => [SolveMethodStep])
	solve_method_steps?: SolveMethodStep[];

	@Field(() => [SolveView])
	solve_views?: SolveView[];

	@Field(() => SmartDevice, { nullable: true })
	smart_device?: SmartDevice;

	/**
	 * The cube's name and kind for a single solve view (share code, someone else's solve).
	 * Resolved per solve (SolveCubeResolver), so list fragments must not ask for it; a user's
	 * own solves name their cube from the local cube list.
	 *
	 * Not a @Field: the resolver defines the GraphQL field. A @Field here shadowed it in the
	 * production build (see the note on Integration's WCA counts).
	 */
	cube?: SolveCube;

	@Field(() => PublicUserAccount)
	user?: PublicUserAccount;
}

/**
 * What the solve detail fetches for the gyro reconstruction, apart from the solve itself: the
 * raw stream (no sync read carries it) and the owner's verdict on the reconstruction.
 */
@ObjectType()
export class SolveReplayData {
	@Field({ nullable: true })
	smart_gyro?: string;

	@Field(() => Int, { nullable: true })
	reconstruction_vote?: number;

	/**
	 * Whether the caller owns the solve, so may judge its reconstruction. From the server, not
	 * the client's copy: a solve saved on this device carries no user_id until a sync read.
	 */
	@Field({ nullable: true })
	is_owner?: boolean;
}

@ObjectType()
export class SolveList {
	@Field(() => [Solve])
	solves: Solve[];

	@Field()
	more_results: boolean;

	@Field(() => Int)
	total_count: number;
}
