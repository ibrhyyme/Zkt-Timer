const warn = jest.fn();
jest.mock('../../../services/logger', () => ({logger: {warn: (...a: any[]) => warn(...a), info: jest.fn(), error: jest.fn()}}));

import {
	applySmartDeviceIds,
	requestedSmartDeviceIds,
	resolveSmartDeviceIds,
	sanitizeSmartDeviceLinks,
	OwnedSmartDevice,
} from '../smart_device_link';

// The caller's two registered cubes. `device_id` is the BLE identifier the app sent when it
// registered them (Android MAC, iOS UUID); `id` is the row id the foreign key points at.
const GAN: OwnedSmartDevice = {id: 'row-gan', device_id: 'AA:BB:CC:DD:EE:01', created_at: new Date('2025-01-01')};
const MOYU: OwnedSmartDevice = {id: 'row-moyu', device_id: 'B5E1-IOS-UUID', created_at: new Date('2025-02-01')};

/**
 * A stand-in for prisma.smartDevice.findMany that applies the same where clause the helper
 * sends: rows of `user_id` whose id or device_id is one of the requested values.
 */
function fakePrisma(rows: (OwnedSmartDevice & {user_id: string})[]) {
	const findMany = jest.fn(async (args: any) => {
		const {user_id, OR} = args.where;
		const ids: string[] = OR[0].id.in;
		const bleIds: string[] = OR[1].device_id.in;
		return rows
			.filter((r) => r.user_id === user_id && (ids.includes(r.id) || bleIds.includes(r.device_id as string)))
			.map(({id, device_id, created_at}) => ({id, device_id, created_at}));
	});
	return {prisma: {smartDevice: {findMany}} as any, findMany};
}

beforeEach(() => warn.mockClear());

describe('requestedSmartDeviceIds', () => {
	it('collects distinct, non-empty values and skips rows without one', () => {
		expect(
			requestedSmartDeviceIds([
				{smart_device_id: 'a'},
				{smart_device_id: 'a'},
				{smart_device_id: ''},
				{smart_device_id: null},
				{},
				{smart_device_id: 'b'},
			])
		).toEqual(['a', 'b']);
	});
});

describe('resolveSmartDeviceIds', () => {
	it("keeps the id of one of the caller's own devices", () => {
		expect(resolveSmartDeviceIds(['row-gan'], [GAN]).get('row-gan')).toBe('row-gan');
	});

	it('maps the BLE identifier an offline connect records to the device row (E-a)', () => {
		const resolved = resolveSmartDeviceIds(['AA:BB:CC:DD:EE:01', 'B5E1-IOS-UUID'], [GAN, MOYU]);
		expect(resolved.get('AA:BB:CC:DD:EE:01')).toBe('row-gan');
		expect(resolved.get('B5E1-IOS-UUID')).toBe('row-moyu');
	});

	it('clears a value that matches none of the caller devices (unknown cube, or another account)', () => {
		// `owned` holds only the caller's rows, so another account's row id simply is not there.
		expect(resolveSmartDeviceIds(['row-of-someone-else', 'FF:FF:FF:FF:FF:FF'], [GAN])).toEqual(
			new Map([
				['row-of-someone-else', null],
				['FF:FF:FF:FF:FF:FF', null],
			])
		);
	});

	it('picks the oldest row when two rows carry the same BLE identifier', () => {
		const newer: OwnedSmartDevice = {id: 'row-gan-dup', device_id: GAN.device_id, created_at: new Date('2025-06-01')};
		expect(resolveSmartDeviceIds([GAN.device_id as string], [newer, GAN]).get(GAN.device_id as string)).toBe('row-gan');
	});

	it('prefers an exact row id over a BLE identifier match', () => {
		// Theoretical collision: one row's id equals another row's device_id.
		const odd: OwnedSmartDevice = {id: 'row-x', device_id: 'row-gan', created_at: new Date('2024-01-01')};
		expect(resolveSmartDeviceIds(['row-gan'], [odd, GAN]).get('row-gan')).toBe('row-gan');
	});
});

