// The createSolve answer is applied to the local row on the device that recorded the solve.
// A cube connected without a connection records its BLE identifier as smart_device_id; the
// server stores the device row id instead (or null), and the local row has to follow it so
// this device holds the same link every other device pulls.

const rows = new Map<string, any>();

jest.mock('../init', () => ({
	getSolveDb: () => ({
		findOne: ({id}: {id: string}) => rows.get(id) || null,
		update: (row: any) => rows.set(row.id, row),
	}),
}));
jest.mock('../../../util/event_handler', () => ({emitEvent: jest.fn()}));

import {applyCreatedSolve, CREATED_SOLVE_SELECTION} from '../apply-created';

beforeEach(() => rows.clear());

describe('applyCreatedSolve: smart_device_id', () => {
	it('asks the server for the stored link', () => {
		expect(CREATED_SOLVE_SELECTION).toMatch(/\bsmart_device_id\b/);
	});

	it('swaps the BLE identifier for the device row id the server stored', () => {
		rows.set('s1', {id: 's1', is_smart_cube: true, smart_device_id: 'AA:BB:CC:DD:EE:01'});

		expect(applyCreatedSolve('s1', {id: 's1', is_smart_cube: true, smart_device_id: 'row-gan'})).toBe(true);
		expect(rows.get('s1').smart_device_id).toBe('row-gan');
	});

	it('clears it when the server cleared it', () => {
		rows.set('s2', {id: 's2', is_smart_cube: true, smart_device_id: 'unknown-cube'});

		applyCreatedSolve('s2', {id: 's2', is_smart_cube: true, smart_device_id: null});
		expect(rows.get('s2').smart_device_id).toBeNull();
	});

	it('leaves the local value alone when the answer does not carry the field', () => {
		rows.set('s3', {id: 's3', is_smart_cube: true, smart_device_id: 'row-gan'});

		applyCreatedSolve('s3', {id: 's3', is_smart_cube: true});
		expect(rows.get('s3').smart_device_id).toBe('row-gan');
	});
});
