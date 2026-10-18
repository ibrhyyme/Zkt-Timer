/**
 * The solve columns every sync read hands to a device: `solves` (Pro cross-device sync),
 * `recoverMySolves` (Basic restore) and `solvesByIds` (delta fetch), all three in
 * server/resolvers/Solve.resolver.ts. One list for the three, because three hand-written
 * copies drifted together: smart_device_id was missing from every one of them, so a solve
 * pulled to another device arrived without its device link.
 *
 * A Prisma `select` returns only what it names, and GraphQL answers a nullable field it did
 * not get with null. A column the client's sync fragment (MICRO_SOLVE_FRAGMENT in
 * client/util/graphql/fragments.ts) asks for but this list leaves out therefore comes back
 * null on every device, with no error anywhere. client/util/__tests__/sync_solve_select.test.ts
 * holds the two together.
 *
 * Pure data, no imports: the client test reads it.
 */
export const SYNC_SOLVE_SCALARS = {
	id: true,
	time: true,
	raw_time: true,
	cube_type: true,
	scramble_subset: true,
	session_id: true,
	trainer_name: true,
	bulk: true,
	from_timer: true,
	training_session_id: true,
	dnf: true,
	plus_two: true,
	scramble: true,
	is_smart_cube: true,
	is_virtual_cube: true,
	smart_device_id: true,
	// Physical cube link (My Cubes). Missing here it would reach other devices as null, the
	// same way smart_device_id once did (server/resolvers/__tests__/solve_select_cube_id.test.ts).
	cube_id: true,
	created_at: true,
	started_at: true,
	ended_at: true,
	phase_splits: true,
} as const;