describe('applySmartDeviceIds', () => {
	it('rewrites rows in place and reports what changed', () => {
		const rows: any[] = [
			{id: 's1', smart_device_id: 'row-gan'},
			{id: 's2', smart_device_id: 'AA:BB:CC:DD:EE:01'},
			{id: 's3', smart_device_id: 'unknown'},
			{id: 's4', smart_device_id: ''},
			{id: 's5', smart_device_id: null},
			{id: 's6'},
		];
		const resolved = new Map<string, string | null>([
			['row-gan', 'row-gan'],
			['AA:BB:CC:DD:EE:01', 'row-gan'],
			['unknown', null],
		]);

		const report = applySmartDeviceIds(rows, resolved);

		expect(rows.map((r) => r.smart_device_id)).toEqual(['row-gan', 'row-gan', null, null, null, undefined]);
		// Undefined stays absent: on an update that means "leave the stored link alone".
		expect('smart_device_id' in rows[5]).toBe(false);
		expect(report).toEqual({relinked: ['s2'], cleared: ['s3', 's4']});
	});
});

describe('sanitizeSmartDeviceLinks', () => {
	const devices = [
		{...GAN, user_id: 'me'},
		{...MOYU, user_id: 'me'},
		{id: 'row-foreign', device_id: 'CC:CC:CC:CC:CC:CC', created_at: new Date('2025-01-01'), user_id: 'someone-else'},
	];

	it('asks the database nothing when no row carries a value', async () => {
		const {prisma, findMany} = fakePrisma(devices);
		const rows: any[] = [{id: 's1'}, {id: 's2', smart_device_id: null}, {id: 's3', smart_device_id: ''}];

		const report = await sanitizeSmartDeviceLinks(prisma, 'me', rows, 'bulkCreateSolves');

		expect(findMany).not.toHaveBeenCalled();
		// The empty value still goes: it would fail the foreign key just the same.
		expect(rows[2].smart_device_id).toBeNull();
		expect(report.cleared).toEqual(['s3']);
	});

	it('looks up a whole batch with one query, scoped to the caller', async () => {
		const {prisma, findMany} = fakePrisma(devices);
		const rows: any[] = [
			{id: 's1', smart_device_id: 'row-gan'},
			{id: 's2', smart_device_id: 'AA:BB:CC:DD:EE:01'},
			{id: 's3', smart_device_id: 'B5E1-IOS-UUID'},
			{id: 's4', smart_device_id: 'row-foreign'},
			{id: 's5', smart_device_id: 'CC:CC:CC:CC:CC:CC'},
		];

		const report = await sanitizeSmartDeviceLinks(prisma, 'me', rows, 'bulkCreateSolves');

		expect(findMany).toHaveBeenCalledTimes(1);
		expect(findMany.mock.calls[0][0].where.user_id).toBe('me');
		expect(rows.map((r) => r.smart_device_id)).toEqual(['row-gan', 'row-gan', 'row-moyu', null, null]);
		expect(report).toEqual({relinked: ['s2', 's3'], cleared: ['s4', 's5']});
	});

	it('logs one line when it changed something, without the BLE identifiers', async () => {
		const {prisma} = fakePrisma(devices);
		await sanitizeSmartDeviceLinks(prisma, 'me', [{id: 's1', smart_device_id: 'AA:BB:CC:DD:EE:01'}], 'createSolve');

		expect(warn).toHaveBeenCalledTimes(1);
		const [message, meta] = warn.mock.calls[0];
		expect(message).toBe('Solve smart device link repaired');
		expect(meta).toEqual({userId: 'me', source: 'createSolve', relinkedCount: 1, clearedCount: 0, solveIds: ['s1']});
		expect(JSON.stringify(meta)).not.toContain('AA:BB');
	});

	it('stays quiet when every value was already right', async () => {
		const {prisma} = fakePrisma(devices);
		const report = await sanitizeSmartDeviceLinks(prisma, 'me', [{id: 's1', smart_device_id: 'row-moyu'}], 'createSolve');

		expect(report).toEqual({relinked: [], cleared: []});
		expect(warn).not.toHaveBeenCalled();
	});
});
