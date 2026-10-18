// The sync reads (`solves`, `recoverMySolves`, `solvesByIds`) answer with a Prisma `select`,
// which returns only the columns it names, and GraphQL fills a nullable field it did not get
// with null. A field the client's sync fragment asks for but the server's select leaves out
// therefore arrives as null on every device, with no error anywhere. That is how
// smart_device_id went missing (design 1.7 E-d), and the planned cube_id would go the same way.

import type {FieldNode, FragmentDefinitionNode} from 'graphql';
import {MICRO_SOLVE_FRAGMENT} from '../graphql/fragments';
import {SYNC_SOLVE_SCALARS} from '../../../server/util/solve/sync_select';

/** Top-level fields of the fragment that carry no sub-selection, i.e. plain columns. */
function scalarFields(): string[] {
	const fragment = MICRO_SOLVE_FRAGMENT.definitions.find(
		(d): d is FragmentDefinitionNode => d.kind === 'FragmentDefinition'
	);
	if (!fragment) throw new Error('MicroSolveFragment not found');

	return fragment.selectionSet.selections
		.filter((s): s is FieldNode => s.kind === 'Field' && !s.selectionSet)
		.map((s) => s.name.value);
}

describe('sync fragment vs server select', () => {
	it('every column the sync fragment asks for is selected by the server', () => {
		const missing = scalarFields().filter((field) => !(field in SYNC_SOLVE_SCALARS));
		expect(missing).toEqual([]);
	});

	it('carries the smart device link to other devices (E-d)', () => {
		expect(scalarFields()).toContain('smart_device_id');
		expect(SYNC_SOLVE_SCALARS.smart_device_id).toBe(true);
	});

	it('carries manual phase splits to other devices', () => {
		expect(scalarFields()).toContain('phase_splits');
		expect(SYNC_SOLVE_SCALARS.phase_splits).toBe(true);
	});
});
