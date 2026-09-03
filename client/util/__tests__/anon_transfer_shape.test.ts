// The anonymous-to-account transfer sends local rows to bulkCreateSessions and
// bulkCreateSolves. graphql-js validates input objects against the schema before any
// resolver runs, and it rejects the whole request over a single undeclared field, so a
// local row cannot be handed over as-is.
//
// This shipped broken once: `ensureLocalDefaultSession` stamps anonymous sessions with
// `created_at` and `user_id`, neither of which SessionInput declares, so every transfer
// failed with nothing moved. The whitelists in anon-mode.ts fix that, and these tests
// hold them against schema.graphql so the two cannot drift apart again.

import fs from 'fs';
import path from 'path';
import {SESSION_INPUT_FIELDS, SOLVE_INPUT_FIELDS} from '../anon-mode';

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
});
