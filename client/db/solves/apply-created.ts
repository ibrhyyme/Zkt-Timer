import { getSolveDb } from './init';
import { emitEvent } from '../../util/event_handler';

/**
 * What createSolve is asked to return, wherever a solve is created: the live save in
 * createSolveDb and the offline queue's replay. The server may downgrade a smart solve it
 * could not analyse, and it computes the method steps, so both callers need the answer.
 *
 * `case_key`/`case_set` are what name a CMLL, COLL or ZBLL case in the solve card; without
 * them only the legacy OLL/PLL keys arrived and a Roux or ZZ solve showed bare step names
 * until the next full fetch.
 */
export const CREATED_SOLVE_SELECTION = `
	id
	is_smart_cube
	solve_method_steps {
		id
		step_name
		total_time
		recognition_time
		turn_count
		turns
		tps
		oll_case_key
		pll_case_key
		case_key
		case_set
		skipped
		parent_name
		method_name
		step_index
		created_at
	}
`;

/**
 * Apply the server's answer to the stored solve. Returns whether a row was updated.
 */
export function applyCreatedSolve(solveId: string, created: any): boolean {
	if (!created) return false;

	const db = getSolveDb();
	const existing = db?.findOne({ id: solveId });
	if (!existing) return false;

	// Server downgrade ettiyse (örn. smart_turns parse hatasi) client'i sync et
	if (typeof created.is_smart_cube === 'boolean' && created.is_smart_cube !== existing.is_smart_cube) {
		existing.is_smart_cube = created.is_smart_cube;
	}
	// An array (empty included) is the server's verdict and replaces what is stored: an
	// empty one clears steps of a solve the server downgraded. Null means the answer did not
	// carry steps at all (a solve that had already arrived on an earlier attempt, answered
	// from the stored row): leave the local ones alone instead of wiping them.
	if (Array.isArray(created.solve_method_steps)) {
		existing.solve_method_steps = created.solve_method_steps;
	}
	db.update(existing);
	emitEvent('solveDbUpdatedEvent', existing);
	return true;
}
