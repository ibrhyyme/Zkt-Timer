import type {SessionInput, SolveInput} from '../../@types/generated/graphql';

// A local row is not a GraphQL input, and the difference is not cosmetic: graphql-js
// rejects an input object carrying a field the schema does not declare, and it does so
// during validation, before the resolver runs. One stray field therefore fails the whole
// mutation, not the row that carried it.
//
// That is what broke the first anonymous transfer in the field. `ensureLocalDefaultSession`
// stamps every anonymous session with `created_at` and `user_id: '_local'`, neither of which
// exists on SessionInput, so the session batch was refused every time. The offline queue
// has the same exposure: a record written by an older app version replays whatever fields
// that version stored, and one the schema has since dropped would be refused forever.
//
// Whitelists, not deletions: a field added to the local row later must not silently start
// travelling to the server. These mirror `input SessionInput` and `input SolveInput` in
// schema.graphql (held there by client/util/__tests__/anon_transfer_shape.test.ts).
export const SESSION_INPUT_FIELDS: (keyof SessionInput)[] = ['id', 'name', 'order'];

export const SOLVE_INPUT_FIELDS: (keyof SolveInput)[] = [
	'id',
	'time',
	'raw_time',
	'cube_type',
	'scramble_subset',
	'scramble',
	'session_id',
	'started_at',
	'ended_at',
	'dnf',
	'plus_two',
	'bulk',
	'notes',
	'from_timer',
	'trainer_name',
	'is_smart_cube',
	'is_virtual_cube',
	'training_session_id',
	'smart_device_id',
	'smart_turn_count',
	'smart_turns',
	'smart_put_down_time',
	'smart_pick_up_time',
	'inspection_time',
	'phase_splits',
	// `analysis_method` is deliberately absent. The schema accepts it, but it is an
	// instruction to the resolver rather than a stored column, and `sanitizeSolve` strips
	// it on the normal save path too.
];

export function pickFields<T>(row: any, fields: (keyof T)[]): T {
	const out: any = {};
	if (!row) return out as T;
	for (const field of fields) {
		if (row[field] !== undefined) out[field] = row[field];
	}
	return out as T;
}

/** A local solve row (or a partial of one) reduced to what SolveInput declares. */
export function toSolveInput(row: any): SolveInput {
	return pickFields<SolveInput>(row, SOLVE_INPUT_FIELDS);
}

/**
 * The createSolve payload: the stored fields plus `analysis_method`, the instruction that
 * tells the resolver which method to break a smart/virtual cube solve down with.
 *
 * It is not a column, so it never goes into the local row, the whitelist above or the
 * bulk paths. It is carried beside the row instead and added only here. When it went
 * through `sanitizeSolve` with the row (which strips it, rightly, before a DB write),
 * nothing ever reached the server and every smart solve was analysed as CFOP.
 */
export function toCreateSolveInput(row: any, analysisMethod?: string | null): SolveInput {
	const input = toSolveInput(row);
	if (analysisMethod) {
		(input as any).analysis_method = analysisMethod;
	}
	return input;
}

/** A local session row reduced to what SessionInput declares. */
export function toSessionInput(row: any): SessionInput {
	return pickFields<SessionInput>(row, SESSION_INPUT_FIELDS);
}
