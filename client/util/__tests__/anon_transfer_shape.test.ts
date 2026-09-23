// The anonymous-to-account transfer sends local rows to bulkCreateSessions and
// bulkCreateSolves. graphql-js validates input objects against the schema before any
// resolver runs, and it rejects the whole request over a single undeclared field, so a
// local row cannot be handed over as-is.
//
// This shipped broken once: `ensureLocalDefaultSession` stamps anonymous sessions with
// `created_at` and `user_id`, neither of which SessionInput declares, so every transfer
// failed with nothing moved. The whitelists in db/solves/solve-input.ts fix that (the
// offline queue, backfill and migration use them too), and these tests hold them against
// schema.graphql so the two cannot drift apart again.

import fs from 'fs';
import path from 'path';
import {
	SESSION_INPUT_FIELDS,
	SOLVE_INPUT_FIELDS,
	toCreateSolveInput,
	toSessionInput,
	toSolveInput,
} from '../../db/solves/solve-input';

/** Field names declared on a GraphQL `input` block in schema.graphql. */
function readInputFields(inputName: string): string[] {
	const schema = fs.readFileSync(path.join(__dirname, '../../../schema.graphql'), 'utf8');
	const match = schema.match(new RegExp(`input ${inputName} \\{([^}]*)\\}`));
	if (!match) throw new Error(`input ${inputName} not found in schema.graphql`);

	return match[1]
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#'))
		.map((line) => line.split(':')[0].trim());
}

describe('anonymous transfer payload shape', () => {
	it('sends only fields SessionInput declares', () => {
		const declared = readInputFields('SessionInput');
		const extra = SESSION_INPUT_FIELDS.filter((field) => !declared.includes(field as string));
		expect(extra).toEqual([]);
	});

	it('sends only fields SolveInput declares', () => {
		const declared = readInputFields('SolveInput');
		const extra = SOLVE_INPUT_FIELDS.filter((field) => !declared.includes(field as string));
		expect(extra).toEqual([]);
	});

	it('carries every session field the schema accepts', () => {
		// A field the schema accepts but the transfer drops is silent data loss: the solve
		// arrives, the thing that gave it meaning does not.
		const declared = readInputFields('SessionInput');
		const missing = declared.filter((field) => !SESSION_INPUT_FIELDS.includes(field as any));
		expect(missing).toEqual([]);
	});

	it('carries every solve field the schema accepts, except analysis_method', () => {
		// analysis_method is an instruction to the resolver rather than a stored column, and
		// sanitizeSolve strips it on the normal save path too.
		const declared = readInputFields('SolveInput');
		const missing = declared.filter(
			(field) => field !== 'analysis_method' && !SOLVE_INPUT_FIELDS.includes(field as any)
		);
		expect(missing).toEqual([]);
	});

	it('drops the local-only fields that failed the first transfer', () => {
		// Named explicitly, because these two are what actually broke it in the field.
		expect(SESSION_INPUT_FIELDS).not.toContain('created_at' as any);
		expect(SESSION_INPUT_FIELDS).not.toContain('user_id' as any);
	});

	it('reduces a local row to schema fields, dropping LokiJS metadata and resolver hints', () => {
		const row = {
			id: 'a',
			time: 12.3,
			session_id: 's',
			is_virtual_cube: true,
			phase_splits: '1,2',
			scramble_subset: '222',
			analysis_method: 'roux',
			$loki: 4,
			meta: {revision: 0},
			solve_method_steps: [],
			user_id: 'u',
		};
		expect(toSolveInput(row)).toEqual({
			id: 'a',
			time: 12.3,
			session_id: 's',
			is_virtual_cube: true,
			phase_splits: '1,2',
			scramble_subset: '222',
		});
	});

	it('reduces a local session to schema fields', () => {
		expect(toSessionInput({id: 's', name: 'n', order: 2, user_id: '_local', created_at: new Date()})).toEqual({
			id: 's',
			name: 'n',
			order: 2,
		});
	});

	it('adds analysis_method to a create payload, and only there', () => {
		// The method travels beside the row; dropping it with the row is what sent every
		// smart solve to the server as CFOP.
		const row = {id: 'a', time: 1, analysis_method: 'stale-from-row', $loki: 1};
		expect(toCreateSolveInput(row, 'roux')).toEqual({id: 'a', time: 1, analysis_method: 'roux'});
		expect(toCreateSolveInput(row)).toEqual({id: 'a', time: 1});
		expect(toSolveInput({...row, analysis_method: 'roux'})).toEqual({id: 'a', time: 1});
	});
});
